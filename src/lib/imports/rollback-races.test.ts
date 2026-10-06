import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import test from "node:test";
import { db } from "@/lib/db";
import { createImportBatch, updateImportMapping } from "@/lib/imports/staging";
import { validateImportBatch } from "@/lib/imports/validation";
import { applyImportBatch } from "@/lib/imports/apply";
import { rollbackImportBatch } from "@/lib/imports/rollback";
import { generateAnalyticsReport, getAnalyticsReportSourceStatus } from "@/lib/analytics/reports";

async function waitForBlockedTransaction(blockerPid: number) {
  for (let attempt = 0; attempt < 150; attempt++) {
    const blocked = await db.$queryRaw<Array<{ pid: number }>>`SELECT pid FROM pg_stat_activity WHERE ${blockerPid} = ANY(pg_blocking_pids(pid)) ORDER BY pid LIMIT 1`;
    if (blocked[0]) return blocked[0].pid;
    await setTimeout(20);
  }
  throw new Error("Expected transaction to reach the held database lock");
}

test("rollback waits for native cohort children without a tenant-lock inversion or silent cascade", async (context) => {
  if (!process.env.DATABASE_URL) { assert.notEqual(process.env.REQUIRE_DOMAIN_DATABASE, "true"); context.skip("Disposable PostgreSQL required"); return; }
  const suffix = randomUUID();
  const user = await db.user.create({ data: { email: `rollback-race-${suffix}@example.test`, passwordHash: "test-only" } });
  const org = await db.organization.create({ data: { name: "Rollback race", slug: `rollback-race-${suffix}` } });
  let allowInsert!: () => void; const insertAllowed = new Promise<void>((resolve) => { allowInsert = resolve; });
  try {
    await db.organizationMembership.create({ data: { organizationId: org.id, userId: user.id, role: "MANAGER" } });
    const program = await db.fundingProgram.create({ data: { organizationId: org.id, createdByUserId: user.id, name: "Program", slug: "program" } });
    const venture = await db.venture.create({ data: { organizationId: org.id, name: "Native identity", kind: "COMPANY" } });
    const staged = await createImportBatch(user.id, org.id, { type: "COHORTS", namespace: "race", bytes: new TextEncoder().encode(`external_id,funding_program_id,name\nc1,${program.id},Imported cohort`) });
    const mapped = await updateImportMapping(user.id, org.id, staged.id, staged.revision, { external_id: "external_id", funding_program_id: "funding_program_id", name: "name" });
    const valid = await validateImportBatch(user.id, org.id, mapped.id, mapped.revision);
    const batch = await applyImportBatch(user.id, org.id, valid.id, valid.revision);
    const change = await db.importChange.findFirstOrThrow({ where: { organizationId: org.id, batchId: batch.id } });
    let locked!: (pid: number) => void; const nativeLocked = new Promise<number>((resolve) => { locked = resolve; });
    const native = db.$transaction(async (client) => {
      const [{ pid }] = await client.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      await client.$queryRaw`SELECT "id" FROM "Cohort" WHERE "organizationId" = ${org.id} AND "id" = ${change.entityId} FOR UPDATE`;
      locked(pid);
      await insertAllowed;
      return client.ventureEnrollment.create({ data: { organizationId: org.id, cohortId: change.entityId, ventureId: venture.id } });
    }, { timeout: 10000 }).then((value) => ({ ok: true as const, value }), (error: unknown) => ({ ok: false as const, error }));
    const nativePid = await nativeLocked;
    const reversing = rollbackImportBatch(user.id, org.id, batch.id, batch.revision).then((value) => ({ ok: true as const, value }), (error: unknown) => ({ ok: false as const, error }));
    let blocked = false;
    try {
      for (let attempt = 0; attempt < 150; attempt++) {
        const [snapshot] = await db.$queryRaw<Array<{ blocked: boolean }>>`SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE ${nativePid} = ANY(pg_blocking_pids(pid))) AS blocked`;
        if (snapshot.blocked) { blocked = true; break; }
        await setTimeout(20);
      }
    } finally { allowInsert(); }
    const [inserted, reverted] = await Promise.all([native, reversing]);
    assert.equal(blocked, true, "Rollback must reach the held parent lock");
    assert.equal(inserted.ok, true, inserted.ok ? "" : String(inserted.error));
    assert.equal(reverted.ok, false);
    if (!reverted.ok) assert.match(String(reverted.error), /IMPORT_ROLLBACK_BLOCKED/);
    assert.equal(await db.ventureEnrollment.count({ where: { organizationId: org.id, cohortId: change.entityId } }), 1);
    assert.ok(await db.cohort.findFirst({ where: { organizationId: org.id, id: change.entityId } }));
  } finally {
    allowInsert();
    await db.organization.delete({ where: { id: org.id } }); await db.user.delete({ where: { id: user.id } });
  }
});

