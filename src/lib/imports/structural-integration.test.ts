import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { db } from "@/lib/db";
import { createProtocolVersion } from "@/lib/tracking-protocols/service";
import { createImportBatch, getImportBatch, updateImportMapping } from "@/lib/imports/staging";
import { validateImportBatch } from "@/lib/imports/validation";
import { applyImportBatch } from "@/lib/imports/apply";
import type { ImportEntityType } from "@/lib/imports/templates";

test("historical structural imports apply atomically with tenant references, private defaults, audit and concurrency", async (context) => {
  if (!process.env.DATABASE_URL) { assert.notEqual(process.env.REQUIRE_DOMAIN_DATABASE, "true"); context.skip("Disposable PostgreSQL required"); return; }
  const suffix = randomUUID();
  const user = await db.user.create({ data: { email: `structural-${suffix}@example.test`, passwordHash: "test-only" } });
  const organizations = await Promise.all(["a", "b"].map((name) => db.organization.create({ data: { name, slug: `structural-${name}-${suffix}` } })));
  const [org, other] = organizations;
  await db.organizationMembership.create({ data: { organizationId: org.id, userId: user.id, role: "MANAGER" } });
  const stage = async (type: ImportEntityType, rows: Record<string, string>[], options?: { mode: "CREATE_ONLY" | "UPSERT" }) => {
    const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const csv = [headers, ...rows.map((row) => headers.map((key) => row[key] ?? ""))].map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const batch = await createImportBatch(user.id, org.id, { type, namespace: "historic", bytes: new TextEncoder().encode(csv), options });
    return updateImportMapping(user.id, org.id, batch.id, batch.revision, Object.fromEntries(headers.map((header) => [header, header])));
  };
  const importRows = async (type: ImportEntityType, rows: Record<string, string>[]) => {
    const mapped = await stage(type, rows); const checked = await validateImportBatch(user.id, org.id, mapped.id, mapped.revision);
    assert.equal(checked.status, "READY", JSON.stringify((await getImportBatch(user.id, org.id, mapped.id)).rows));
    return applyImportBatch(user.id, org.id, checked.id, checked.revision);
  };
  try {
    const programBatch = await importRows("FUNDING_PROGRAMS", [{ external_id: "p1", name: "Historical program", slug: "historical", status: "CLOSED" }]);
    assert.equal(programBatch.status, "APPLIED"); assert.equal(programBatch.appliedRows, 1);
    const program = await db.fundingProgram.findFirstOrThrow({ where: { organizationId: org.id, slug: "historical" } });
    assert.equal(program.status, "CLOSED");
    await importRows("FUNDING_CALLS", [{ external_id: "c1", funding_program_external_id: "p1", title: "Historical call", call_number: "2024/01", status: "CLOSED", total_budget: "999999999999.99" }]);
    const call = await db.fundingCall.findFirstOrThrow({ where: { organizationId: org.id } });
    assert.equal(call.publicListingEnabled, false); assert.equal(call.applicationsEnabled, false); assert.equal(call.totalBudget?.toString(), "999999999999.99");
    const protocol = await createProtocolVersion(org.id, { name: "Historical instrument", indicators: [{ key: "headcount", label: "Equipe", valueType: "INTEGER" }] });
    await importRows("COHORTS", [{ external_id: "co1", funding_program_external_id: "p1", funding_call_external_id: "c1", tracking_protocol_version_id: protocol.versions[0].id, name: "Historical cohort", status: "CLOSED", starts_at: "2024-01-01" }]);
    await importRows("VENTURES", [{ external_id: "v1", name: "Persistent venture", kind: "COMPANY" }]);
    await importRows("VENTURE_ENROLLMENTS", [{ external_id: "e1", cohort_external_id: "co1", venture_external_id: "v1", enrolled_at: "2024-01-01T09:00:00-03:00", withdrawn_at: "2025-01-01T00:00:00Z", status: "WITHDRAWN" }]);
    const waveBatch = await importRows("FOLLOW_UP_WAVES", [{ external_id: "w1", cohort_external_id: "co1", name: "Baseline", kind: "BASELINE", sequence: "0", offset_months: "0", scheduled_for: "2024-01-01", status: "CLOSED" }]);
    const observation = await db.ventureObservation.findFirstOrThrow({ where: { organizationId: org.id } });
    assert.equal(observation.status, "PENDING"); assert.equal(observation.revision, 0);
    assert.equal(await db.importChange.count({ where: { organizationId: org.id, batchId: waveBatch.id, entityType: "OBSERVATIONS", entityId: observation.id } }), 1);
    await importRows("MILESTONES", [{ external_id: "m1", venture_external_id: "v1", type: "FIRST_CUSTOMER", title: "First client", occurred_at: "2024-06-01T10:00:00Z" }]);
    assert.equal(await db.project.count({ where: { createdByUserId: user.id } }), 0);
    assert.equal(await db.application.count({ where: { organizationId: org.id } }), 0);
    assert.equal(await db.externalReference.count({ where: { organizationId: org.id } }), 7);
    const changes = await db.importChange.findMany({ where: { organizationId: org.id } });
    assert.equal(changes.length, 8); assert.ok(changes.every((change) => /^[a-f0-9]{64}$/.test(change.afterDigest)));
    await assert.rejects(() => updateImportMapping(user.id, org.id, programBatch.id, programBatch.revision, { external_id: "external_id", name: "name", slug: "slug" }), /IMPORT_BATCH_IMMUTABLE/);
    await assert.rejects(() => applyImportBatch(user.id, org.id, programBatch.id, programBatch.revision), /IMPORT_NOT_READY/);

    const foreignProgram = await db.fundingProgram.create({ data: { organizationId: other.id, createdByUserId: user.id, name: "Private foreign", slug: "foreign" } });
    const invalid = await stage("COHORTS", [{ external_id: "bad", funding_program_id: foreignProgram.id, name: "Should not exist" }, { external_id: "good", funding_program_id: program.id, name: "Also should not exist" }]);
    const failed = await validateImportBatch(user.id, org.id, invalid.id, invalid.revision);
    assert.equal(failed.invalidRows, 1); assert.equal(failed.validRows, 1); assert.equal(failed.status, "FAILED");
    await assert.rejects(() => applyImportBatch(user.id, org.id, failed.id, failed.revision), /IMPORT_NOT_READY/);
    assert.equal(await db.cohort.count({ where: { organizationId: org.id } }), 1);
    await assert.rejects(() => db.externalReference.create({ data: { organizationId: org.id, namespace: "foreign", entityType: "FUNDING_PROGRAMS", externalId: "foreign", entityId: foreignProgram.id } }), /IMPORT_EXTERNAL_REFERENCE_SCOPE/);

    const duplicate = await stage("VENTURES", [{ external_id: "v1", name: "Duplicate", kind: "COMPANY" }]);
    assert.equal((await validateImportBatch(user.id, org.id, duplicate.id, duplicate.revision)).invalidRows, 1);
    const concurrent = await stage("VENTURES", [{ external_id: "race", name: "One identity", kind: "PROJECT" }]);
    const ready = await validateImportBatch(user.id, org.id, concurrent.id, concurrent.revision);
    const raced = await Promise.allSettled([applyImportBatch(user.id, org.id, ready.id, ready.revision), applyImportBatch(user.id, org.id, ready.id, ready.revision)]);
    assert.equal(raced.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(await db.venture.count({ where: { organizationId: org.id, name: "One identity" } }), 1);
    const separate = await Promise.all([stage("VENTURES", [{ external_id: "shared", name: "Shared", kind: "COMPANY" }]), stage("VENTURES", [{ external_id: "shared", name: "Shared", kind: "COMPANY" }])]);
    const separateReady = await Promise.all(separate.map((batch) => validateImportBatch(user.id, org.id, batch.id, batch.revision)));
    const separateRaced = await Promise.allSettled(separateReady.map((batch) => applyImportBatch(user.id, org.id, batch.id, batch.revision)));
    assert.equal(separateRaced.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(await db.venture.count({ where: { organizationId: org.id, name: "Shared" } }), 1);

    const metadata = await stage("FUNDING_PROGRAMS", [{ external_id: "p1", name: "Renamed historical program", slug: "historical", description: "Reviewed metadata" }], { mode: "UPSERT" });
    const metadataReady = await validateImportBatch(user.id, org.id, metadata.id, metadata.revision);
    await applyImportBatch(user.id, org.id, metadataReady.id, metadataReady.revision);
    const updated = await db.fundingProgram.findFirstOrThrow({ where: { organizationId: org.id, id: program.id } });
    assert.equal(updated.status, "CLOSED"); assert.equal(updated.description, "Reviewed metadata");
    const updateAudit = await db.importChange.findFirstOrThrow({ where: { organizationId: org.id, batchId: metadata.id } });
    assert.equal(updateAudit.operation, "UPDATE"); assert.equal((updateAudit.beforeData as { name: string }).name, "Historical program");
    const unsafe = await stage("FUNDING_PROGRAMS", [{ external_id: "p1", name: "Unsafe transition", slug: "historical", status: "ACTIVE" }], { mode: "UPSERT" });
    assert.equal((await validateImportBatch(user.id, org.id, unsafe.id, unsafe.revision)).invalidRows, 1);

    const stale = await stage("FUNDING_CALLS", [{ external_id: "stale-call", funding_program_external_id: "p1", title: "Stale preview", call_number: "stale" }]);
    const staleReady = await validateImportBatch(user.id, org.id, stale.id, stale.revision);
    await db.fundingProgram.update({ where: { id: program.id, organizationId: org.id }, data: { description: "Manual change after preview" } });
    await assert.rejects(() => applyImportBatch(user.id, org.id, staleReady.id, staleReady.revision), /IMPORT_REFERENCE_CHANGED/);
    assert.equal(await db.fundingCall.count({ where: { organizationId: org.id, callNumber: "stale" } }), 0);
    assert.equal((await getImportBatch(user.id, org.id, stale.id)).batch.status, "FAILED");
    const remapped = await validateImportBatch(user.id, org.id, stale.id, (await getImportBatch(user.id, org.id, stale.id)).batch.revision);
    const member = await db.organizationMembership.findUniqueOrThrow({ where: { organizationId_userId: { organizationId: org.id, userId: user.id } } });
    await db.organizationMembership.update({ where: { id: member.id }, data: { status: "DISABLED" } });
    await assert.rejects(() => applyImportBatch(user.id, org.id, remapped.id, remapped.revision), /MEMBERSHIP_DISABLED/);
    assert.equal(await db.fundingCall.count({ where: { organizationId: org.id, callNumber: "stale" } }), 0);
    await db.organizationMembership.update({ where: { id: member.id }, data: { status: "ACTIVE" } });
  } finally {
    await db.organization.deleteMany({ where: { id: { in: organizations.map((item) => item.id) } } });
    await db.user.delete({ where: { id: user.id } });
  }
});
