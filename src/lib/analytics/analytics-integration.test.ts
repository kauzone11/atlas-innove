import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { db } from "@/lib/db";
import { createProtocolVersion } from "@/lib/tracking-protocols/service";
import { createFollowUpWave, updateFollowUpWaveStatus } from "@/lib/follow-up/service";
import { saveObservationValues } from "@/lib/observations/service";
import { enrollVenture } from "@/lib/ventures/service";
import { compareCohortAnalytics, getCohortAnalytics, getDataQuality, getMetricEvidence, getPortfolioAnalytics, getAnalyticsSourceDigest, getPairedCohortAnalysis } from "@/lib/analytics/read-model";
import type { AnalyticsAccess } from "@/lib/analytics/access";

if (process.env.REQUIRE_DOMAIN_DATABASE === "true" && !process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for analytics integration tests");

test("analytical queries preserve exact truth, historical eligibility, canonical comparison and fresh authorization", async (context) => {
  if (!process.env.DATABASE_URL) { context.skip("DATABASE_URL is not configured"); return; }
  const suffix = randomUUID().slice(0, 8);
  const user = await db.user.create({ data: { email: `analytics-${suffix}@example.test`, passwordHash: "test-only" } });
  const org = await db.organization.create({ data: { name: "Analytics institution", slug: `analytics-${suffix}` } });
  const other = await db.organization.create({ data: { name: "Other institution", slug: `analytics-other-${suffix}` } });
  const access: AnalyticsAccess = { organizationId: org.id, userId: user.id, role: "OWNER" };
  try {
    await db.organizationMembership.create({ data: { organizationId: org.id, userId: user.id, role: "MANAGER" } });
    const program = await db.fundingProgram.create({ data: { organizationId: org.id, createdByUserId: user.id, name: "Analytical program", slug: "analytical", status: "ACTIVE" } });
    const otherProgram = await db.fundingProgram.create({ data: { organizationId: other.id, createdByUserId: user.id, name: "Private program", slug: "private" } });
    const input = { name: "Tracking evidence", indicators: [{ key: "revenue", label: "Receita mensal", valueType: "CURRENCY" as const, unit: "R$" }, { key: "team", label: "Equipe", valueType: "INTEGER" as const }] };
    const first = await createProtocolVersion(org.id, input);
    const second = await createProtocolVersion(org.id, { ...input, protocolId: first.id });
    const [a, b] = await Promise.all([first.versions[0], second.versions[0]].map((version, index) => db.cohort.create({ data: { organizationId: org.id, fundingProgramId: program.id, trackingProtocolVersionId: version.id, name: `Cohort ${index}`, status: "ACTIVE" } })));
    const enrollments: { id: string }[] = [];
    for (let index = 0; index < 4; index++) {
      const venture = await db.venture.create({ data: { organizationId: org.id, name: `Observed venture ${index}`, kind: "COMPANY" } });
      const enrollment = await enrollVenture(org.id, a.id, { ventureId: venture.id, externalReference: null });
      await db.ventureEnrollment.update({ where: { id: enrollment.id }, data: { enrolledAt: new Date("2026-01-01T00:00:00Z") } });
      enrollments.push(enrollment);
    }
    const wave = async (cohortId: string, sequence: number, offsetMonths: number | null, date: string) => {
      const created = await createFollowUpWave(org.id, cohortId, { name: `Wave ${sequence}`, kind: sequence === 0 ? "BASELINE" : "FOLLOW_UP", sequence, offsetMonths, scheduledFor: new Date(`${date}T00:00:00Z`) });
      return updateFollowUpWaveStatus(org.id, cohortId, created.id, "OPEN");
    };
    const baseline = await wave(a.id, 0, 0, "2026-01-01");
    const followup = await wave(a.id, 1, 6, "2026-07-01");
    const bFollowup = await wave(b.id, 7, 6, "2026-07-01");
    const moneyIndicator = first.versions[0].indicators.find((indicator) => indicator.key === "revenue")!;
    const teamIndicator = first.versions[0].indicators.find((indicator) => indicator.key === "team")!;
    const submit = async (waveId: string, enrollmentId: string, money: string | null, team: string | null, submitted = true) => {
      const observation = await db.ventureObservation.findFirstOrThrow({ where: { organizationId: org.id, followUpWaveId: waveId, ventureEnrollmentId: enrollmentId }, select: { id: true, revision: true } });
      return saveObservationValues(org.id, observation.id, { expectedRevision: observation.revision, submit: submitted, values: [{ indicatorDefinitionId: moneyIndicator.id, value: money }, { indicatorDefinitionId: teamIndicator.id, value: team }] });
    };
    await submit(baseline.id, enrollments[0].id, "0.10", "0");
    await submit(baseline.id, enrollments[1].id, "0.20", "2");
    await submit(baseline.id, enrollments[2].id, "0.00", "3");
    await submit(baseline.id, enrollments[3].id, "999.99", "99", false);
    await submit(followup.id, enrollments[0].id, "0.30", "1");
    await submit(followup.id, enrollments[1].id, null, "5");
    await db.ventureEnrollment.update({ where: { id: enrollments[2].id }, data: { status: "WITHDRAWN", withdrawnAt: new Date("2026-05-01T00:00:00Z") } });
    await context.test("coverage is historical and money excludes drafts and missing metrics", async () => {
      const cohort = await getCohortAnalytics(access, a.id);
      assert.equal(cohort.waves[0].coverage.expected, 4); assert.equal(cohort.waves[0].coverage.submitted, 3);
      assert.equal(cohort.waves[0].metrics.find((metric) => metric.metricId === moneyIndicator.metricDefinitionId)?.sum, "0.3");
      assert.equal(cohort.waves[1].coverage.expected, 3); assert.equal(cohort.waves[1].coverage.notEligible, 1); assert.equal(cohort.waves[1].coverage.withdrawn, 1);
      const followupMoney = cohort.waves[1].metrics.find((metric) => metric.metricId === moneyIndicator.metricDefinitionId)!;
      assert.equal(followupMoney.validCount, 1); assert.equal(followupMoney.missingCount, 1); assert.equal(followupMoney.sum, "0.3");
      const pair = cohort.paired.find((metric) => metric.metricId === moneyIndicator.metricDefinitionId)!;
      assert.equal(pair.pairedCount, 1); assert.equal(pair.meanAbsoluteChange, "0.2");
      const reverse = await getPairedCohortAnalysis(access, a.id, followup.id, baseline.id);
      assert.equal(reverse.paired.find((metric) => metric.metricId === moneyIndicator.metricDefinitionId)?.meanAbsoluteChange, "-0.2");
    });
    await context.test("protocol version differences compare only canonical metric and exact offset", async () => {
      assert.equal(second.versions[0].indicators.find((indicator) => indicator.key === "revenue")?.metricDefinitionId, moneyIndicator.metricDefinitionId);
      const comparison = await compareCohortAnalytics(access, { cohortIds: [a.id, b.id], metricId: moneyIndicator.metricDefinitionId!, offsetMonths: [6] });
      assert.deepEqual(comparison.cells.map((cell) => cell.status), ["READY", "READY"]);
      assert.equal(comparison.cells[1].waveId, bFollowup.id); assert.equal(comparison.cells[1].aggregate?.sum, null);
      await wave(b.id, 8, null, "2026-08-01");
      assert.equal((await compareCohortAnalytics(access, { cohortIds: [a.id, b.id], metricId: moneyIndicator.metricDefinitionId!, offsetMonths: [12] })).cells[1].status, "MISSING_OFFSET");
      await wave(b.id, 9, 6, "2026-09-01");
      assert.equal((await compareCohortAnalytics(access, { cohortIds: [a.id, b.id], metricId: moneyIndicator.metricDefinitionId!, offsetMonths: [6] })).cells[1].status, "AMBIGUOUS_OFFSET");
      const quality = await getDataQuality(access);
      assert.equal(quality.missingOffsets, 1); assert.equal(quality.ambiguousTimepoints, 1); assert.ok(quality.eligibleWithoutSubmission > 0);
    });
    await context.test("evidence is paginated, contributing rows reproduce n and missing rows explain absence", async () => {
      const evidence = await getMetricEvidence(access, { cohortId: a.id, waveId: followup.id, metricId: moneyIndicator.metricDefinitionId! });
      assert.equal(evidence.total, 1); assert.equal(evidence.rows[0].value, "0.3"); assert.ok(evidence.rows[0].observationId);
      const missing = await getMetricEvidence(access, { cohortId: a.id, waveId: followup.id, metricId: moneyIndicator.metricDefinitionId!, missing: true });
      assert.equal(missing.total, 2); assert.equal(missing.rows.every((row) => row.value === null), true);
    });
    await context.test("scope digests respond to relevant source changes and ignore another institution", async () => {
      const before = await getAnalyticsSourceDigest(access, { cohortId: a.id }, db, "COHORT");
      await db.fundingProgram.update({ where: { id: otherProgram.id }, data: { name: "Changed private program" } });
      assert.equal(await getAnalyticsSourceDigest(access, { cohortId: a.id }, db, "COHORT"), before);
      await submit(followup.id, enrollments[3].id, "0.40", "2");
      assert.notEqual(await getAnalyticsSourceDigest(access, { cohortId: a.id }, db, "COHORT"), before);
      await assert.rejects(() => getPortfolioAnalytics(access, { programId: otherProgram.id }), /FUNDING_PROGRAM_NOT_FOUND/);
    });
    await context.test("missing evidence includes historically eligible enrollments without an observation", async () => {
      await updateFollowUpWaveStatus(org.id, a.id, followup.id, "CLOSED");
      await updateFollowUpWaveStatus(org.id, a.id, baseline.id, "CLOSED");
      const venture = await db.venture.create({ data: { organizationId: org.id, name: "Backdated venture", kind: "COMPANY" } });
      const enrollment = await enrollVenture(org.id, a.id, { ventureId: venture.id, externalReference: null });
      await db.ventureEnrollment.update({ where: { id: enrollment.id }, data: { enrolledAt: new Date("2026-01-01T00:00:00Z") } });
      assert.equal(await db.ventureObservation.count({ where: { organizationId: org.id, ventureEnrollmentId: enrollment.id } }), 0);
      const missing = await getMetricEvidence(access, { cohortId: a.id, waveId: followup.id, metricId: moneyIndicator.metricDefinitionId!, missing: true });
      assert.equal(missing.total, 2);
      assert.deepEqual(missing.rows.find((row) => row.ventureId === venture.id)?.observationId, null);
      assert.equal((await getCohortAnalytics(access, a.id)).waves.find((entry) => entry.id === followup.id)?.coverage.expected, 4);
    });
    await context.test("authorization uses live membership and role rather than access object", async () => {
      await db.organizationMembership.update({ where: { organizationId_userId: { organizationId: org.id, userId: user.id } }, data: { role: "VIEWER" } });
      await getPortfolioAnalytics(access);
      await assert.rejects(() => getMetricEvidence(access, { cohortId: a.id, waveId: baseline.id, metricId: moneyIndicator.metricDefinitionId! }), /ROLE_FORBIDDEN/);
      await db.organizationMembership.update({ where: { organizationId_userId: { organizationId: org.id, userId: user.id } }, data: { status: "DISABLED" } });
      await assert.rejects(() => getCohortAnalytics(access, a.id), /MEMBERSHIP_DISABLED/);
    });
  } finally {
    await db.organization.delete({ where: { id: org.id } });
    await db.organization.delete({ where: { id: other.id } });
    await db.user.delete({ where: { id: user.id } });
  }
});