test("a report waiting behind rollback retries its stale snapshot and freezes only the committed current state", async (context) => {
  if (!process.env.DATABASE_URL) { assert.notEqual(process.env.REQUIRE_DOMAIN_DATABASE, "true"); context.skip("Disposable PostgreSQL required"); return; }
  const suffix = randomUUID();
  const user = await db.user.create({ data: { email: `report-rollback-${suffix}@example.test`, passwordHash: "test-only" } });
  const org = await db.organization.create({ data: { name: "Report rollback", slug: `report-rollback-${suffix}` } });
  let release!: () => void; const released = new Promise<void>((resolve) => { release = resolve; });
  try {
    await db.organizationMembership.create({ data: { organizationId: org.id, userId: user.id, role: "MANAGER" } });
    const staged = await createImportBatch(user.id, org.id, { type: "VENTURES", namespace: "race", bytes: new TextEncoder().encode("external_id,name,kind\nv1,Reversible venture,COMPANY") });
    const mapped = await updateImportMapping(user.id, org.id, staged.id, staged.revision, { external_id: "external_id", name: "name", kind: "kind" });
    const valid = await validateImportBatch(user.id, org.id, mapped.id, mapped.revision);
    const batch = await applyImportBatch(user.id, org.id, valid.id, valid.revision);
    const change = await db.importChange.findFirstOrThrow({ where: { organizationId: org.id, batchId: batch.id } });
    let locked!: (pid: number) => void; const held = new Promise<number>((resolve) => { locked = resolve; });
    const holder = db.$transaction(async (client) => {
      const [{ pid }] = await client.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      await client.$queryRaw`SELECT "id" FROM "Venture" WHERE "organizationId" = ${org.id} AND "id" = ${change.entityId} FOR UPDATE`;
      locked(pid); await released;
    }, { timeout: 10000 });
    const holderPid = await held;
    const reversing = rollbackImportBatch(user.id, org.id, batch.id, batch.revision).then((value) => ({ ok: true as const, value }), (error: unknown) => ({ ok: false as const, error }));
    const rollbackPid = await waitForBlockedTransaction(holderPid);
    const access = { organizationId: org.id, userId: user.id, role: "MANAGER" as const };
    const reporting = generateAnalyticsReport(access, { type: "PORTFOLIO_EXECUTIVE", title: "Concurrent consistent report" }).then((value) => ({ ok: true as const, value }), (error: unknown) => ({ ok: false as const, error }));
    try { await waitForBlockedTransaction(rollbackPid); } finally { release(); }
    await holder;
    const [reverted, reported] = await Promise.all([reversing, reporting]);
    assert.equal(reverted.ok, true, reverted.ok ? "" : String(reverted.error));
    assert.equal(reported.ok, true, reported.ok ? "" : String(reported.error));
    assert.equal(await db.venture.count({ where: { organizationId: org.id } }), 0);
    assert.equal(await db.analyticsReportSnapshot.count({ where: { organizationId: org.id } }), 1);
    if (reported.ok) assert.equal((await getAnalyticsReportSourceStatus(access, reported.value.id)).stale, false);
  } finally { release(); await db.organization.delete({ where: { id: org.id } }); await db.user.delete({ where: { id: user.id } }); }
});
