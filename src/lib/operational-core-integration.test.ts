import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { db } from "@/lib/db";
import { createCohort, updateCohort } from "@/lib/cohorts/service";
import { createFundingCall, updateFundingCall, addFundingCallDocument } from "@/lib/funding-calls/service";
import { createFundingCallSchema, updateFundingCallSchema } from "@/lib/funding-calls/schemas";
import { createProtocolVersion } from "@/lib/tracking-protocols/service";
import { createProtocolVersionSchema } from "@/lib/tracking-protocols/schemas";
import { createFollowUpWave, updateFollowUpWaveStatus } from "@/lib/follow-up/service";
import { getObservationWorkspace, saveObservationValues } from "@/lib/observations/service";
import { getCohortResults, getVentureTrajectory } from "@/lib/monitoring/read-model";
import { createVentureMilestone } from "@/lib/milestones/service";
import { enrollVenture, withdrawEnrollment } from "@/lib/ventures/service";
import { updateFundingProgram } from "@/lib/programs/service";

test("operational core preserves tenant, frozen methodology, values, concurrency and history", async (context) => {
  if (!process.env.DATABASE_URL) { context.skip("DATABASE_URL is required for PostgreSQL proof"); return; }
  const suffix = randomUUID().slice(0, 8);
  const user = await db.user.create({ data: { email: `core-${suffix}@example.test`, passwordHash: "test-only" } });
  const organizations = await Promise.all(["a", "b"].map((key) => db.organization.create({ data: { name: `Core ${key}`, slug: `core-${key}-${suffix}` } })));
  const [orgA, orgB] = organizations;
  try {
    const [programA, programB] = await Promise.all(organizations.map((org) => db.fundingProgram.create({ data: { organizationId: org.id, createdByUserId: user.id, name: "Longitudinal support", slug: `support-${suffix}` } })));
    const draftCall = await createFundingCall(orgA.id, programA.id, createFundingCallSchema.parse({ title: "Unpublished call", callNumber: "draft" }));
    assert.equal(draftCall.sourceUrl, null);
    assert.equal(draftCall.sourceCheckedAt, null);
    const sourcedCall = await updateFundingCall(orgA.id, programA.id, draftCall.id, updateFundingCallSchema.parse({ sourceUrl: "https://example.test/new-publication" }));
    assert.ok(sourcedCall.sourceCheckedAt);
    const clearedCall = await updateFundingCall(orgA.id, programA.id, draftCall.id, updateFundingCallSchema.parse({ sourceUrl: null }));
    assert.equal(clearedCall.sourceUrl, null);
    assert.equal(clearedCall.sourceCheckedAt, null);
    const call = await createFundingCall(orgA.id, programA.id, createFundingCallSchema.parse({ title: "Funding cycle", callNumber: "01/2026", sourceUrl: "https://example.test/call", totalBudget: "0" }));
    assert.equal(call.totalBudget, "0.00");
    const withDocument = await addFundingCallDocument(orgA.id, programA.id, call.id, { title: "Official notice", externalUrl: "https://example.test/notice.pdf", type: "NOTICE" });
    assert.equal(withDocument.documents.length, 1);
    await assert.rejects(() => createFundingCall(orgA.id, programB.id, createFundingCallSchema.parse({ title: "Invalid call", callNumber: "other", sourceUrl: "https://example.test" })), /FUNDING_PROGRAM_NOT_FOUND/);

    const protocolInput = createProtocolVersionSchema.parse({ name: "Venture progress", indicators: [
      { key: "headcount", label: "Tamanho da equipe", valueType: "INTEGER", unit: "pessoas" },
      { key: "revenue", label: "Faturamento", valueType: "CURRENCY", unit: "BRL" },
      { key: "stage", label: "Estágio", valueType: "ENUM", allowedValues: ["Protótipo", "Mercado"] },
    ] });
    const protocol = await createProtocolVersion(orgA.id, protocolInput);
    const firstVersion = protocol.versions[0];
    const indicators = Object.fromEntries(firstVersion.indicators.map((indicator) => [indicator.key, indicator.id]));
    const cohort = await createCohort(orgA.id, programA.id, { name: "Comparable cohort", status: "ACTIVE", fundingCallId: call.id, trackingProtocolVersionId: firstVersion.id });
    await assert.rejects(() => createCohort(orgB.id, programB.id, { name: "Invalid link", status: "ACTIVE", fundingCallId: call.id }), /FUNDING_CALL_NOT_FOUND/);
    const ventures = await Promise.all(["Zero", "Missing"].map((name) => db.venture.create({ data: { organizationId: orgA.id, name, kind: "COMPANY" } })));
    const enrollments = await Promise.all(ventures.map((venture) => enrollVenture(orgA.id, cohort.id, { ventureId: venture.id, enrolledAt: new Date("2026-01-01T00:00:00Z") })));
    const baseline = await createFollowUpWave(orgA.id, cohort.id, { name: "Baseline", kind: "BASELINE", sequence: 0, offsetMonths: 0, scheduledFor: new Date("2026-06-01T00:00:00Z") });
    await updateFollowUpWaveStatus(orgA.id, cohort.id, baseline.id, "OPEN");
    const newerProtocol = await createProtocolVersion(orgA.id, { ...protocolInput, protocolId: protocol.id, label: "Second version" });
    assert.equal(newerProtocol.versions[0].version, 2);
    await assert.rejects(() => updateCohort(orgA.id, cohort.id, { trackingProtocolVersionId: newerProtocol.versions[0].id }), /COHORT_PROTOCOL_FROZEN/);
    await assert.rejects(() => db.indicatorDefinition.updateMany({ where: { organizationId: orgA.id, id: indicators.headcount }, data: { label: "Historical overwrite" } }));
    assert.equal((await db.cohort.findFirst({ where: { organizationId: orgA.id, id: cohort.id } }))?.trackingProtocolVersionId, firstVersion.id);
    const observations = await db.ventureObservation.findMany({ where: { organizationId: orgA.id, followUpWaveId: baseline.id }, orderBy: { ventureEnrollmentId: "asc" } });
    const zeroObservation = observations.find((observation) => observation.ventureEnrollmentId === enrollments[0].id)!;
    const missingObservation = observations.find((observation) => observation.ventureEnrollmentId === enrollments[1].id)!;
    const zeroValues = [{ indicatorDefinitionId: indicators.headcount, value: "0" }, { indicatorDefinitionId: indicators.revenue, value: "0.00" }, { indicatorDefinitionId: indicators.stage, value: "Mercado" }];
    assert.equal(await getObservationWorkspace(orgB.id, zeroObservation.id), null);
    await assert.rejects(() => saveObservationValues(orgA.id, zeroObservation.id, { expectedRevision: 0, submit: false, values: [{ indicatorDefinitionId: newerProtocol.versions[0].indicators[0].id, value: "3" }] }), /OBSERVATION_INDICATOR_VERSION_MISMATCH/);
    await assert.rejects(() => saveObservationValues(orgA.id, zeroObservation.id, { expectedRevision: 0, submit: false, values: [{ indicatorDefinitionId: indicators.stage, value: "Unknown" }] }), /OBSERVATION_ENUM_INVALID/);
    await assert.rejects(() => saveObservationValues(orgA.id, zeroObservation.id, { expectedRevision: 0, submit: false, values: [{ indicatorDefinitionId: indicators.headcount, value: "1.5" }] }), /OBSERVATION_INTEGER_INVALID/);
    await assert.rejects(() => saveObservationValues(orgA.id, zeroObservation.id, { expectedRevision: 0, submit: false, values: [{ indicatorDefinitionId: indicators.revenue, value: "1.001" }] }), /OBSERVATION_CURRENCY_INVALID/);
    await assert.rejects(() => saveObservationValues(orgA.id, zeroObservation.id, { expectedRevision: 0, submit: false, values: [...zeroValues, zeroValues[0]] }), /OBSERVATION_INDICATOR_DUPLICATE/);
    const concurrent = await Promise.allSettled([1, 2].map(() => saveObservationValues(orgA.id, zeroObservation.id, { expectedRevision: 0, submit: false, values: zeroValues })));
    assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 1);
    assert.match(String((concurrent.find((result) => result.status === "rejected") as PromiseRejectedResult).reason), /OBSERVATION_REVISION_CONFLICT/);
    await saveObservationValues(orgA.id, zeroObservation.id, { expectedRevision: 1, submit: true, values: zeroValues });
    await assert.rejects(() => saveObservationValues(orgA.id, zeroObservation.id, { expectedRevision: 2, submit: false, values: zeroValues }), /OBSERVATION_SUBMITTED/);
    await saveObservationValues(orgA.id, missingObservation.id, { expectedRevision: 0, submit: true, values: [{ indicatorDefinitionId: indicators.headcount, value: null }, { indicatorDefinitionId: indicators.stage, value: "Protótipo" }] });
    const results = await getCohortResults(orgA.id, cohort.id);
    const headcount = results!.waves[0].indicators.find((indicator) => indicator.id === indicators.headcount);
    assert.equal(headcount?.validCount, 1);
    assert.equal(headcount?.sum, 0);
    assert.equal(headcount?.mean, 0);
    assert.equal(results!.waves[0].coverage.submitted, 2);
    assert.equal(await getCohortResults(orgB.id, cohort.id), null);
    await createVentureMilestone(orgA.id, ventures[0].id, { type: "FIRST_CUSTOMER", title: "Primeiro cliente", occurredAt: new Date("2026-06-01T00:00:00Z") });
    const trajectory = await getVentureTrajectory(orgA.id, ventures[0].id);
    assert.equal(trajectory.length, 1);
    await withdrawEnrollment(orgA.id, cohort.id, enrollments[0].id);
    assert.equal((await getCohortResults(orgA.id, cohort.id))!.waves[0].coverage.submitted, 2);
    const followUp = await createFollowUpWave(orgA.id, cohort.id, { name: "6 meses", kind: "FOLLOW_UP", sequence: 1, offsetMonths: 6, scheduledFor: new Date("2027-06-01T00:00:00Z") });
    assert.equal(followUp.observationCounts.expected, 1);
    await updateFollowUpWaveStatus(orgA.id, cohort.id, baseline.id, "CLOSED");
    await updateFollowUpWaveStatus(orgA.id, cohort.id, baseline.id, "ARCHIVED");
    await assert.rejects(() => updateFollowUpWaveStatus(orgA.id, cohort.id, baseline.id, "OPEN"), /WAVE_STATUS_TRANSITION_INVALID/);
    await updateFundingProgram(orgA.id, programA.id, { status: "ARCHIVED" });
    await assert.rejects(() => updateFundingProgram(orgA.id, programA.id, { status: "ACTIVE" }), /FUNDING_PROGRAM_ARCHIVED/);
  } finally {
    await db.cohort.deleteMany({ where: { organizationId: { in: organizations.map((org) => org.id) } } });
    for (const org of organizations) await db.organization.delete({ where: { id: org.id } });
    await db.user.delete({ where: { id: user.id } });
  }
});
