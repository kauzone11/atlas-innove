import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { db } from "@/lib/db";
import { createProtocolVersion } from "@/lib/tracking-protocols/service";
import { createFollowUpWave, updateFollowUpWaveStatus } from "@/lib/follow-up/service";
import { saveObservationValues } from "@/lib/observations/service";
import { getCohortAnalytics } from "@/lib/analytics/read-model";
import { createImportBatch, getImportBatch, updateImportMapping } from "@/lib/imports/staging";
import { validateImportBatch } from "@/lib/imports/validation";
import { applyImportBatch } from "@/lib/imports/apply";

test("long observation imports preserve real methodology, grouped evidence, pristine placeholders and canonical analytics", async (context) => {
  if (!process.env.DATABASE_URL) { assert.notEqual(process.env.REQUIRE_DOMAIN_DATABASE, "true"); context.skip("Disposable PostgreSQL required"); return; }
  const suffix = randomUUID();
  const user = await db.user.create({ data: { email: `observed-import-${suffix}@example.test`, passwordHash: "test-only" } });
  const org = await db.organization.create({ data: { name: "Observation import", slug: `observed-import-${suffix}` } });
  await db.organizationMembership.create({ data: { organizationId: org.id, userId: user.id, role: "MANAGER" } });
  const stage = async (rows: Record<string, string>[]) => {
    const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const csv = [headers, ...rows.map((row) => headers.map((key) => row[key] ?? ""))].map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
    const batch = await createImportBatch(user.id, org.id, { type: "OBSERVATIONS", namespace: "evidence", bytes: new TextEncoder().encode(csv) });
    const mapped = await updateImportMapping(user.id, org.id, batch.id, batch.revision, Object.fromEntries(headers.map((header) => [header, header])));
    return validateImportBatch(user.id, org.id, batch.id, mapped.revision);
  };
  try {
    const program = await db.fundingProgram.create({ data: { organizationId: org.id, createdByUserId: user.id, name: "Evidence", slug: "evidence", status: "ACTIVE" } });
    const protocol = await createProtocolVersion(org.id, { name: "Actual instrument", indicators: [
      { key: "revenue", label: "Receita", valueType: "CURRENCY" }, { key: "headcount", label: "Equipe", valueType: "INTEGER" }, { key: "stage", label: "Estágio", valueType: "ENUM", allowedValues: ["IDEA", "MARKET"] },
    ] });
    const cohorts = await Promise.all(["Imported", "Native"].map((name) => db.cohort.create({ data: { organizationId: org.id, fundingProgramId: program.id, name, trackingProtocolVersionId: protocol.versions[0].id, status: "ACTIVE" } })));
    const enrollments = await Promise.all(cohorts.map(async (cohort) => Promise.all(Array.from({ length: 7 }, async (_, index) => {
      const venture = await db.venture.create({ data: { organizationId: org.id, name: `${cohort.name} ${index}`, kind: "COMPANY" } });
      return db.ventureEnrollment.create({ data: { organizationId: org.id, cohortId: cohort.id, ventureId: venture.id, enrolledAt: new Date("2023-01-01T00:00:00Z") } });
    }))));
    const waves = await Promise.all(cohorts.map(async (cohort) => {
      const wave = await createFollowUpWave(org.id, cohort.id, { name: "Baseline", kind: "BASELINE", sequence: 0, offsetMonths: 0, scheduledFor: new Date("2024-01-01T00:00:00Z") });
      return updateFollowUpWaveStatus(org.id, cohort.id, wave.id, "OPEN");
    }));
    const row = (index: number, key: string, value: string, overrides: Record<string, string> = {}) => ({ external_id: `o${index}`, venture_enrollment_id: enrollments[0][index].id, follow_up_wave_id: waves[0].id, indicator_key: key, value, status: "SUBMITTED", submitted_at: "2024-01-03T09:00:00-03:00", ...overrides });
    const contradictory = [row(2, "headcount", "1", { cohort_id: cohorts[0].id }), row(2, "revenue", "2.00", { cohort_id: cohorts[1].id })];
    for (const source of [contradictory, [...contradictory].reverse()]) {
      const rejected = await stage(source);
      assert.equal(rejected.status, "FAILED"); assert.equal(rejected.invalidRows, 2);
      assert.ok((await getImportBatch(user.id, org.id, rejected.id)).rows.every((item) => JSON.stringify(item.errors).includes("IMPORT_REFERENCE_AMBIGUOUS")));
      await assert.rejects(() => applyImportBatch(user.id, org.id, rejected.id, rejected.revision), /IMPORT_NOT_READY/);
    }
    assert.equal(await db.observationValue.count({ where: { organizationId: org.id, observation: { ventureEnrollmentId: enrollments[0][2].id } } }), 0);
    const original = await db.ventureObservation.findFirstOrThrow({ where: { organizationId: org.id, ventureEnrollmentId: enrollments[0][0].id, followUpWaveId: waves[0].id } });
    const ready = await stage([row(0, "revenue", "0.10"), row(0, "headcount", "0"), row(0, "stage", "MARKET"), row(1, "revenue", "", { missing: "true" }), row(1, "headcount", "2")]);
    assert.equal(ready.status, "READY", JSON.stringify((await getImportBatch(user.id, org.id, ready.id)).rows));
    const applied = await applyImportBatch(user.id, org.id, ready.id, ready.revision);
    assert.equal(applied.appliedRows, 5);
    const imported = await db.ventureObservation.findUniqueOrThrow({ where: { id: original.id }, include: { values: true } });
    assert.equal(imported.status, "SUBMITTED"); assert.equal(imported.submittedAt?.toISOString(), "2024-01-03T12:00:00.000Z"); assert.equal(imported.startedAt, null);
    assert.equal(imported.values.find((value) => value.indicatorDefinitionId === protocol.versions[0].indicators.find((indicator) => indicator.key === "headcount")!.id)?.integerValue, 0);
    const change = await db.importChange.findFirstOrThrow({ where: { organizationId: org.id, batchId: ready.id, entityId: original.id } });
    assert.equal(change.operation, "UPDATE"); assert.equal((change.beforeData as { status: string }).status, "PENDING");
    assert.equal(await db.externalReference.count({ where: { organizationId: org.id, createdByImportBatchId: ready.id } }), 2);
    for (let index = 0; index < 2; index++) {
      const native = await db.ventureObservation.findFirstOrThrow({ where: { organizationId: org.id, ventureEnrollmentId: enrollments[1][index].id, followUpWaveId: waves[1].id } });
      await saveObservationValues(org.id, native.id, { expectedRevision: native.revision, submit: true, values: protocol.versions[0].indicators.map((indicator) => ({ indicatorDefinitionId: indicator.id, value: indicator.key === "headcount" ? String(index * 2) : indicator.key === "revenue" ? index ? null : "0.10" : index ? null : "MARKET" })) });
    }
    const access = { userId: user.id, organizationId: org.id, role: "MANAGER" as const };
    const [historicalAnalytics, nativeAnalytics] = await Promise.all(cohorts.map((cohort) => getCohortAnalytics(access, cohort.id)));
    assert.deepEqual(historicalAnalytics.waves[0].coverage, nativeAnalytics.waves[0].coverage);
    assert.deepEqual(historicalAnalytics.waves[0].metrics, nativeAnalytics.waves[0].metrics);
    const replay = await stage([row(0, "revenue", "100")]); assert.equal(replay.status, "FAILED");
    assert.equal((await stage([row(2, "revenue", "0.001")])).status, "FAILED");
    assert.equal((await stage([row(2, "headcount", "1.1")])).status, "FAILED");
    assert.equal((await stage([row(2, "stage", "INVALID")])).status, "FAILED");
    assert.equal((await stage([row(2, "unknown", "1")])).status, "FAILED");
    assert.equal((await stage([row(2, "headcount", "1"), row(2, "headcount", "2")])).status, "FAILED");
    assert.equal((await stage([row(2, "headcount", "", { missing: "true" })])).status, "FAILED");
    assert.equal((await stage([row(2, "headcount", "1"), row(2, "revenue", "2.00", { submitted_at: "2024-02-01T00:00:00Z" })])).status, "FAILED");
    assert.equal((await stage([row(2, "headcount", "1"), row(3, "revenue", "2.00", { external_id: "o2" })])).status, "FAILED");
    assert.equal((await stage([row(2, "headcount", "1", { follow_up_wave_id: waves[1].id })])).status, "FAILED");
    const draft = await db.ventureObservation.findFirstOrThrow({ where: { organizationId: org.id, ventureEnrollmentId: enrollments[0][4].id, followUpWaveId: waves[0].id } });
    await saveObservationValues(org.id, draft.id, { expectedRevision: 0, submit: false, values: [{ indicatorDefinitionId: protocol.versions[0].indicators[0].id, value: "5.00" }] });
    assert.equal((await stage([row(4, "headcount", "1")])).status, "FAILED");
    await db.ventureEnrollment.update({ where: { id: enrollments[0][5].id }, data: { status: "WITHDRAWN", withdrawnAt: new Date("2024-01-01T00:00:00Z") } });
    assert.equal((await stage([row(5, "headcount", "1")])).status, "FAILED");
    await db.externalReference.createMany({ data: [
      { organizationId: org.id, namespace: "evidence", entityType: "COHORTS", externalId: "cohort", entityId: cohorts[0].id },
      { organizationId: org.id, namespace: "evidence", entityType: "VENTURES", externalId: "venture-6", entityId: enrollments[0][6].ventureId },
    ] });
    const alternative = { external_id: "offset-observation", cohort_external_id: "cohort", venture_external_id: "venture-6", wave_offset_months: "0", indicator_key: "headcount", value: "3", status: "SUBMITTED", submitted_at: "2024-01-03T00:00:00Z" };
    await db.ventureObservation.deleteMany({ where: { organizationId: org.id, ventureEnrollmentId: enrollments[0][6].id } });
    const offsetReady = await stage([alternative, { ...alternative, indicator_key: "revenue", value: "999999999999.99" }]);
    assert.equal(offsetReady.status, "READY");
    await applyImportBatch(user.id, org.id, offsetReady.id, offsetReady.revision);
    const createdEvidence = await db.ventureObservation.findFirstOrThrow({ where: { organizationId: org.id, ventureEnrollmentId: enrollments[0][6].id, followUpWaveId: waves[0].id }, include: { values: true } });
    assert.equal(createdEvidence.values.find((value) => value.decimalValue !== null)?.decimalValue?.toString(), "999999999999.99");
    assert.equal((await db.importChange.findFirstOrThrow({ where: { organizationId: org.id, batchId: offsetReady.id } })).operation, "CREATE");
    await createFollowUpWave(org.id, cohorts[0].id, { name: "Ambiguous timepoint", kind: "FOLLOW_UP", sequence: 2, offsetMonths: 0, scheduledFor: new Date("2024-02-01T00:00:00Z") });
    const ambiguous = await stage([{ ...alternative, external_id: "ambiguous-offset" }]);
    assert.equal(ambiguous.status, "FAILED");
    assert.ok((await getImportBatch(user.id, org.id, ambiguous.id)).rows.some((item) => JSON.stringify(item.errors).includes("IMPORT_OFFSET_AMBIGUOUS")));
  } finally { await db.organization.delete({ where: { id: org.id } }); await db.user.delete({ where: { id: user.id } }); }
});
