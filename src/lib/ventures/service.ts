import type { Prisma } from "@prisma/client";

import { assertCohortCanReceiveEnrollment, assertEnrollmentIsUnique, assertSameOrganization } from "@/lib/domain-invariants";
import { db } from "@/lib/db";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import type { CreateEnrollmentInput, CreateVentureInput, UpdateVentureInput } from "@/lib/ventures/schemas";

const ventureListSelect = {
  id: true,
  organizationId: true,
  name: true,
  legalName: true,
  kind: true,
  externalReference: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  enrollments: {
    select: {
      id: true,
      status: true,
      enrolledAt: true,
      withdrawnAt: true,
      cohort: { select: { id: true, name: true, fundingProgram: { select: { id: true, name: true } } } },
    },
    orderBy: { enrolledAt: "desc" },
  },
} as const;

type VentureRecord = Prisma.VentureGetPayload<{ select: typeof ventureListSelect }>;

export type VentureEnrollmentDto = {
  id: string;
  status: string;
  enrolledAt: string;
  withdrawnAt: string | null;
  cohort: { id: string; name: string; fundingProgram: { id: string; name: string } };
};

export type VentureDto = {
  id: string;
  organizationId: string;
  name: string;
  legalName: string | null;
  kind: string;
  externalReference: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  enrollments: VentureEnrollmentDto[];
};

function serializeVenture(record: VentureRecord): VentureDto {
  return {
    id: record.id,
    organizationId: record.organizationId,
    name: record.name,
    legalName: record.legalName,
    kind: record.kind,
    externalReference: record.externalReference,
    archivedAt: record.archivedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    enrollments: record.enrollments.map((enrollment) => ({
      id: enrollment.id,
      status: enrollment.status,
      enrolledAt: enrollment.enrolledAt.toISOString(),
      withdrawnAt: enrollment.withdrawnAt?.toISOString() ?? null,
      cohort: enrollment.cohort,
    })),
  };
}

export async function listOrganizationVentures(organizationId: string, cohortId?: string): Promise<VentureDto[]> {
  if (cohortId) {
    const cohort = await db.cohort.findFirst({
      where: { organizationId, id: cohortId },
      select: { id: true, organizationId: true },
    });
    if (!cohort) throw new ResourceNotFoundError("COHORT_NOT_FOUND");
    assertSameOrganization(organizationId, cohort.organizationId);
  }
  const records = await db.venture.findMany({
    where: {
      organizationId,
      archivedAt: null,
      ...(cohortId ? { enrollments: { some: { organizationId, cohortId } } } : {}),
    },
    select: ventureListSelect,
    orderBy: { name: "asc" },
  });
  return records.map(serializeVenture);
}

export async function getOrganizationVenture(organizationId: string, ventureId: string): Promise<VentureDto | null> {
  const record = await db.venture.findFirst({
    where: { organizationId, id: ventureId },
    select: ventureListSelect,
  });
  return record ? serializeVenture(record) : null;
}

export async function createVenture(organizationId: string, input: CreateVentureInput): Promise<VentureDto> {
  const record = await db.venture.create({
    data: {
      organizationId,
      name: input.name,
      legalName: input.legalName ?? null,
      kind: input.kind,
      externalReference: input.externalReference ?? null,
    },
    select: ventureListSelect,
  });
  return serializeVenture(record);
}

export async function updateVenture(
  organizationId: string,
  ventureId: string,
  input: UpdateVentureInput,
): Promise<VentureDto> {
  const current = await db.venture.findFirst({
    where: { id: ventureId, organizationId },
    select: { organizationId: true },
  });
  if (!current) throw new ResourceNotFoundError("VENTURE_NOT_FOUND");
  assertSameOrganization(organizationId, current.organizationId);

  await db.venture.updateMany({
    where: { id: ventureId, organizationId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.legalName !== undefined ? { legalName: input.legalName } : {}),
      ...(input.kind !== undefined ? { kind: input.kind } : {}),
      ...(input.externalReference !== undefined ? { externalReference: input.externalReference } : {}),
    },
  });
  const updated = await getOrganizationVenture(organizationId, ventureId);
  if (!updated) throw new ResourceNotFoundError("VENTURE_NOT_FOUND");
  return updated;
}

