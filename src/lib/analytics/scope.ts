import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { ResourceNotFoundError } from "@/lib/errors";
import type { AnalyticsFilters, AnalyticsScope } from "@/lib/analytics/types";

export const analyticsFiltersSchema = z.object({
  programId: z.string().min(1).max(100).optional(), callId: z.string().min(1).max(100).optional(),
  cohortId: z.string().min(1).max(100).optional(), metricId: z.string().min(1).max(100).optional(),
  year: z.number().int().min(1900).max(2200).optional(),
}).strict();

export async function resolveAnalyticsScope(client: Prisma.TransactionClient, organizationId: string, input: AnalyticsFilters): Promise<AnalyticsScope> {
  const filters = analyticsFiltersSchema.parse(input);
  let programId = filters.programId ?? null; let callId = filters.callId ?? null;
  if (filters.cohortId) {
    const cohort = await client.cohort.findFirst({ where: { organizationId, id: filters.cohortId, ...(programId ? { fundingProgramId: programId } : {}), ...(callId ? { fundingCallId: callId } : {}) }, select: { fundingProgramId: true, fundingCallId: true } });
    if (!cohort) throw new ResourceNotFoundError("COHORT_NOT_FOUND");
    programId = cohort.fundingProgramId; callId = cohort.fundingCallId;
  }
  if (callId) {
    const call = await client.fundingCall.findFirst({ where: { organizationId, id: callId, ...(programId ? { fundingProgramId: programId } : {}) }, select: { fundingProgramId: true } });
    if (!call) throw new ResourceNotFoundError("FUNDING_CALL_NOT_FOUND");
    programId = call.fundingProgramId;
  }
  if (programId && !await client.fundingProgram.findFirst({ where: { organizationId, id: programId }, select: { id: true } })) throw new ResourceNotFoundError("FUNDING_PROGRAM_NOT_FOUND");
  if (filters.metricId && !await client.metricDefinition.findFirst({ where: { organizationId, id: filters.metricId }, select: { id: true } })) throw new ResourceNotFoundError("METRIC_NOT_FOUND");
  return { programId, callId, cohortId: filters.cohortId ?? null, year: filters.year ?? null, metricId: filters.metricId ?? null };
}

export function analyticsCallWhere(organizationId: string, scope: AnalyticsScope): Prisma.FundingCallWhereInput {
  return { organizationId, ...(scope.programId ? { fundingProgramId: scope.programId } : {}), ...(scope.callId ? { id: scope.callId } : {}),
    ...(scope.year !== null ? { publishedAt: { gte: new Date(`${scope.year}-01-01T00:00:00Z`), lt: new Date(`${scope.year + 1}-01-01T00:00:00Z`) } } : {}) };
}

export function analyticsCohortWhere(organizationId: string, scope: AnalyticsScope): Prisma.CohortWhereInput {
  return { organizationId, ...(scope.programId ? { fundingProgramId: scope.programId } : {}), ...(scope.callId ? { fundingCallId: scope.callId } : {}), ...(scope.cohortId ? { id: scope.cohortId } : {}),
    ...(scope.year !== null ? { fundingCall: analyticsCallWhere(organizationId, scope) } : {}) };
}
