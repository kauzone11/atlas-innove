import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import { calendarToday, deriveObligationState } from "@/lib/execution/state";
import { ExactDecimal } from "@/lib/analytics/aggregates";
import { assertAnalyticsAccess, type AnalyticsAccess } from "@/lib/analytics/access";
import { getCohortAnalytics, metricFrom, metricSelect } from "@/lib/analytics/cohort";
import { resolveComparableWave } from "@/lib/analytics/comparability";
import { analyticsCallWhere, analyticsCohortWhere, resolveAnalyticsScope } from "@/lib/analytics/scope";
import type { AnalyticsFilters, DataQualityAnalytics, PortfolioAnalytics, ProgramAnalytics } from "@/lib/analytics/types";
export { getCohortAnalytics, getPairedCohortAnalysis } from "@/lib/analytics/cohort";
export { getMetricEvidence } from "@/lib/analytics/evidence";
export { getAnalyticsSourceDigest } from "@/lib/analytics/source-digest";

async function scopedCohorts(access: AnalyticsAccess, filters: AnalyticsFilters, client: Prisma.TransactionClient) {
  const scope = await resolveAnalyticsScope(client, access.organizationId, filters);
  const where = analyticsCohortWhere(access.organizationId, scope);
  if (await client.cohort.count({ where }) > 100 || await client.ventureObservation.count({ where: { organizationId: access.organizationId, cohort: where } }) > 50000 || await client.observationValue.count({ where: { organizationId: access.organizationId, observation: { organizationId: access.organizationId, cohort: where } } }) > 50000) throw new DomainConflictError("ANALYTICS_SCOPE_TOO_LARGE");
  const records = await client.cohort.findMany({ where, orderBy: { name: "asc" }, select: { id: true } });
  const cohorts = [];
  for (const record of records) {
    const cohort = await getCohortAnalytics(access, record.id, client);
    cohorts.push(scope.metricId ? { ...cohort, waves: cohort.waves.map((wave) => ({ ...wave, metrics: wave.metrics.filter((metric) => metric.metricId === scope.metricId) })), paired: cohort.paired.filter((metric) => metric.metricId === scope.metricId) } : cohort);
  }
  return { scope, cohorts };
}

