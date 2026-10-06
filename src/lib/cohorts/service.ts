import type { Prisma } from "@prisma/client";

import { assertProgramCanReceiveCohort, assertSameOrganization } from "@/lib/domain-invariants";
import { db } from "@/lib/db";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import type { CreateCohortInput, UpdateCohortInput } from "@/lib/cohorts/schemas";

const cohortSummarySelect = {
  id: true,
  organizationId: true,
  fundingProgramId: true,
  fundingCallId: true,
  trackingProtocolVersionId: true,
  name: true,
  code: true,
  referenceYear: true,
  startsAt: true,
  endsAt: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  fundingProgram: { select: { id: true, name: true } },
  fundingCall: { select: { id: true, title: true, callNumber: true } },
  trackingProtocolVersion: { select: { id: true, version: true, label: true, trackingProtocol: { select: { id: true, name: true } } } },
  _count: { select: { enrollments: true, followUpWaves: true } },
} as const;

type CohortSummaryRecord = Prisma.CohortGetPayload<{ select: typeof cohortSummarySelect }>;

export type CohortDto = {
  id: string;
  organizationId: string;
  fundingProgramId: string;
  fundingProgram: { id: string; name: string };
  fundingCallId: string | null;
  fundingCall: { id: string; title: string; callNumber: string } | null;
  trackingProtocolVersionId: string | null;
  trackingProtocolVersion: { id: string; version: number; label: string | null; trackingProtocol: { id: string; name: string } } | null;
  name: string;
  code: string | null;
  referenceYear: number | null;
  startsAt: string | null;
  endsAt: string | null;
  status: string;
  ventureCount: number;
  waveCount: number;
  createdAt: string;
  updatedAt: string;
};

