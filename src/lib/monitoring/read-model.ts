import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { aggregateIndicators, observedValue, waveAttention, type IndicatorAggregate, type IndicatorInput, type WaveAttention } from "@/lib/monitoring/aggregates";
import { coverageFrom, isObservationPendingForWave, type CoverageDto } from "@/lib/monitoring/coverage";

export type { CoverageDto } from "@/lib/monitoring/coverage";

function protocolSelect(organizationId: string) {
  return {
    id: true, version: true, label: true,
    trackingProtocol: { select: { name: true } },
    indicators: {
      where: { organizationId }, orderBy: [{ position: "asc" }, { key: "asc" }],
      select: { id: true, key: true, label: true, valueType: true, unit: true, allowedValues: true },
    },
  } satisfies Prisma.TrackingProtocolVersionSelect;
}

const valueSelect = { indicatorDefinitionId: true, integerValue: true, decimalValue: true, textValue: true } as const;
const waveFields = { id: true, name: true, kind: true, sequence: true, status: true, scheduledFor: true, opensAt: true, closesAt: true, createdAt: true } as const;

function indicatorsFrom(records: { id: string; key: string; label: string; valueType: "INTEGER" | "CURRENCY" | "ENUM"; unit: string | null; allowedValues: Prisma.JsonValue }[]): IndicatorInput[] {
  return records.map((indicator) => ({ ...indicator, allowedValues: Array.isArray(indicator.allowedValues) ? indicator.allowedValues.filter((value): value is string => typeof value === "string") : [] }));
}

function valuesFrom(records: { indicatorDefinitionId: string; integerValue: number | null; decimalValue: Prisma.Decimal | null; textValue: string | null }[]) {
  return records.map((value) => ({ ...value, decimalValue: value.decimalValue?.toString() ?? null }));
}

function waveDates(wave: { scheduledFor: Date | null; opensAt: Date | null; closesAt: Date | null }) {
  return { scheduledFor: wave.scheduledFor?.toISOString() ?? null, opensAt: wave.opensAt?.toISOString() ?? null, closesAt: wave.closesAt?.toISOString() ?? null };
}

export type CohortResultsDto = {
  cohortId: string;
  protocol: { id: string; name: string; version: number; label: string | null } | null;
  waves: { id: string; name: string; kind: string; sequence: number; status: string; scheduledFor: string | null; coverage: CoverageDto; indicators: IndicatorAggregate[] }[];
};

export async function getCohortResults(organizationId: string, cohortId: string): Promise<CohortResultsDto | null> {
  const cohort = await db.cohort.findFirst({
    where: { organizationId, id: cohortId },
    select: {
      id: true, trackingProtocolVersion: { select: protocolSelect(organizationId) },
      followUpWaves: {
        where: { organizationId }, orderBy: { sequence: "asc" },
        select: { ...waveFields, observations: {
          where: { organizationId, cohortId },
          select: { status: true, ventureEnrollment: { select: { enrolledAt: true, withdrawnAt: true } }, values: { where: { organizationId }, select: valueSelect } },
        } },
      },
    },
  });
  if (!cohort) return null;
  const version = cohort.trackingProtocolVersion;
  const indicators = indicatorsFrom(version?.indicators ?? []);
  return {
    cohortId: cohort.id,
    protocol: version ? { id: version.id, name: version.trackingProtocol.name, version: version.version, label: version.label } : null,
    waves: cohort.followUpWaves.map((wave) => ({
      id: wave.id, name: wave.name, kind: wave.kind, sequence: wave.sequence, status: wave.status,
      scheduledFor: wave.scheduledFor?.toISOString() ?? null,
      coverage: coverageFrom(wave.observations, wave),
      indicators: aggregateIndicators(indicators, wave.observations.map((observation) => ({ status: observation.status, values: valuesFrom(observation.values) }))),
    })),
  };
}

export type MonitoringWaveDto = {
  id: string; name: string; kind: string; status: string; sequence: number;
  scheduledFor: string | null; opensAt: string | null; closesAt: string | null;
  attention: WaveAttention; coverage: CoverageDto;
  cohort: { id: string; name: string; fundingProgramId: string; fundingProgram: { name: string } };
  pendingObservations: { id: string; status: string; venture: { id: string; name: string } }[];
};