async function buildPortfolioAnalytics(access: AnalyticsAccess, filters: AnalyticsFilters, client: Prisma.TransactionClient, includeOutcomes: boolean): Promise<PortfolioAnalytics> {
  const { organizationId } = await assertAnalyticsAccess(access, undefined, client);
  const { scope, cohorts } = includeOutcomes ? await scopedCohorts(access, filters, client) : { scope: await resolveAnalyticsScope(client, organizationId, filters), cohorts: [] };
  const callWhere = analyticsCallWhere(organizationId, scope);
  const awardWhere: Prisma.AwardWhereInput = { organizationId, fundingCall: callWhere, ...(scope.cohortId ? { enrollments: { some: { organizationId, cohortId: scope.cohortId } } } : {}) };
  const [calls, programs, awardCount] = await Promise.all([
    client.fundingCall.findMany({ where: callWhere, select: { id: true, fundingProgramId: true, applicationsEnabled: true } }),
    client.fundingProgram.findMany({ where: { organizationId, ...(scope.programId ? { id: scope.programId } : {}), ...(scope.year !== null ? { fundingCalls: { some: callWhere } } : {}) }, select: { id: true, name: true, status: true }, orderBy: { name: "asc" } }),
    client.award.count({ where: awardWhere }),
  ]);
  if (awardCount > 10000 || calls.length > 500 || programs.length > 100) throw new DomainConflictError("ANALYTICS_SCOPE_TOO_LARGE");
  const [obligationCount, disbursementCount, submissionCount] = await Promise.all([
    client.awardObligation.count({ where: { organizationId, award: awardWhere } }),
    client.awardDisbursement.count({ where: { organizationId, award: awardWhere } }),
    client.awardSubmission.count({ where: { organizationId, obligation: { award: awardWhere }, status: "SUBMITTED" } }),
  ]);
  if (obligationCount > 10000 || disbursementCount > 10000 || submissionCount > 50000) throw new DomainConflictError("ANALYTICS_SCOPE_TOO_LARGE");
  const awards = await client.award.findMany({ where: awardWhere, select: {
    id: true, status: true, approvedAmount: true, application: { select: { projectId: true } }, fundingCall: { select: { fundingProgramId: true } },
    disbursements: { where: { organizationId }, select: { status: true, amount: true } },
    obligations: { where: { organizationId }, select: { required: true, waivedAt: true, dueAt: true, submissions: { where: { organizationId, status: "SUBMITTED" }, orderBy: { version: "desc" }, select: { status: true, reviewStatus: true } } } },
  } });
  const applicationWhere: Prisma.ApplicationWhereInput = { organizationId, fundingCall: { ...callWhere, applicationsEnabled: true }, ...(scope.cohortId ? { enrollments: { some: { organizationId, cohortId: scope.cohortId } } } : {}) };
  const observedCalls = calls.filter((call) => call.applicationsEnabled).length;
  const [submitted, withdrawn, evaluated, selected, enrollments, milestoneGroups] = await Promise.all([
    client.application.count({ where: { ...applicationWhere, submittedAt: { not: null } } }),
    client.application.count({ where: { ...applicationWhere, withdrawnAt: { not: null } } }),
    client.application.count({ where: { ...applicationWhere, evaluations: { some: { organizationId, status: "SUBMITTED" } } } }),
    client.application.count({ where: { ...applicationWhere, decision: "SELECTED", withdrawnAt: null } }),
    includeOutcomes ? client.ventureEnrollment.findMany({ where: { organizationId, cohort: analyticsCohortWhere(organizationId, scope) }, select: { ventureId: true, cohort: { select: { fundingProgramId: true } } } }) : Promise.resolve([]),
    includeOutcomes ? client.milestone.groupBy({ by: ["type"], where: { organizationId, venture: { enrollments: { some: { organizationId, cohort: analyticsCohortWhere(organizationId, scope) } } } }, _count: { _all: true } }) : Promise.resolve([]),
  ]);
  const approved = awards.flatMap((award) => award.approvedAmount === null ? [] : [award.approvedAmount]);
  const planned = awards.flatMap((award) => award.disbursements.filter((entry) => entry.status === "PLANNED").map((entry) => entry.amount));
  const paid = awards.flatMap((award) => award.disbursements.filter((entry) => entry.status === "PAID").map((entry) => entry.amount));
  const moneySum = (values: Prisma.Decimal[]) => values.length ? values.reduce((total, value) => total.add(value), new ExactDecimal(0)).toString() : null;
  const obligations = awards.flatMap((award) => award.obligations.map((obligation) => ({ ...obligation, active: ["ACTIVE", "SUSPENDED"].includes(award.status), state: deriveObligationState({ ...obligation, dueAt: obligation.dueAt?.toISOString().slice(0, 10) ?? null }, calendarToday()) })));
  return {
    scope,
    programs: programs.map((program) => ({ ...program, calls: calls.filter((call) => call.fundingProgramId === program.id).length, cohorts: cohorts.filter((cohort) => cohort.programId === program.id).length, trackedVentures: new Set(enrollments.filter((entry) => entry.cohort.fundingProgramId === program.id).map((entry) => entry.ventureId)).size, activeAwards: awards.filter((award) => award.fundingCall.fundingProgramId === program.id && award.status === "ACTIVE").length })),
    calls: { total: calls.length, applicationsObserved: observedCalls, submitted: observedCalls ? submitted : null, withdrawn: observedCalls ? withdrawn : null, evaluated: observedCalls ? evaluated : null, selected: observedCalls ? selected : null },
    execution: {
      awards: awards.length, byStatus: ["PREPARING", "ACTIVE", "SUSPENDED", "COMPLETED", "TERMINATED", "CANCELLED"].map((status) => ({ status, count: awards.filter((award) => award.status === status).length })),
      financial: { approved: moneySum(approved), planned: moneySum(planned), paid: moneySum(paid), approvedCount: new Set(awards.filter((award) => award.approvedAmount !== null).map((award) => award.application.projectId)).size, plannedCount: new Set(awards.filter((award) => award.disbursements.some((entry) => entry.status === "PLANNED")).map((award) => award.application.projectId)).size, paidCount: new Set(awards.filter((award) => award.disbursements.some((entry) => entry.status === "PAID")).map((award) => award.application.projectId)).size },
      requiredObligations: obligations.filter((entry) => entry.required).length, approvedObligations: obligations.filter((entry) => entry.state === "APPROVED").length,
      overdueObligations: obligations.filter((entry) => entry.active && entry.state === "OVERDUE").length, pendingReviews: obligations.filter((entry) => entry.active && entry.state === "SUBMITTED").length,
    },
    cohorts, monitoring: { expected: cohorts.reduce((sum, cohort) => sum + cohort.waves.reduce((n, wave) => n + wave.coverage.expected, 0), 0), submitted: cohorts.reduce((sum, cohort) => sum + cohort.waves.reduce((n, wave) => n + wave.coverage.submitted, 0), 0) },
    trackedVentures: new Set(enrollments.map((entry) => entry.ventureId)).size, milestones: milestoneGroups.map((group) => ({ type: group.type, count: group._count._all })),
  };
}