function serializeCohort(record: CohortSummaryRecord): CohortDto {
  return {
    id: record.id,
    organizationId: record.organizationId,
    fundingProgramId: record.fundingProgramId,
    fundingProgram: record.fundingProgram,
    fundingCallId: record.fundingCallId,
    fundingCall: record.fundingCall,
    trackingProtocolVersionId: record.trackingProtocolVersionId,
    trackingProtocolVersion: record.trackingProtocolVersion,
    name: record.name,
    code: record.code,
    referenceYear: record.referenceYear,
    startsAt: record.startsAt?.toISOString() ?? null,
    endsAt: record.endsAt?.toISOString() ?? null,
    status: record.status,
    ventureCount: record._count.enrollments,
    waveCount: record._count.followUpWaves,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function listProgramCohorts(organizationId: string, fundingProgramId: string): Promise<CohortDto[]> {
  const program = await db.fundingProgram.findFirst({
    where: { id: fundingProgramId, organizationId },
    select: { id: true },
  });
  if (!program) throw new ResourceNotFoundError("FUNDING_PROGRAM_NOT_FOUND");
  const records = await db.cohort.findMany({
    where: { organizationId, fundingProgramId },
    select: cohortSummarySelect,
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
  return records.map(serializeCohort);
}

export async function listOrganizationCohorts(organizationId: string): Promise<CohortDto[]> {
  const records = await db.cohort.findMany({
    where: { organizationId },
    select: cohortSummarySelect,
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
  return records.map(serializeCohort);
}

export async function getOrganizationCohort(organizationId: string, cohortId: string): Promise<CohortDto | null> {
  const record = await db.cohort.findFirst({
    where: { organizationId, id: cohortId },
    select: cohortSummarySelect,
  });
  return record ? serializeCohort(record) : null;
}

export async function createCohort(
  organizationId: string,
  fundingProgramId: string,
  input: CreateCohortInput,
): Promise<CohortDto> {
  return db.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "FundingProgram" WHERE "organizationId" = ${organizationId} AND "id" = ${fundingProgramId} FOR UPDATE`;
    const program = await transaction.fundingProgram.findFirst({
      where: { id: fundingProgramId, organizationId },
      select: { organizationId: true, status: true },
    });
    if (!program) throw new ResourceNotFoundError("FUNDING_PROGRAM_NOT_FOUND");
    assertSameOrganization(organizationId, program.organizationId);
    assertProgramCanReceiveCohort(program.status);
    await validateCohortRelations(transaction, organizationId, fundingProgramId, input);
    const record = await transaction.cohort.create({
      data: { ...input, organizationId, fundingProgramId },
      select: cohortSummarySelect,
    });
    return serializeCohort(record);
  });
}

export async function updateCohort(
  organizationId: string,
  cohortId: string,
  input: UpdateCohortInput,
): Promise<CohortDto> {
  return db.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "Cohort" WHERE "organizationId" = ${organizationId} AND "id" = ${cohortId} FOR UPDATE`;
    const current = await transaction.cohort.findFirst({ where: { id: cohortId, organizationId }, select: cohortSummarySelect });
    if (!current) throw new ResourceNotFoundError("COHORT_NOT_FOUND");
    if (current.status === "ARCHIVED") throw new DomainConflictError("COHORT_ARCHIVED");
    const startsAt = input.startsAt !== undefined ? input.startsAt : current.startsAt;
    const endsAt = input.endsAt !== undefined ? input.endsAt : current.endsAt;
    if (startsAt && endsAt && endsAt < startsAt) throw new DomainConflictError("COHORT_DATE_RANGE_INVALID");
    if (input.trackingProtocolVersionId !== undefined && input.trackingProtocolVersionId !== current.trackingProtocolVersionId && current._count.followUpWaves > 0) {
      throw new DomainConflictError("COHORT_PROTOCOL_FROZEN");
    }
    if (input.fundingCallId !== undefined && input.fundingCallId !== current.fundingCallId && (current._count.followUpWaves > 0 || current._count.enrollments > 0)) {
      throw new DomainConflictError("COHORT_HISTORY_FROZEN");
    }
    await validateCohortRelations(transaction, organizationId, current.fundingProgramId, {
      ...(input.fundingCallId !== current.fundingCallId ? { fundingCallId: input.fundingCallId } : {}),
      ...(input.trackingProtocolVersionId !== current.trackingProtocolVersionId ? { trackingProtocolVersionId: input.trackingProtocolVersionId } : {}),
    });
    await transaction.cohort.updateMany({ where: { id: cohortId, organizationId }, data: input });
    const record = await transaction.cohort.findFirst({ where: { id: cohortId, organizationId }, select: cohortSummarySelect });
    if (!record) throw new ResourceNotFoundError("COHORT_NOT_FOUND");
    return serializeCohort(record);
  });
}

async function validateCohortRelations(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  fundingProgramId: string,
  input: { fundingCallId?: string | null; trackingProtocolVersionId?: string | null },
) {
  if (input.fundingCallId) {
    await transaction.$queryRaw`SELECT "id" FROM "FundingCall" WHERE "organizationId" = ${organizationId} AND "fundingProgramId" = ${fundingProgramId} AND "id" = ${input.fundingCallId} FOR UPDATE`;
    const call = await transaction.fundingCall.findFirst({ where: { organizationId, fundingProgramId, id: input.fundingCallId }, select: { status: true } });
    if (!call) throw new ResourceNotFoundError("FUNDING_CALL_NOT_FOUND");
    if (call.status === "ARCHIVED") throw new DomainConflictError("FUNDING_CALL_NOT_ELIGIBLE_FOR_COHORT");
  }
  if (input.trackingProtocolVersionId) {
    const version = await transaction.trackingProtocolVersion.findFirst({ where: { organizationId, id: input.trackingProtocolVersionId }, select: { _count: { select: { indicators: true } } } });
    if (!version) throw new ResourceNotFoundError("TRACKING_PROTOCOL_VERSION_NOT_FOUND");
    if (version._count.indicators === 0) throw new DomainConflictError("PROTOCOL_HAS_NO_INDICATORS");
  }
}
