import type { Prisma } from "@prisma/client";

import { assertSameOrganization } from "@/lib/domain-invariants";
import { ResourceNotFoundError } from "@/lib/errors";
import { db } from "@/lib/db";
import type { CreateFundingProgramInput, UpdateFundingProgramInput } from "@/lib/programs/schemas";

const programListSelect = {
  id: true,
  organizationId: true,
  name: true,
  slug: true,
  description: true,
  code: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { cohorts: true } },
} as const;

type ProgramListRecord = Prisma.FundingProgramGetPayload<{ select: typeof programListSelect }>;

export type FundingProgramDto = {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
  code: string | null;
  status: string;
  cohortCount: number;
  createdAt: string;
  updatedAt: string;
};

export type FundingProgramDetailsDto = FundingProgramDto & {
  cohorts: Array<{
    id: string;
    name: string;
    code: string | null;
    referenceYear: number | null;
    startsAt: string | null;
    endsAt: string | null;
    status: string;
    ventureCount: number;
  }>;
};

function serializeProgram(record: ProgramListRecord): FundingProgramDto {
  return {
    id: record.id,
    organizationId: record.organizationId,
    name: record.name,
    slug: record.slug,
    description: record.description,
    code: record.code,
    status: record.status,
    cohortCount: record._count.cohorts,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function listOrganizationPrograms(organizationId: string): Promise<FundingProgramDto[]> {
  const records = await db.fundingProgram.findMany({
    where: { organizationId },
    select: programListSelect,
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
  return records.map(serializeProgram);
}

export async function getOrganizationProgram(
  organizationId: string,
  programId: string,
): Promise<FundingProgramDetailsDto | null> {
  const record = await db.fundingProgram.findFirst({
    where: { id: programId, organizationId },
    select: {
      ...programListSelect,
      cohorts: {
        select: {
          id: true,
          name: true,
          code: true,
          referenceYear: true,
          startsAt: true,
          endsAt: true,
          status: true,
          _count: { select: { enrollments: true } },
        },
        orderBy: [{ status: "asc" }, { name: "asc" }],
      },
    },
  });
  if (!record) return null;

  return {
    ...serializeProgram(record),
    cohorts: record.cohorts.map((cohort) => ({
      id: cohort.id,
      name: cohort.name,
      code: cohort.code,
      referenceYear: cohort.referenceYear,
      startsAt: cohort.startsAt?.toISOString() ?? null,
      endsAt: cohort.endsAt?.toISOString() ?? null,
      status: cohort.status,
      ventureCount: cohort._count.enrollments,
    })),
  };
}

export async function createFundingProgram(
  organizationId: string,
  createdByUserId: string,
  input: CreateFundingProgramInput,
): Promise<FundingProgramDto> {
  const record = await db.fundingProgram.create({
    data: {
      organizationId,
      createdByUserId,
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      code: input.code ?? null,
      status: input.status,
    },
    select: programListSelect,
  });
  return serializeProgram(record);
}

export async function updateFundingProgram(
  organizationId: string,
  programId: string,
  input: UpdateFundingProgramInput,
): Promise<FundingProgramDetailsDto> {
  const current = await db.fundingProgram.findFirst({
    where: { id: programId, organizationId },
    select: { organizationId: true },
  });
  if (!current) throw new ResourceNotFoundError("FUNDING_PROGRAM_NOT_FOUND");
  assertSameOrganization(organizationId, current.organizationId);

  await db.fundingProgram.updateMany({
    where: { id: programId, organizationId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  });
  const updated = await getOrganizationProgram(organizationId, programId);
  if (!updated) throw new ResourceNotFoundError("FUNDING_PROGRAM_NOT_FOUND");
  return updated;
}
