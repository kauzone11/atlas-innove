import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { DomainConflictError } from "@/lib/errors";
import { assertAnalyticsAccess, type AnalyticsAccess } from "@/lib/analytics/access";
import { analyticsCallWhere, analyticsCohortWhere, resolveAnalyticsScope } from "@/lib/analytics/scope";
import type { AnalyticsFilters } from "@/lib/analytics/types";
import { calendarToday, deriveObligationState } from "@/lib/execution/state";

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if ("toJSON" in value && typeof value.toJSON === "function") return canonicalJson(value.toJSON());
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().filter((key) => (value as Record<string, unknown>)[key] !== undefined).map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
}
export const digestSources = (value: unknown) => createHash("sha256").update(canonicalJson(value)).digest("hex");

export async function getAnalyticsSourceDigest(access: AnalyticsAccess, filters: AnalyticsFilters = {}, client: Prisma.TransactionClient = db, sourceKind: "PORTFOLIO" | "COHORT" | "EXECUTION" | "APPLICATIONS" = "PORTFOLIO", now = new Date()) {
  const { organizationId } = await assertAnalyticsAccess(access, undefined, client);
  const scope = await resolveAnalyticsScope(client, organizationId, filters);
  const cohortWhere = analyticsCohortWhere(organizationId, scope); const callWhere = analyticsCallWhere(organizationId, scope);
  const sources: Record<string, unknown> = { sourceKind, scope, organization: await client.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true } }) };
  if (sourceKind === "COHORT" && scope.callId) sources.call = await client.fundingCall.findFirst({ where: { organizationId, id: scope.callId }, select: { id: true, title: true, updatedAt: true } });
  if (sourceKind === "COHORT" || sourceKind === "PORTFOLIO") {
    const sizes = await Promise.all([
      client.cohort.count({ where: cohortWhere }),
      client.ventureObservation.count({ where: { organizationId, cohort: cohortWhere } }),
      client.ventureEnrollment.count({ where: { organizationId, cohort: cohortWhere } }),
      client.followUpWave.count({ where: { organizationId, cohort: cohortWhere } }),
      client.observationValue.count({ where: { organizationId, observation: { organizationId, status: "SUBMITTED", cohort: cohortWhere }, ...(scope.metricId ? { indicatorDefinition: { organizationId, metricDefinitionId: scope.metricId } } : {}) } }),
    ]);
    if (sizes[0] > 100 || sizes[1] > 50000 || sizes[2] > 10000 || sizes[3] > 500 || sizes[4] > 50000) throw new DomainConflictError("ANALYTICS_SCOPE_TOO_LARGE");
    sources.cohorts = await client.cohort.findMany({ where: cohortWhere, orderBy: { id: "asc" }, select: {
      id: true, name: true, updatedAt: true, fundingProgram: { select: { id: true, name: true } }, trackingProtocolVersion: { select: { id: true, version: true, label: true, trackingProtocol: { select: { id: true, name: true } }, indicators: { where: { organizationId }, orderBy: { id: "asc" }, select: { id: true, key: true, valueType: true, unit: true, allowedValues: true, metricDefinitionId: true, metricDefinition: { select: { id: true, updatedAt: true, key: true, label: true, unit: true, allowedValues: true, primaryAggregation: true } } } } } },
      enrollments: { where: { organizationId }, orderBy: { id: "asc" }, select: { id: true, ventureId: true, enrolledAt: true, withdrawnAt: true } },
      followUpWaves: { where: { organizationId }, orderBy: { id: "asc" }, select: { id: true, name: true, offsetMonths: true, sequence: true, kind: true, status: true, scheduledFor: true, opensAt: true, createdAt: true, updatedAt: true } },
      observations: { where: { organizationId }, orderBy: { id: "asc" }, select: { id: true, followUpWaveId: true, ventureEnrollmentId: true, status: true, submittedAt: true } },
    } });
    sources.values = await client.observationValue.findMany({ where: { organizationId, observation: { organizationId, status: "SUBMITTED", cohort: cohortWhere }, ...(scope.metricId ? { indicatorDefinition: { organizationId, metricDefinitionId: scope.metricId } } : {}) }, orderBy: { id: "asc" }, select: { id: true, observationId: true, indicatorDefinitionId: true, updatedAt: true, integerValue: true, decimalValue: true, textValue: true }, take: 50001 });
    if ((sources.values as unknown[]).length > 50000) throw new DomainConflictError("ANALYTICS_SCOPE_TOO_LARGE");
  }
  if (sourceKind !== "COHORT") {
    const applicationWhere: Prisma.ApplicationWhereInput = { organizationId, fundingCall: callWhere, ...(scope.cohortId ? { enrollments: { some: { organizationId, cohortId: scope.cohortId } } } : {}) };
    if (await client.applicationEvaluation.count({ where: { organizationId, status: "SUBMITTED", application: applicationWhere } }) > 50000) throw new DomainConflictError("ANALYTICS_SCOPE_TOO_LARGE");
    sources.programs = await client.fundingProgram.findMany({ where: { organizationId, ...(scope.programId ? { id: scope.programId } : {}), ...(scope.year !== null ? { fundingCalls: { some: callWhere } } : {}) }, orderBy: { id: "asc" }, select: { id: true, name: true, status: true, updatedAt: true } });
    sources.calls = await client.fundingCall.findMany({ where: callWhere, orderBy: { id: "asc" }, select: { id: true, updatedAt: true, status: true, applicationsEnabled: true } });
    sources.applications = await client.application.findMany({ where: applicationWhere, orderBy: { id: "asc" }, select: { id: true, status: true, revision: true, submittedAt: true, withdrawnAt: true, decision: true, updatedAt: true, evaluations: { where: { organizationId, status: "SUBMITTED" }, orderBy: { id: "asc" }, select: { id: true, submittedAt: true } } }, take: 50001 });
    if ((sources.applications as unknown[]).length > 50000) throw new DomainConflictError("ANALYTICS_SCOPE_TOO_LARGE");
  }
  if (sourceKind === "EXECUTION" || sourceKind === "PORTFOLIO") {
    const awardWhere: Prisma.AwardWhereInput = { organizationId, fundingCall: callWhere, ...(scope.cohortId ? { enrollments: { some: { organizationId, cohortId: scope.cohortId } } } : {}) };
    const sizes = await Promise.all([
      client.award.count({ where: awardWhere }), client.awardObligation.count({ where: { organizationId, award: awardWhere } }),
      client.awardDisbursement.count({ where: { organizationId, award: awardWhere } }), client.awardSubmission.count({ where: { organizationId, obligation: { award: awardWhere }, status: "SUBMITTED" } }),
    ]);
    if (sizes[0] > 10000 || sizes[1] > 10000 || sizes[2] > 10000 || sizes[3] > 50000) throw new DomainConflictError("ANALYTICS_SCOPE_TOO_LARGE");
    const awards = await client.award.findMany({ where: awardWhere, orderBy: { id: "asc" }, select: {
      id: true, status: true, revision: true, approvedAmount: true, updatedAt: true,
      obligations: { where: { organizationId }, orderBy: { id: "asc" }, select: { id: true, required: true, dueAt: true, waivedAt: true, updatedAt: true, submissions: { where: { organizationId, status: "SUBMITTED" }, orderBy: { version: "desc" }, select: { id: true, version: true, status: true, reviewStatus: true, reviewedAt: true } } } },
      disbursements: { where: { organizationId }, orderBy: { id: "asc" }, select: { id: true, status: true, amount: true, updatedAt: true } },
    }, take: 10001 });
    if (awards.length > 10000) throw new DomainConflictError("ANALYTICS_SCOPE_TOO_LARGE");
    sources.awards = awards.map((award) => ({ ...award, obligations: award.obligations.map((obligation) => ({ ...obligation, derivedState: deriveObligationState({ ...obligation, dueAt: obligation.dueAt?.toISOString().slice(0, 10) ?? null }, calendarToday(now)) })) }));
  }
  if (sourceKind === "PORTFOLIO") {
    sources.milestones = await client.milestone.findMany({ where: { organizationId, venture: { enrollments: { some: { organizationId, cohort: cohortWhere } } } }, orderBy: { id: "asc" }, select: { id: true, type: true, occurredAt: true }, take: 50001 });
    if ((sources.milestones as unknown[]).length > 50000) throw new DomainConflictError("ANALYTICS_SCOPE_TOO_LARGE");
  }
  return digestSources(sources);
}
