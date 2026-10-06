import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { db } from "@/lib/db";
import { createProtocolVersion } from "@/lib/tracking-protocols/service";
import { createFollowUpWave } from "@/lib/follow-up/service";
import { generateAnalyticsReport } from "@/lib/analytics/reports";
import { createImportBatch, updateImportMapping } from "@/lib/imports/staging";
import { validateImportBatch } from "@/lib/imports/validation";
import { applyImportBatch } from "@/lib/imports/apply";
import { previewImportRollback, rollbackImportBatch } from "@/lib/imports/rollback";
import type { ImportEntityType } from "@/lib/imports/templates";

test("rollback is atomic, preserves evidence and refuses changed records, downstream children and frozen analysis", async (context) => {
  if (!process.env.DATABASE_URL) { assert.notEqual(process.env.REQUIRE_DOMAIN_DATABASE, "true"); context.skip("Disposable PostgreSQL required"); return; }
  const suffix = randomUUID(); const user = await db.user.create({ data: { email: `rollback-${suffix}@example.test`, passwordHash: "test-only" } });
  const org = await db.organization.create({ data: { name: "Rollback", slug: `rollback-${suffix}` } });
  await db.organizationMembership.create({ data: { organizationId: org.id, userId: user.id, role: "MANAGER" } });
  const apply = async (type: ImportEntityType, rows: Record<string, string>[], mode: "CREATE_ONLY" | "UPSERT" = "CREATE_ONLY") => {
    const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const bytes = new TextEncoder().encode([headers, ...rows.map((row) => headers.map((key) => row[key] ?? ""))].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n"));
    const staged = await createImportBatch(user.id, org.id, { type, namespace: "history", bytes, options: { mode } });
    const mapped = await updateImportMapping(user.id, org.id, staged.id, staged.revision, Object.fromEntries(headers.map((header) => [header, header])));
    const valid = await validateImportBatch(user.id, org.id, staged.id, mapped.revision);
    assert.equal(valid.status, "READY"); return applyImportBatch(user.id, org.id, valid.id, valid.revision);
  };
  const entity = async (batchId: string) => db.importChange.findFirstOrThrow({ where: { organizationId: org.id, batchId } });
  const venture = (external_id: string) => ({ external_id, name: `Venture ${external_id}`, kind: "COMPANY" });
  try {
    const clean = await apply("VENTURES", [venture("clean-a"), venture("clean-b")]);
    const safe = await previewImportRollback(user.id, org.id, clean.id);
    assert.equal(safe.canRollback, true); assert.equal(safe.totalChanges, 2);
    const reverted = await rollbackImportBatch(user.id, org.id, clean.id, clean.revision);
    assert.equal(reverted.status, "ROLLED_BACK");
    assert.equal(await db.venture.count({ where: { organizationId: org.id, name: { startsWith: "Venture clean" } } }), 0);
    assert.equal(await db.externalReference.count({ where: { organizationId: org.id, createdByImportBatchId: clean.id } }), 0);
    assert.equal(await db.importRow.count({ where: { organizationId: org.id, batchId: clean.id, status: "ROLLED_BACK" } }), 2);
    assert.equal(await db.importChange.count({ where: { organizationId: org.id, batchId: clean.id, rolledBackAt: { not: null } } }), 2);
    await assert.rejects(() => rollbackImportBatch(user.id, org.id, clean.id, reverted.revision), /IMPORT_NOT_APPLIED/);
    await assert.rejects(() => applyImportBatch(user.id, org.id, clean.id, reverted.revision), /IMPORT_NOT_READY/);
    const edited = await apply("VENTURES", [venture("edited"), venture("untouched")]);
    const editedChange = await entity(edited.id);
    await db.venture.update({ where: { organizationId: org.id, id: editedChange.entityId }, data: { name: "Manual change" } });
    assert.equal((await previewImportRollback(user.id, org.id, edited.id)).canRollback, false);
    await assert.rejects(() => rollbackImportBatch(user.id, org.id, edited.id, edited.revision), /IMPORT_ROLLBACK_BLOCKED/);
    assert.equal(await db.importChange.count({ where: { organizationId: org.id, batchId: edited.id, rolledBackAt: null } }), 2);
    assert.equal(await db.venture.count({ where: { organizationId: org.id } }), 2);

    const initial = await apply("VENTURES", [venture("metadata")]); const initialChange = await entity(initial.id);
    const before = await db.venture.findUniqueOrThrow({ where: { id: initialChange.entityId } });
    const metadata = await apply("VENTURES", [{ ...venture("metadata"), name: "Updated metadata", legal_name: "Legal name" }], "UPSERT");
    assert.equal((await previewImportRollback(user.id, org.id, initial.id)).canRollback, false);
    await rollbackImportBatch(user.id, org.id, metadata.id, metadata.revision);
    assert.deepEqual(await db.venture.findUniqueOrThrow({ where: { id: initialChange.entityId } }), before);
    await rollbackImportBatch(user.id, org.id, initial.id, initial.revision);

    const parent = await apply("FUNDING_PROGRAMS", [{ external_id: "parent", name: "Historical parent", slug: "parent" }]);
    const child = await apply("COHORTS", [{ external_id: "child", funding_program_external_id: "parent", name: "Dependent cohort" }]);
    assert.equal((await previewImportRollback(user.id, org.id, parent.id)).canRollback, false);
    await assert.rejects(() => rollbackImportBatch(user.id, org.id, parent.id, parent.revision), /IMPORT_ROLLBACK_BLOCKED/);
    await rollbackImportBatch(user.id, org.id, child.id, child.revision);
    await rollbackImportBatch(user.id, org.id, parent.id, parent.revision);

    const program = await db.fundingProgram.create({ data: { organizationId: org.id, createdByUserId: user.id, name: "Native", slug: "native", status: "ACTIVE" } });
    const protocol = await createProtocolVersion(org.id, { name: "Protocol", indicators: [{ key: "team", label: "Equipe", valueType: "INTEGER" }] });
    const cohort = await db.cohort.create({ data: { organizationId: org.id, fundingProgramId: program.id, name: "Native cohort", trackingProtocolVersionId: protocol.versions[0].id } });
    const manualParent = await apply("VENTURES", [venture("manual-child")]); const manualParentChange = await entity(manualParent.id);
    assert.equal((await previewImportRollback(user.id, org.id, manualParent.id)).canRollback, true);
    const enrollment = await db.ventureEnrollment.create({ data: { organizationId: org.id, cohortId: cohort.id, ventureId: manualParentChange.entityId, enrolledAt: new Date("2023-01-01T00:00:00Z") } });
    await assert.rejects(() => rollbackImportBatch(user.id, org.id, manualParent.id, manualParent.revision), /IMPORT_ROLLBACK_BLOCKED/);
    assert.ok(await db.ventureEnrollment.findUnique({ where: { id: enrollment.id } }));
    const wave = await createFollowUpWave(org.id, cohort.id, { name: "Baseline", kind: "BASELINE", sequence: 0, scheduledFor: new Date("2024-01-01T00:00:00Z") });
    const placeholder = await db.ventureObservation.findFirstOrThrow({ where: { organizationId: org.id, ventureEnrollmentId: enrollment.id, followUpWaveId: wave.id }, include: { values: true } });
    const historical = await apply("OBSERVATIONS", [{ external_id: "observed", venture_enrollment_id: enrollment.id, follow_up_wave_id: wave.id, indicator_key: "team", value: "0", status: "SUBMITTED", submitted_at: "2024-01-02T00:00:00Z" }]);
    await rollbackImportBatch(user.id, org.id, historical.id, historical.revision);
    assert.deepEqual(await db.ventureObservation.findUniqueOrThrow({ where: { id: placeholder.id }, include: { values: true } }), placeholder);
    const changedValue = await apply("OBSERVATIONS", [{ external_id: "changed-value", venture_enrollment_id: enrollment.id, follow_up_wave_id: wave.id, indicator_key: "team", value: "1", status: "SUBMITTED", submitted_at: "2024-01-02T00:00:00Z" }]);
    await db.observationValue.updateMany({ where: { organizationId: org.id, observationId: placeholder.id }, data: { integerValue: 2 } });
    assert.equal((await previewImportRollback(user.id, org.id, changedValue.id)).canRollback, false);

    const callBatch = await apply("FUNDING_CALLS", [{ external_id: "reversible-call", funding_program_id: program.id, title: "Historical call", call_number: "reversible" }]);
    await rollbackImportBatch(user.id, org.id, callBatch.id, callBatch.revision);
    assert.equal(await db.fundingCall.count({ where: { organizationId: org.id, callNumber: "reversible" } }), 0);
    const milestoneBatch = await apply("MILESTONES", [{ external_id: "reversible-milestone", venture_id: manualParentChange.entityId, type: "FIRST_CUSTOMER", title: "Historical milestone", occurred_at: "2024-01-01T00:00:00Z" }]);
    await rollbackImportBatch(user.id, org.id, milestoneBatch.id, milestoneBatch.revision);
    assert.equal(await db.milestone.count({ where: { organizationId: org.id } }), 0);
    const waveBatch = await apply("FOLLOW_UP_WAVES", [{ external_id: "reversible-wave", cohort_id: cohort.id, name: "Historical wave", kind: "FOLLOW_UP", sequence: "1", offset_months: "6", scheduled_for: "2024-07-01", status: "CLOSED" }]);
    assert.equal((await previewImportRollback(user.id, org.id, waveBatch.id)).totalChanges, 2);
    await rollbackImportBatch(user.id, org.id, waveBatch.id, waveBatch.revision);
    assert.equal(await db.followUpWave.count({ where: { organizationId: org.id, cohortId: cohort.id } }), 1);
    const unenrolled = await db.venture.create({ data: { organizationId: org.id, name: "Retained native identity", kind: "COMPANY" } });
    const enrollmentBatch = await apply("VENTURE_ENROLLMENTS", [{ external_id: "reversible-enrollment", cohort_id: cohort.id, venture_id: unenrolled.id, enrolled_at: "2023-01-01T00:00:00Z" }]);
    assert.equal((await previewImportRollback(user.id, org.id, enrollmentBatch.id)).totalChanges, 2);
    await rollbackImportBatch(user.id, org.id, enrollmentBatch.id, enrollmentBatch.revision);
    assert.equal(await db.ventureEnrollment.count({ where: { organizationId: org.id, ventureId: unenrolled.id } }), 0);
    assert.ok(await db.venture.findFirst({ where: { organizationId: org.id, id: unenrolled.id } }));

    const published = await apply("VENTURES", [venture("frozen-report")]);
    await generateAnalyticsReport({ organizationId: org.id, userId: user.id, role: "MANAGER" }, { type: "PORTFOLIO_EXECUTIVE", title: "Frozen institutional evidence" });
    const frozen = await previewImportRollback(user.id, org.id, published.id);
    assert.equal(frozen.canRollback, false); assert.ok(frozen.reasons.includes("IMPORT_FROZEN_ANALYSIS_DEPENDENCY"));
    await assert.rejects(() => rollbackImportBatch(user.id, org.id, published.id, published.revision), /IMPORT_ROLLBACK_BLOCKED/);
  } finally { await db.organization.delete({ where: { id: org.id } }); await db.user.delete({ where: { id: user.id } }); }
});
