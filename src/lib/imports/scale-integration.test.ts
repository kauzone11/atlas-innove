import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";

test("maximum-sized batches retain bounded reads, complete pagination and atomic audit reversal", async (context) => {
  if (!process.env.DATABASE_URL) { assert.notEqual(process.env.REQUIRE_DOMAIN_DATABASE, "true"); context.skip("Disposable PostgreSQL required"); return; }
  const client = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
  (globalThis as unknown as { prisma: PrismaClient }).prisma = client;
  const { createImportBatch, updateImportMapping, getImportBatch } = await import("@/lib/imports/staging");
  const { validateImportBatch } = await import("@/lib/imports/validation");
  const { applyImportBatch } = await import("@/lib/imports/apply");
  const { getImportAudit } = await import("@/lib/imports/audit");
  const { previewImportRollback, rollbackImportBatch } = await import("@/lib/imports/rollback");
  const suffix = randomUUID(); let reads = 0;
  client.$on("query", (event) => { if (/^SELECT/i.test(event.query.trim())) reads++; });
  const user = await client.user.create({ data: { email: `scale-${suffix}@example.test`, passwordHash: "test-only", profile: { create: { fullName: "Contextual actor", phone: "PRIVATE_PHONE_MARKER" } }, innovationProfile: { create: { bio: "PRIVATE_BIO_MARKER", directoryEnabled: false, profileVisibility: "PRIVATE" } } } });
  const org = await client.organization.create({ data: { name: "Scale audit", slug: `scale-${suffix}` } });
  await client.organizationMembership.create({ data: { userId: user.id, organizationId: org.id, role: "MANAGER" } });
  try {
    const csv = `external_id,name,kind\n${Array.from({ length: 1000 }, (_, index) => `v${index},Venture ${index},COMPANY`).join("\n")}`;
    const batch = await createImportBatch(user.id, org.id, { type: "VENTURES", namespace: "maximum", bytes: new TextEncoder().encode(csv) });
    const mapped = await updateImportMapping(user.id, org.id, batch.id, batch.revision, { external_id: "external_id", name: "name", kind: "kind" });
    reads = 0; const ready = await validateImportBatch(user.id, org.id, batch.id, mapped.revision); const validationReads = reads;
    assert.equal(ready.validRows, 1000); assert.ok(validationReads < 50, `Validation expanded to ${validationReads} reads`);
    reads = 0; const applied = await applyImportBatch(user.id, org.id, batch.id, ready.revision); const applyReads = reads;
    assert.ok(applyReads < 60, `Apply expanded to ${applyReads} reads`);
    assert.equal(await client.venture.count({ where: { organizationId: org.id } }), 1000);
    assert.equal(await client.externalReference.count({ where: { organizationId: org.id } }), 1000);
    reads = 0; const first = await getImportBatch(user.id, org.id, batch.id); const firstReads = reads;
    reads = 0; const last = await getImportBatch(user.id, org.id, batch.id, { page: 50 }); const lastReads = reads;
    assert.equal(first.rows.length, 20); assert.equal(first.hasNext, true); assert.equal(last.rows.length, 20); assert.equal(last.rows.at(-1)?.rowNumber, 1001); assert.equal(last.hasNext, false);
    assert.equal(firstReads, lastReads); assert.ok(firstReads < 10);
    assert.deepEqual(first.actors, [{ id: user.id, name: "Contextual actor" }]);
    assert.equal(JSON.stringify(first).includes("PRIVATE_"), false); assert.equal(JSON.stringify(first).includes(user.email), false);
    const audit = await getImportAudit(user.id, org.id, batch.id, { page: 50 }); assert.equal(audit.items.length, 20); assert.equal(audit.hasNext, false);
    const preview = await previewImportRollback(user.id, org.id, batch.id, { page: 50 }); assert.equal(preview.totalChanges, 1000); assert.equal(preview.items.length, 20); assert.equal(preview.canRollback, true); assert.equal(preview.hasNext, false);
    await rollbackImportBatch(user.id, org.id, batch.id, applied.revision);
    assert.equal(await client.venture.count({ where: { organizationId: org.id } }), 0);
    assert.equal(await client.importChange.count({ where: { organizationId: org.id, rolledBackAt: { not: null } } }), 1000);
    context.diagnostic(`1000 rows: validation ${validationReads} reads, apply ${applyReads} reads, page ${firstReads} reads`);
  } finally { await client.organization.delete({ where: { id: org.id } }); await client.user.delete({ where: { id: user.id } }); await client.$disconnect(); }
});
