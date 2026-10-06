import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { db } from "@/lib/db";
import { createImportBatch, getImportBatch, listImportBatches, updateImportMapping } from "@/lib/imports/staging";

test("import staging preserves raw evidence, explicit tenant access, revisions and bounded previews", async (context) => {
  if (!process.env.DATABASE_URL) { assert.notEqual(process.env.REQUIRE_DOMAIN_DATABASE, "true"); context.skip("Disposable PostgreSQL required"); return; }
  const suffix = randomUUID();
  const user = await db.user.create({ data: { email: `import-${suffix}@example.test`, passwordHash: "test-only", platformRole: "SUPER_ADMIN" } });
  const organizations = await Promise.all(["a", "b"].map((name) => db.organization.create({ data: { name, slug: `import-${name}-${suffix}` } })));
  const [organization, other] = organizations;
  const input = { type: "VENTURES" as const, namespace: "legacy-2024", sourceName: "ventures.csv", bytes: new TextEncoder().encode(`external_id,name,kind,extra\n${Array.from({ length: 25 }, (_, i) => `v${i},Venture ${i},COMPANY,=1+1`).join("\n")}`) };
  try {
    await assert.rejects(() => createImportBatch(user.id, organization.id, input), /ORGANIZATION_ACCESS_DENIED/);
    const membership = await db.organizationMembership.create({ data: { organizationId: organization.id, userId: user.id, role: "ANALYST" } });
    await assert.rejects(() => createImportBatch(user.id, organization.id, input), /ROLE_FORBIDDEN/);
    await db.organizationMembership.update({ where: { id: membership.id }, data: { role: "MANAGER" } });
    const batch = await createImportBatch(user.id, organization.id, input);
    assert.equal(batch.schemaVersion, 1); assert.equal(batch.totalRows, 25); assert.equal(batch.status, "UPLOADED"); assert.equal(batch.mappingConfirmedAt, null);
    assert.match(batch.sourceDigest, /^[a-f0-9]{64}$/);
    const page = await getImportBatch(user.id, organization.id, batch.id, { page: 1 });
    assert.equal(page.rows.length, 20); assert.equal(page.hasNext, true); assert.equal((page.rows[0].rawData as Record<string, string>).extra, "=1+1");
    const next = await getImportBatch(user.id, organization.id, batch.id, { page: 2 });
    assert.equal(next.rows.length, 5); assert.equal(next.hasNext, false);
    await db.organizationMembership.create({ data: { organizationId: other.id, userId: user.id, role: "OWNER" } });
    await assert.rejects(() => getImportBatch(user.id, other.id, batch.id), /IMPORT_BATCH_NOT_FOUND/);
    assert.equal((await listImportBatches(user.id, other.id)).items.length, 0);
    const mapping = { external_id: "external_id", name: "name", kind: "kind" };
    const mapped = await updateImportMapping(user.id, organization.id, batch.id, batch.revision, mapping);
    assert.equal(mapped.revision, batch.revision + 1); assert.ok(mapped.mappingConfirmedAt);
    await assert.rejects(() => updateImportMapping(user.id, organization.id, batch.id, batch.revision, mapping), /IMPORT_REVISION_CONFLICT/);
    const row = page.rows[0];
    await assert.rejects(() => db.importRow.update({ where: { id: row.id }, data: { rawData: { forged: "data" } } }), /IMPORT_RAW_IMMUTABLE/);
    await assert.rejects(() => db.importBatch.update({ where: { id: batch.id }, data: { sourceDigest: "0".repeat(64) } }), /IMPORT_SOURCE_IMMUTABLE/);
    await assert.rejects(() => db.importRow.create({ data: { organizationId: other.id, batchId: batch.id, rowNumber: 100, rawData: {} } }));
    await assert.rejects(() => db.importBatch.delete({ where: { id: batch.id } }), /IMPORT_AUDIT_RETAINED/);
    await db.organizationMembership.update({ where: { id: membership.id }, data: { status: "DISABLED" } });
    await assert.rejects(() => getImportBatch(user.id, organization.id, batch.id), /MEMBERSHIP_DISABLED/);
    await db.organizationMembership.update({ where: { id: membership.id }, data: { status: "ACTIVE" } });
    await db.organization.update({ where: { id: organization.id }, data: { status: "INACTIVE" } });
    await assert.rejects(() => updateImportMapping(user.id, organization.id, batch.id, mapped.revision, mapping), /ORGANIZATION_INACTIVE/);
  } finally {
    await db.organization.deleteMany({ where: { id: { in: organizations.map((item) => item.id) } } });
    await db.user.delete({ where: { id: user.id } });
  }
});
