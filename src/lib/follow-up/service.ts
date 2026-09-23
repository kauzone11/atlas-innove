import type { Prisma } from "@prisma/client";

import { assertCohortCanReceiveWave, assertObservationStatusTransition, assertSameOrganization, assertWaveStatusTransition } from "@/lib/domain-invariants";
import { db } from "@/lib/db";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import type { CreateFollowUpWaveInput } from "@/lib/follow-up/schemas";

const waveSelect = {
  id: true,
  organizationId: true,
  cohortId: true,
  name: true,
  kind: true,
  sequence: true,
  offsetMonths: true,
  scheduledFor: true,
  opensAt: true,
  closesAt: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  observations: { select: { status: true } },
} as const;

type WaveRecord = Prisma.FollowUpWaveGetPayload<{ select: typeof waveSelect }>;

export type ObservationCountsDto = {
  expected: number;
  pending: number;
  inProgress: number;
  submitted: number;
  missed: number;
};

export type FollowUpWaveDto = {
  id: string;
  organizationId: string;
  cohortId: string;
  name: string;
  kind: string;
  sequence: number;
  offsetMonths: number | null;
  scheduledFor: string | null;
  opensAt: string | null;
  closesAt: string | null;
  status: string;
  observationCounts: ObservationCountsDto;
  createdAt: string;
  updatedAt: string;
};

export type CohortWorkspaceEnrollmentDto = {
  id: string;
  status: string;
  enrolledAt: string;
  externalReference: string | null;
  venture: {
    id: string;
    name: string;
    legalName: string | null;
    kind: string;
    externalReference: string | null;
  };
};

export type CohortWorkspaceDto = {
  cohort: {
    id: string;
    organizationId: string;
    fundingProgramId: string;
    name: string;
    code: string | null;
    referenceYear: number | null;
    startsAt: string | null;
    endsAt: string | null;
    status: string;
    fundingProgram: { id: string; name: string; status: string };
  };
  enrollments: CohortWorkspaceEnrollmentDto[];
  waves: FollowUpWaveDto[];
  observationCounts: ObservationCountsDto;
};

function emptyObservationCounts(): ObservationCountsDto {
  return { expected: 0, pending: 0, inProgress: 0, submitted: 0, missed: 0 };
}