export async function getPortfolioAnalytics(access: AnalyticsAccess, filters: AnalyticsFilters = {}, client: Prisma.TransactionClient = db) {
  return buildPortfolioAnalytics(access, filters, client, true);
}

export async function getExecutionAnalytics(access: AnalyticsAccess, filters: AnalyticsFilters = {}, client: Prisma.TransactionClient = db) {
  const result = await buildPortfolioAnalytics(access, filters, client, false);
  return { execution: result.execution, calls: result.calls, programCount: result.programs.length };
}

export async function getProgramAnalytics(access: AnalyticsAccess, programId: string, client: Prisma.TransactionClient = db): Promise<ProgramAnalytics> {
  await assertAnalyticsAccess(access, undefined, client);
  const program = await client.fundingProgram.findFirst({ where: { organizationId: access.organizationId, id: programId }, select: { id: true, name: true, status: true, description: true } });
  if (!program) throw new ResourceNotFoundError("FUNDING_PROGRAM_NOT_FOUND");
  return { ...await getPortfolioAnalytics(access, { programId }, client), program };
}

export async function getDataQuality(access: AnalyticsAccess, filters: AnalyticsFilters = {}, client: Prisma.TransactionClient = db): Promise<DataQualityAnalytics> {
  await assertAnalyticsAccess(access, undefined, client);
  const { scope, cohorts } = await scopedCohorts(access, filters, client);
  const waves = cohorts.flatMap((cohort) => cohort.waves);
  return {
    scope, cohorts, unmappedIndicators: cohorts.reduce((sum, cohort) => sum + cohort.quality.unmappedIndicators, 0), missingOffsets: cohorts.reduce((sum, cohort) => sum + cohort.quality.missingOffsets, 0), ambiguousTimepoints: cohorts.reduce((sum, cohort) => sum + cohort.quality.ambiguousOffsets.length, 0),
    eligibleWithoutSubmission: waves.reduce((sum, wave) => sum + wave.coverage.expected - wave.coverage.submitted, 0), submittedWithoutMetricValue: waves.reduce((sum, wave) => sum + wave.metrics.reduce((n, metric) => n + metric.missingCount, 0), 0), withdrawn: waves.reduce((sum, wave) => sum + wave.coverage.withdrawn, 0),
  };
}

