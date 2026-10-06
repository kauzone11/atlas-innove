import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { db } from "@/lib/db";
import { createProtocolVersion } from "@/lib/tracking-protocols/service";
import { archiveMetric, createMetric, listMetrics, mapIndicatorToMetric, updateMetric } from "./metrics";
import type { AnalyticsAccess } from "./access";

const databaseAvailable = Boolean(process.env.DATABASE_URL);
if (process.env.REQUIRE_DOMAIN_DATABASE === "true" && !databaseAvailable) throw new Error("DATABASE_URL is required for analytics integration tests in CI");

test("canonical identities preserve protocol history and enforce tenant, compatibility and role boundaries", async (context) => {
  if (!databaseAvailable) { context.skip("DATABASE_URL is not configured for the integration harness"); return; }
  const suffix = randomUUID().replaceAll("-", "");
  const user = await db.user.create({ data: { email: `metric-${suffix}@example.test`, passwordHash: "test-only" } });
  const [organizationA, organizationB] = await Promise.all(["a", "b"].map((name) => db.organization.create({ data: { name: `Metric ${name}`, slug: `metric-${name}-${suffix}` } })));
  const access: AnalyticsAccess = { organizationId: organizationA.id, userId: user.id, role: "OWNER" };
  try {
    await db.organizationMembership.create({ data: { organizationId: organizationA.id, userId: user.id, role: "MANAGER" } });
    const base = { name: "Metrics protocol", indicators: [{ key: "team", label: "Team", valueType: "INTEGER" as const, unit: "people" }, { key: "stage", label: "Stage", valueType: "ENUM" as const, allowedValues: ["Idea", "MVP"] }] };
    const initial = await createProtocolVersion(organizationA.id, base);
    const copied = await createProtocolVersion(organizationA.id, { ...base, protocolId: initial.id, indicators: [{ ...base.indicators[0], label: "Observed team" }, base.indicators[1]] });
    assert.equal(copied.versions[0].indicators[0].metricDefinitionId, initial.versions[0].indicators[0].metricDefinitionId);
    assert.equal(copied.versions[0].indicators[1].metricDefinitionId, initial.versions[0].indicators[1].metricDefinitionId);
    const changed = await createProtocolVersion(organizationA.id, { ...base, protocolId: initial.id, indicators: [{ ...base.indicators[0], unit: "FTE" }, { ...base.indicators[1], allowedValues: ["MVP", "Idea"] }] });
    assert.notEqual(changed.versions[0].indicators[0].metricDefinitionId, initial.versions[0].indicators[0].metricDefinitionId);
    assert.notEqual(changed.versions[0].indicators[1].metricDefinitionId, initial.versions[0].indicators[1].metricDefinitionId);
    const separate = await createProtocolVersion(organizationA.id, base);
    assert.notEqual(separate.versions[0].indicators[0].metricDefinitionId, initial.versions[0].indicators[0].metricDefinitionId);
    const teamMetricId = initial.versions[0].indicators[0].metricDefinitionId!;
    const manual = await createMetric(access, { key: "shared_team", label: "Observed team", valueType: "INTEGER", unit: "people", primaryAggregation: "TOTAL" });
    const indicatorId = initial.versions[0].indicators[0].id;
    await mapIndicatorToMetric(access, indicatorId, manual.id);
    await assert.rejects(() => mapIndicatorToMetric(access, initial.versions[0].indicators[1].id, manual.id), /METRIC_MAPPING_INCOMPATIBLE/);
    const otherMetric = await db.metricDefinition.create({ data: { organizationId: organizationB.id, key: "team", label: "Team", valueType: "INTEGER", unit: "people", primaryAggregation: "TOTAL" } });
    await assert.rejects(() => mapIndicatorToMetric(access, indicatorId, otherMetric.id), /METRIC_NOT_FOUND/);
    await assert.rejects(() => db.indicatorDefinition.update({ where: { id: indicatorId }, data: { metricDefinitionId: otherMetric.id } }));
    await assert.rejects(() => createProtocolVersion(organizationA.id, { ...base, indicators: [{ ...base.indicators[0], metricDefinitionId: otherMetric.id }] }), /METRIC_NOT_FOUND/);
    const explicit = await createProtocolVersion(organizationA.id, { ...base, indicators: [{ ...base.indicators[0], metricDefinitionId: manual.id }] });
    assert.equal(explicit.versions[0].indicators[0].metricDefinitionId, manual.id);
    await assert.rejects(() => createProtocolVersion(organizationA.id, { ...base, indicators: [{ ...base.indicators[0], metricDefinitionId: manual.id }, { ...base.indicators[0], key: "team_duplicate", metricDefinitionId: manual.id }] }), /METRIC_DUPLICATE_IN_VERSION/);

    const program = await db.fundingProgram.create({ data: { organizationId: organizationA.id, name: "Metric program", slug: `metric-${suffix}`, createdByUserId: user.id } });
    const cohort = await db.cohort.create({ data: { organizationId: organizationA.id, fundingProgramId: program.id, trackingProtocolVersionId: initial.versions[0].id, name: "Metric cohort" } });
    const venture = await db.venture.create({ data: { organizationId: organizationA.id, name: "Metric venture", kind: "PROJECT" } });
    const enrollment = await db.ventureEnrollment.create({ data: { organizationId: organizationA.id, cohortId: cohort.id, ventureId: venture.id } });
    const wave = await db.followUpWave.create({ data: { organizationId: organizationA.id, cohortId: cohort.id, name: "Baseline", sequence: 0, offsetMonths: 0, kind: "BASELINE" } });
    const observation = await db.ventureObservation.create({ data: { organizationId: organizationA.id, cohortId: cohort.id, followUpWaveId: wave.id, ventureEnrollmentId: enrollment.id, status: "IN_PROGRESS" } });
    await db.observationValue.create({ data: { organizationId: organizationA.id, observationId: observation.id, indicatorDefinitionId: indicatorId, integerValue: 0 } });
    await assert.rejects(() => mapIndicatorToMetric(access, indicatorId, teamMetricId), /METRIC_MAPPING_HISTORY_FROZEN/);
    await assert.rejects(() => mapIndicatorToMetric(access, indicatorId, null), /METRIC_MAPPING_HISTORY_FROZEN/);
    await assert.rejects(() => db.indicatorDefinition.update({ where: { id: indicatorId }, data: { metricDefinitionId: teamMetricId } }));
    await assert.rejects(() => updateMetric(access, manual.id, { key: "shared_team", label: "Observed team", valueType: "INTEGER", unit: "FTE", primaryAggregation: "TOTAL" }), /METRIC_HISTORY_FROZEN/);
    await assert.rejects(() => db.metricDefinition.update({ where: { id: manual.id }, data: { unit: "FTE" } }));
    await assert.rejects(() => archiveMetric(access, manual.id), /METRIC_IN_USE/);
    const unused = await createMetric(access, { key: "unused", label: "Unused", valueType: "CURRENCY", unit: "BRL", primaryAggregation: "MEDIAN" });
    await archiveMetric(access, unused.id);
    const listing = await listMetrics(access);
    assert.equal(listing.metrics.find((metric) => metric.id === manual.id)?.indicators.find((indicator) => indicator.id === indicatorId)?.hasObservations, true);
    assert.ok(listing.metrics.find((metric) => metric.id === unused.id)?.archivedAt);
    await db.organizationMembership.update({ where: { organizationId_userId: { organizationId: organizationA.id, userId: user.id } }, data: { role: "ANALYST" } });
    await listMetrics(access);
    await assert.rejects(() => createMetric(access, { key: "forbidden", label: "Forbidden", valueType: "INTEGER", primaryAggregation: "TOTAL" }), /ROLE_FORBIDDEN/);
    await db.organizationMembership.update({ where: { organizationId_userId: { organizationId: organizationA.id, userId: user.id } }, data: { role: "VIEWER" } });
    await assert.rejects(() => listMetrics(access), /ROLE_FORBIDDEN/);
    await db.organizationMembership.update({ where: { organizationId_userId: { organizationId: organizationA.id, userId: user.id } }, data: { role: "MANAGER", status: "DISABLED" } });
    await assert.rejects(() => listMetrics(access), /MEMBERSHIP_DISABLED/);
  } finally {
    await db.organization.delete({ where: { id: organizationA.id } });
    await db.organization.delete({ where: { id: organizationB.id } });
    await db.user.delete({ where: { id: user.id } });
  }
});