function serializeWave(record: WaveRecord): FollowUpWaveDto {
  const observationCounts = emptyObservationCounts();
  observationCounts.expected = record.observations.length;
  for (const observation of record.observations) {
    if (observation.status === "PENDING") observationCounts.pending += 1;
    if (observation.status === "IN_PROGRESS") observationCounts.inProgress += 1;
    if (observation.status === "SUBMITTED") observationCounts.submitted += 1;
    if (observation.status === "MISSED") observationCounts.missed += 1;
  }

  return {
    id: record.id,
    organizationId: record.organizationId,
    cohortId: record.cohortId,
    name: record.name,
    kind: record.kind,
    sequence: record.sequence,
    offsetMonths: record.offsetMonths,
    scheduledFor: record.scheduledFor?.toISOString() ?? null,
    opensAt: record.opensAt?.toISOString() ?? null,
    closesAt: record.closesAt?.toISOString() ?? null,
    status: record.status,
    observationCounts,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function addObservationCounts(total: ObservationCountsDto, current: ObservationCountsDto): void {
  total.expected += current.expected;
  total.pending += current.pending;
  total.inProgress += current.inProgress;
  total.submitted += current.submitted;
  total.missed += current.missed;
}

export async function getCohortWorkspace(
  organizationId: string,
  cohortId: string,
): Promise<CohortWorkspaceDto | null> {
  const record = await db.cohort.findFirst({
    where: { organizationId, id: cohortId },
    select: {
      id: true,
      organizationId: true,
      fundingProgramId: true,
      name: true,
      code: true,
      referenceYear: true,
      startsAt: true,
      endsAt: true,
      status: true,
      fundingProgram: { select: { id: true, name: true, status: true } },
      enrollments: {
        select: {
          id: true,
          status: true,
          enrolledAt: true,
          externalReference: true,
          venture: { select: { id: true, name: true, legalName: true, kind: true, externalReference: true } },
        },
        orderBy: [{ status: "asc" }, { enrolledAt: "asc" }],
      },
      followUpWaves: {
        select: waveSelect,
        orderBy: { sequence: "asc" },
      },
    },
  });
  if (!record) return null;

  const waves = record.followUpWaves.map(serializeWave);
  const observationCounts = emptyObservationCounts();
  for (const wave of waves) addObservationCounts(observationCounts, wave.observationCounts);

  return {
    cohort: {
      id: record.id,
      organizationId: record.organizationId,
      fundingProgramId: record.fundingProgramId,
      name: record.name,
      code: record.code,
      referenceYear: record.referenceYear,
      startsAt: record.startsAt?.toISOString() ?? null,
      endsAt: record.endsAt?.toISOString() ?? null,
      status: record.status,
      fundingProgram: record.fundingProgram,
    },
    enrollments: record.enrollments.map((enrollment) => ({
      id: enrollment.id,
      status: enrollment.status,
      enrolledAt: enrollment.enrolledAt.toISOString(),
      externalReference: enrollment.externalReference,
      venture: enrollment.venture,
    })),
    waves,
    observationCounts,
  };
}

export async function listCohortFollowUpWaves(
  organizationId: string,
  cohortId: string,
): Promise<FollowUpWaveDto[]> {
  const cohort = await db.cohort.findFirst({
    where: { id: cohortId, organizationId },
    select: { id: true, organizationId: true },
  });
  if (!cohort) throw new ResourceNotFoundError("COHORT_NOT_FOUND");
  assertSameOrganization(organizationId, cohort.organizationId);

  const records = await db.followUpWave.findMany({
    where: { organizationId, cohortId },
    select: waveSelect,
    orderBy: { sequence: "asc" },
  });
  return records.map(serializeWave);
}

export async function createFollowUpWave(
  organizationId: string,
  cohortId: string,
  input: CreateFollowUpWaveInput,
): Promise<FollowUpWaveDto> {
  const waveId = await db.$transaction(async (tx) => {
    const cohort = await tx.cohort.findFirst({
      where: { id: cohortId, organizationId },
      select: { id: true, organizationId: true, status: true },
    });
    if (!cohort) throw new ResourceNotFoundError("COHORT_NOT_FOUND");
    assertSameOrganization(organizationId, cohort.organizationId);
    assertCohortCanReceiveWave(cohort.status);
    if (input.kind === "BASELINE" && input.sequence !== 0) {
      throw new DomainConflictError("BASELINE_SEQUENCE_INVALID");
    }
    if (input.kind === "FOLLOW_UP" && input.sequence <= 0) {
      throw new DomainConflictError("FOLLOW_UP_SEQUENCE_INVALID");
    }
    if (input.kind === "BASELINE") {
      const baseline = await tx.followUpWave.findFirst({
        where: { organizationId, cohortId, kind: "BASELINE" },
        select: { id: true },
      });
      if (baseline) throw new DomainConflictError("BASELINE_ALREADY_EXISTS");
    }

    const wave = await tx.followUpWave.create({
      data: {
        organizationId,
        cohortId,
        name: input.name,
        kind: input.kind,
        sequence: input.sequence,
        offsetMonths: input.offsetMonths ?? null,
        scheduledFor: input.scheduledFor ?? null,
        opensAt: input.opensAt ?? null,
        closesAt: input.closesAt ?? null,
      },
      select: { id: true },
    });
    const enrollments = await tx.ventureEnrollment.findMany({
      where: { organizationId, cohortId, status: "ACTIVE" },
      select: { id: true },
    });
    if (enrollments.length) {
      await tx.ventureObservation.createMany({
        data: enrollments.map((enrollment) => ({
          organizationId,
          cohortId,
          ventureEnrollmentId: enrollment.id,
          followUpWaveId: wave.id,
          status: "PENDING" as const,
        })),
        skipDuplicates: true,
      });
    }
    return wave.id;
  });

  const created = await db.followUpWave.findFirst({ where: { organizationId, cohortId, id: waveId }, select: waveSelect });
  if (!created) throw new ResourceNotFoundError("FOLLOW_UP_WAVE_NOT_FOUND");
  return serializeWave(created);
}

export async function updateFollowUpWaveStatus(
  organizationId: string,
  cohortId: string,
  waveId: string,
  status: string,
): Promise<FollowUpWaveDto> {
  const current = await db.followUpWave.findFirst({
    where: { id: waveId, cohortId, organizationId },
    select: { id: true, organizationId: true, status: true },
  });
  if (!current) throw new ResourceNotFoundError("FOLLOW_UP_WAVE_NOT_FOUND");
  assertSameOrganization(organizationId, current.organizationId);
  assertWaveStatusTransition(current.status, status);

  await db.followUpWave.updateMany({
    where: { id: waveId, cohortId, organizationId },
    data: { status: status as "PLANNED" | "OPEN" | "CLOSED" | "ARCHIVED" },
  });
  const updated = await db.followUpWave.findFirst({ where: { id: waveId, cohortId, organizationId }, select: waveSelect });
  if (!updated) throw new ResourceNotFoundError("FOLLOW_UP_WAVE_NOT_FOUND");
  return serializeWave(updated);
}

export async function updateObservationStatus(
  organizationId: string,
  observationId: string,
  status: string,
): Promise<{ id: string; status: string; startedAt: string | null; submittedAt: string | null }> {
  const current = await db.ventureObservation.findFirst({
    where: { id: observationId, organizationId },
    select: { id: true, organizationId: true, status: true, startedAt: true, submittedAt: true },
  });
  if (!current) throw new ResourceNotFoundError("VENTURE_OBSERVATION_NOT_FOUND");
  assertSameOrganization(organizationId, current.organizationId);
  assertObservationStatusTransition(current.status, status);

  const updated = await db.ventureObservation.update({
    where: { id: observationId },
    data: {
      status: status as "IN_PROGRESS" | "MISSED" | "SUBMITTED",
      ...(status === "IN_PROGRESS" && !current.startedAt ? { startedAt: new Date() } : {}),
      ...(status === "SUBMITTED" ? { submittedAt: new Date() } : {}),
    },
    select: { id: true, status: true, startedAt: true, submittedAt: true },
  });
  return {
    id: updated.id,
    status: updated.status,
    startedAt: updated.startedAt?.toISOString() ?? null,
    submittedAt: updated.submittedAt?.toISOString() ?? null,
  };
}