export async function listCohortVentures(organizationId: string, cohortId: string) {
  const cohort = await db.cohort.findFirst({
    where: { id: cohortId, organizationId },
    select: { id: true, organizationId: true },
  });
  if (!cohort) throw new ResourceNotFoundError("COHORT_NOT_FOUND");
  assertSameOrganization(organizationId, cohort.organizationId);

  const enrollments = await db.ventureEnrollment.findMany({
    where: { organizationId, cohortId },
    select: {
      id: true,
      status: true,
      enrolledAt: true,
      withdrawnAt: true,
      externalReference: true,
      venture: { select: { id: true, name: true, legalName: true, kind: true, externalReference: true } },
    },
    orderBy: [{ status: "asc" }, { enrolledAt: "asc" }],
  });
  return enrollments.map((enrollment) => ({
    id: enrollment.id,
    status: enrollment.status,
    enrolledAt: enrollment.enrolledAt.toISOString(),
    withdrawnAt: enrollment.withdrawnAt?.toISOString() ?? null,
    externalReference: enrollment.externalReference,
    venture: enrollment.venture,
  }));
}

export async function enrollVenture(
  organizationId: string,
  cohortId: string,
  input: CreateEnrollmentInput,
): Promise<{ id: string; status: string; enrolledAt: string; withdrawnAt: string | null; cohortId: string; ventureId: string }> {
  const enrollment = await db.$transaction(async (tx) => {
    const [cohort, venture] = await Promise.all([
      tx.cohort.findFirst({ where: { id: cohortId, organizationId }, select: { id: true, organizationId: true, status: true } }),
      tx.venture.findFirst({ where: { id: input.ventureId, organizationId, archivedAt: null }, select: { id: true, organizationId: true } }),
    ]);
    if (!cohort) throw new ResourceNotFoundError("COHORT_NOT_FOUND");
    if (!venture) throw new ResourceNotFoundError("VENTURE_NOT_FOUND");
    assertSameOrganization(organizationId, cohort.organizationId, venture.organizationId);
    assertCohortCanReceiveEnrollment(cohort.status);

    const existing = await tx.ventureEnrollment.findUnique({
      where: { organizationId_cohortId_ventureId: { organizationId, cohortId, ventureId: input.ventureId } },
      select: { id: true },
    });
    assertEnrollmentIsUnique(existing?.id ?? null);

    const enrollment = await tx.ventureEnrollment.create({
      data: {
        organizationId,
        cohortId,
        ventureId: input.ventureId,
        externalReference: input.externalReference ?? null,
        enrolledAt: input.enrolledAt ?? new Date(),
      },
      select: { id: true, status: true, enrolledAt: true, withdrawnAt: true, cohortId: true, ventureId: true },
    });
    const applicableWaves = await tx.followUpWave.findMany({
      where: { organizationId, cohortId, status: { in: ["PLANNED", "OPEN"] } },
      select: { id: true },
    });
    if (applicableWaves.length) {
      await tx.ventureObservation.createMany({
        data: applicableWaves.map((wave) => ({
          organizationId,
          cohortId,
          ventureEnrollmentId: enrollment.id,
          followUpWaveId: wave.id,
          status: "PENDING" as const,
        })),
        skipDuplicates: true,
      });
    }
    return enrollment;
  });
  return { ...enrollment, enrolledAt: enrollment.enrolledAt.toISOString(), withdrawnAt: enrollment.withdrawnAt?.toISOString() ?? null };
}

export async function withdrawEnrollment(
  organizationId: string,
  cohortId: string,
  enrollmentId: string,
): Promise<{ id: string; status: string }> {
  const current = await db.ventureEnrollment.findFirst({
    where: { id: enrollmentId, organizationId, cohortId },
    select: { id: true, organizationId: true, status: true },
  });
  if (!current) throw new ResourceNotFoundError("VENTURE_ENROLLMENT_NOT_FOUND");
  assertSameOrganization(organizationId, current.organizationId);
  if (current.status !== "ACTIVE") throw new DomainConflictError("ENROLLMENT_NOT_ACTIVE");

  const updated = await db.ventureEnrollment.update({
    where: { id: enrollmentId },
    data: { status: "WITHDRAWN", withdrawnAt: new Date() },
    select: { id: true, status: true },
  });
  return updated;
}