export async function getAnalyticsChoices(access: AnalyticsAccess, client: Prisma.TransactionClient = db) {
  const { organizationId } = await assertAnalyticsAccess(access, undefined, client);
  const [programs, calls, cohorts, metrics, waves] = await Promise.all([
    client.fundingProgram.findMany({ where: { organizationId }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 101 }),
    client.fundingCall.findMany({ where: { organizationId }, select: { id: true, title: true, fundingProgramId: true }, orderBy: { title: "asc" }, take: 501 }),
    client.cohort.findMany({ where: { organizationId }, select: { id: true, name: true, fundingProgramId: true, fundingCallId: true }, orderBy: { name: "asc" }, take: 101 }),
    client.metricDefinition.findMany({ where: { organizationId, archivedAt: null }, select: metricSelect, orderBy: { label: "asc" }, take: 501 }),
    client.followUpWave.findMany({ where: { organizationId, offsetMonths: { not: null } }, distinct: ["offsetMonths"], select: { offsetMonths: true } }),
  ]);
  if (programs.length > 100 || cohorts.length > 100 || metrics.length > 500 || calls.length > 500) throw new DomainConflictError("ANALYTICS_SCOPE_TOO_LARGE");
  return { programs, calls: calls.map(({ fundingProgramId, ...call }) => ({ ...call, programId: fundingProgramId })), cohorts: cohorts.map(({ fundingProgramId, fundingCallId, ...cohort }) => ({ ...cohort, programId: fundingProgramId, callId: fundingCallId })), metrics: metrics.map(metricFrom), offsetMonths: waves.map((wave) => wave.offsetMonths!).sort((a, b) => a - b) };
}

export const comparisonSchema = z.object({ programId: z.string().min(1).max(100).optional(), cohortIds: z.array(z.string().min(1).max(100)).min(2).max(6).refine((ids) => new Set(ids).size === ids.length), metricId: z.string().min(1).max(100), offsetMonths: z.array(z.number().int().min(0).max(600)).min(1).max(12).refine((offsets) => new Set(offsets).size === offsets.length) }).strict();
export async function compareCohortAnalytics(access: AnalyticsAccess, rawInput: z.infer<typeof comparisonSchema>, client: Prisma.TransactionClient = db) {
  const input = comparisonSchema.parse(rawInput);
  await assertAnalyticsAccess(access, undefined, client);
  const metricRecord = await client.metricDefinition.findFirst({ where: { organizationId: access.organizationId, id: input.metricId }, select: metricSelect });
  if (!metricRecord) throw new ResourceNotFoundError("METRIC_NOT_FOUND");
  const metric = metricFrom(metricRecord);
  const cohorts = [];
  for (const id of input.cohortIds) {
    const cohort = await getCohortAnalytics(access, id, client);
    if (input.programId && cohort.programId !== input.programId) throw new DomainConflictError("ANALYTICS_COMPARISON_SCOPE_INVALID");
    cohorts.push(cohort);
  }
  const mappingCounts = new Map<string, number>();
  for (const cohort of cohorts) mappingCounts.set(cohort.id, cohort.protocol ? await client.indicatorDefinition.count({ where: { organizationId: access.organizationId, trackingProtocolVersionId: cohort.protocol.id, metricDefinitionId: metric.id } }) : 0);
  const cells = cohorts.flatMap((cohort) => input.offsetMonths.map((offsetMonths) => {
    const resolved = resolveComparableWave(cohort.waves, offsetMonths);
    const aggregate = resolved.wave?.metrics.find((aggregate) => aggregate.metricId === metric.id) ?? null;
    const mappedCount = mappingCounts.get(cohort.id) ?? 0;
    const status = resolved.status === "READY" && !aggregate ? "UNMAPPED_METRIC" as const : resolved.status === "READY" && mappedCount !== 1 ? "INCOMPATIBLE_METRIC" as const : resolved.status;
    return { cohortId: cohort.id, cohortName: cohort.name, offsetMonths, status, waveId: resolved.wave?.id ?? null, waveName: resolved.wave?.name ?? null, coverage: resolved.wave?.coverage ?? null, aggregate: status === "READY" ? aggregate : null };
  }));
  return { metric, cohorts: cohorts.map((cohort) => ({ id: cohort.id, name: cohort.name })), cells };
}
