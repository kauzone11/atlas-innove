import type { Prisma } from "@prisma/client";

import { assertProgramCanReceiveCohort, assertSameOrganization } from "@/lib/domain-invariants";
import { db } from "@/lib/db";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import type { CreateCohortInput, UpdateCohortInput } from "@/lib/cohorts/schemas";

const cohortSummarySelect = {
  id: true,
  organizationId: true,
  fundingProgramId: true,
  name: true,
  code: true,
  referenceYear: true,
  startsAt: true,
  endsAt: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  fundingProgram: { select: { id: true, name: true } },
  _count: { select: { enrollments: true } },
} as const;

type CohortSummaryRecord = Prisma.CohortGetPayload<{ select: typeof cohortSummarySelect }>;

export type CohortDto = {
  id: string;
  organizationId: string;
  fundingProgramId: string;
  fundingProgram: { id: string; name: string };
  name: string;
  code: string | null;
  referenceYear: number | null;
  startsAt: string | null;
  endsAt: string | null;
  status: string;
  ventureCount: number;
  createdAt: string;
  updatedAt: string;
};

function serializeCohort(record: CohortSummaryRecord): CohortDto {
  return {
    id: record.id,
    organizationId: record.organizationId,
    fundingProgramId: record.fundingProgramId,
    fundingProgram: record.fundingProgram,
    name: record.name,
    code: record.code,
    referenceYear: record.referenceYear,
    startsAt: record.startsAt?.toISOString() ?? null,
    endsAt: record.endsAt?.toISOString() ?? null,
    status: record.status,
    ventureCount: record._count.enrollments,
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
  const program = await db.fundingProgram.findFirst({
    where: { id: fundingProgramId, organizationId },
    select: { id: true, organizationId: true, status: true },
  });
  if (!program) throw new ResourceNotFoundError("FUNDING_PROGRAM_NOT_FOUND");
  assertSameOrganization(organizationId, program.organizationId);
  assertProgramCanReceiveCohort(program.status);

  const record = await db.cohort.create({
    data: {
      organizationId,
      fundingProgramId,
      name: input.name,
      code: input.code ?? null,
      referenceYear: input.referenceYear ?? null,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      status: input.status,
    },
    select: cohortSummarySelect,
  });
  return serializeCohort(record);
}

export async function updateCohort(
  organizationId: string,
  cohortId: string,
  input: UpdateCohortInput,
): Promise<CohortDto> {
  const current = await db.cohort.findFirst({
    where: { id: cohortId, organizationId },
    select: { organizationId: true, startsAt: true, endsAt: true },
  });
  if (!current) throw new ResourceNotFoundError("COHORT_NOT_FOUND");
  assertSameOrganization(organizationId, current.organizationId);
  const startsAt = input.startsAt !== undefined ? input.startsAt : current.startsAt;
  const endsAt = input.endsAt !== undefined ? input.endsAt : current.endsAt;
  if (startsAt && endsAt && endsAt < startsAt) {
    throw new DomainConflictError("COHORT_DATE_RANGE_INVALID");
  }

  await db.cohort.updateMany({
    where: { id: cohortId, organizationId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.referenceYear !== undefined ? { referenceYear: input.referenceYear } : {}),
      ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
      ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  });
  const updated = await getOrganizationCohort(organizationId, cohortId);
  if (!updated) throw new ResourceNotFoundError("COHORT_NOT_FOUND");
  return updated;
}