export async function getOrganizationMonitoring(organizationId: string, now = new Date()): Promise<MonitoringWaveDto[]> {
  const records = await db.followUpWave.findMany({
    where: { organizationId },
    orderBy: [{ scheduledFor: "asc" }, { sequence: "asc" }],
    select: { ...waveFields,
      cohort: { select: { id: true, name: true, fundingProgramId: true, fundingProgram: { select: { name: true } } } },
      observations: { where: { organizationId }, select: {
        id: true, status: true, ventureEnrollment: { select: { enrolledAt: true, withdrawnAt: true, venture: { select: { id: true, name: true } } } },
      } },
    },
  });
  const priority: Record<WaveAttention, number> = { OVERDUE: 0, OPEN: 1, UPCOMING: 2, CLOSED: 3, ARCHIVED: 4 };
  return records.map((wave) => {
    const coverage = coverageFrom(wave.observations, wave);
    const dates = waveDates(wave);
    return {
      id: wave.id, name: wave.name, kind: wave.kind, status: wave.status, sequence: wave.sequence, cohort: wave.cohort, ...dates,
      coverage, attention: waveAttention({ ...wave, ...dates }, coverage.pending + coverage.inProgress, now),
      pendingObservations: wave.observations.filter((observation) => isObservationPendingForWave(observation, wave))
        .map((observation) => ({ id: observation.id, status: observation.status, venture: observation.ventureEnrollment.venture })),
    };
  }).sort((left, right) => priority[left.attention] - priority[right.attention] || (left.scheduledFor ?? left.opensAt ?? "9999").localeCompare(right.scheduledFor ?? right.opensAt ?? "9999") || left.sequence - right.sequence);
}

export type VentureTrajectoryDto = {
  enrollmentId: string; enrollmentStatus: string; enrolledAt: string; withdrawnAt: string | null;
  cohort: { id: string; name: string; fundingProgramId: string; fundingProgram: { name: string } };
  protocol: { id: string; name: string; version: number; label: string | null } | null;
  indicators: IndicatorInput[];
  waves: { id: string; name: string; kind: string; status: string; scheduledFor: string | null; observationId: string | null; observationStatus: string | null; submittedAt: string | null; values: { indicatorId: string; value: number | string | null }[] }[];
};

export async function getVentureTrajectory(organizationId: string, ventureId: string): Promise<VentureTrajectoryDto[]> {
  const enrollments = await db.ventureEnrollment.findMany({
    where: { organizationId, ventureId }, orderBy: { enrolledAt: "desc" },
    select: {
      id: true, status: true, enrolledAt: true, withdrawnAt: true,
      cohort: { select: { id: true, name: true, fundingProgramId: true, fundingProgram: { select: { name: true } }, trackingProtocolVersion: { select: protocolSelect(organizationId) }, followUpWaves: { where: { organizationId }, orderBy: { sequence: "asc" }, select: waveFields } } },
      observations: { where: { organizationId }, select: { id: true, followUpWaveId: true, status: true, submittedAt: true, values: { where: { organizationId }, select: valueSelect } } },
    },
  });
  return enrollments.map((enrollment) => {
    const version = enrollment.cohort.trackingProtocolVersion;
    const indicators = indicatorsFrom(version?.indicators ?? []);
    return {
      enrollmentId: enrollment.id, enrollmentStatus: enrollment.status, enrolledAt: enrollment.enrolledAt.toISOString(), withdrawnAt: enrollment.withdrawnAt?.toISOString() ?? null,
      cohort: { id: enrollment.cohort.id, name: enrollment.cohort.name, fundingProgramId: enrollment.cohort.fundingProgramId, fundingProgram: enrollment.cohort.fundingProgram },
      protocol: version ? { id: version.id, name: version.trackingProtocol.name, version: version.version, label: version.label } : null,
      indicators,
      waves: enrollment.cohort.followUpWaves.map((wave) => {
        const observation = enrollment.observations.find((current) => current.followUpWaveId === wave.id);
        const values = valuesFrom(observation?.values ?? []);
        return {
          id: wave.id, name: wave.name, kind: wave.kind, status: wave.status, scheduledFor: wave.scheduledFor?.toISOString() ?? null,
          observationId: observation?.id ?? null, observationStatus: observation?.status ?? null, submittedAt: observation?.submittedAt?.toISOString() ?? null,
          values: indicators.map((indicator) => ({ indicatorId: indicator.id, value: observation?.status === "SUBMITTED" ? observedValue(indicator, values.find((value) => value.indicatorDefinitionId === indicator.id)) : null })),
        };
      }),
    };
  });
}

export async function getLatestCohortResults(organizationId: string): Promise<{ cohortName: string; programId: string; programName: string; results: CohortResultsDto } | null> {
  const observation = await db.ventureObservation.findFirst({
    where: { organizationId, status: "SUBMITTED" },
    orderBy: [{ submittedAt: "desc" }, { updatedAt: "desc" }],
    select: { cohort: { select: { id: true, name: true, fundingProgramId: true, fundingProgram: { select: { name: true } } } } },
  });
  if (!observation) return null;
  const results = await getCohortResults(organizationId, observation.cohort.id);
  return results ? { cohortName: observation.cohort.name, programId: observation.cohort.fundingProgramId, programName: observation.cohort.fundingProgram.name, results } : null;
}
