import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import { isEnrollmentEligibleAt } from "@/lib/observations/validation";
import { observedValue } from "@/lib/monitoring/aggregates";
import { aggregateMetric } from "@/lib/analytics/aggregates";
import { ambiguousOffsets } from "@/lib/analytics/comparability";
import { pairedMetric, type PairedValue } from "@/lib/analytics/paired";
import { assertAnalyticsAccess, type AnalyticsAccess } from "@/lib/analytics/access";
import type { AnalyticsCoverage, CohortAnalytics, MetricInput } from "@/lib/analytics/types";

export const ANALYTICS_MAX_OBSERVATIONS = 50000;
export const metricSelect = { id: true, key: true, label: true, valueType: true, unit: true, allowedValues: true, primaryAggregation: true } as const;
export function metricFrom(record: { id: string; key: string; label: string; valueType: MetricInput["valueType"]; unit: string | null; allowedValues: Prisma.JsonValue; primaryAggregation: MetricInput["primaryAggregation"] }): MetricInput {
  return { ...record, allowedValues: Array.isArray(record.allowedValues) ? record.allowedValues.filter((value): value is string => typeof value === "string") : [] };
}

export async function getCohortAnalytics(access: AnalyticsAccess, cohortId: string, client: Prisma.TransactionClient = db, selectedPair?: { baselineWaveId: string; followUpWaveId: string }): Promise<CohortAnalytics> {
  const { organizationId } = await assertAnalyticsAccess(access, undefined, client);
  const [observations, enrollments, waves, values] = await Promise.all([
    client.ventureObservation.count({ where: { organizationId, cohortId } }),
    client.ventureEnrollment.count({ where: { organizationId, cohortId } }),
    client.followUpWave.count({ where: { organizationId, cohortId } }),
    client.observationValue.count({ where: { organizationId, observation: { organizationId, cohortId } } }),
  ]);
  if (observations > ANALYTICS_MAX_OBSERVATIONS || values > ANALYTICS_MAX_OBSERVATIONS || enrollments > 10000 || waves > 500) throw new DomainConflictError("ANALYTICS_SCOPE_TOO_LARGE");
  const cohort = await client.cohort.findFirst({
    where: { organizationId, id: cohortId },
    select: {
      id: true, name: true, fundingProgramId: true, fundingCallId: true, fundingProgram: { select: { name: true } },
      trackingProtocolVersion: { select: { id: true, version: true, trackingProtocol: { select: { name: true } }, indicators: {
        where: { organizationId }, orderBy: { position: "asc" }, select: { id: true, key: true, label: true, valueType: true, unit: true, allowedValues: true, metricDefinitionId: true, metricDefinition: { select: metricSelect } },
      } } },
      enrollments: { where: { organizationId }, select: { id: true, enrolledAt: true, withdrawnAt: true } },
      followUpWaves: { where: { organizationId }, orderBy: { sequence: "asc" }, select: {
        id: true, name: true, kind: true, sequence: true, offsetMonths: true, status: true, scheduledFor: true, opensAt: true, createdAt: true,
        observations: { where: { organizationId }, select: { ventureEnrollmentId: true, status: true, values: { where: { organizationId }, select: { indicatorDefinitionId: true, integerValue: true, decimalValue: true, textValue: true } } } },
      } },
    },
  });
  if (!cohort) throw new ResourceNotFoundError("COHORT_NOT_FOUND");
  if (selectedPair && (selectedPair.baselineWaveId === selectedPair.followUpWaveId || ![selectedPair.baselineWaveId, selectedPair.followUpWaveId].every((id) => cohort.followUpWaves.some((wave) => wave.id === id)))) throw new DomainConflictError("ANALYTICS_PAIRED_WAVES_INVALID");
  const indicators = cohort.trackingProtocolVersion?.indicators ?? [];
  const metrics = [...new Map(indicators.flatMap((indicator) => indicator.metricDefinition ? [[indicator.metricDefinition.id, metricFrom(indicator.metricDefinition)] as const] : [])).values()];
  const valuesByWave = new Map<string, Map<string, PairedValue[]>>();
  const waveResults = cohort.followUpWaves.map((wave) => {
    const reference = wave.scheduledFor ?? wave.opensAt ?? wave.createdAt;
    const eligible = cohort.enrollments.filter((enrollment) => isEnrollmentEligibleAt(enrollment, reference, Boolean(wave.scheduledFor)));
    const eligibleIds = new Set(eligible.map((enrollment) => enrollment.id));
    const rows = wave.observations.filter((observation) => eligibleIds.has(observation.ventureEnrollmentId));
    const submitted = rows.filter((row) => row.status === "SUBMITTED");
    const coverage: AnalyticsCoverage = {
      expected: eligible.length, submitted: submitted.length,
      pending: eligible.length - rows.length + rows.filter((row) => row.status === "PENDING").length,
      inProgress: rows.filter((row) => row.status === "IN_PROGRESS").length, missed: rows.filter((row) => row.status === "MISSED").length,
      notEligible: cohort.enrollments.length - eligible.length,
      withdrawn: cohort.enrollments.filter((enrollment) => enrollment.withdrawnAt && enrollment.withdrawnAt <= reference).length,
      percentage: eligible.length ? submitted.length * 100 / eligible.length : null,
    };
    const metricValues = new Map<string, PairedValue[]>();
    const aggregates = metrics.map((metric) => {
      const mapped = indicators.filter((indicator) => indicator.metricDefinitionId === metric.id);
      // Multiple questions for one metric in a version have no unambiguous analytical value.
      const indicator = mapped.length === 1 ? mapped[0] : null;
      const definition = indicator ? { ...indicator, allowedValues: Array.isArray(indicator.allowedValues) ? indicator.allowedValues.filter((v): v is string => typeof v === "string") : [] } : null;
      const values = submitted.map((row) => {
        const matching = indicator ? row.values.filter((value) => value.indicatorDefinitionId === indicator.id) : [];
        return { enrollmentId: row.ventureEnrollmentId, value: definition && matching.length === 1 ? observedValue(definition, matching[0]) : null };
      });
      metricValues.set(metric.id, values);
      return aggregateMetric(metric, values.map((value) => value.value), submitted.length);
    });
    valuesByWave.set(wave.id, metricValues);
    return { id: wave.id, name: wave.name, offsetMonths: wave.offsetMonths, sequence: wave.sequence, status: wave.status, referenceAt: reference.toISOString(), coverage, metrics: aggregates };
  });
  const baselineCandidates = cohort.followUpWaves.filter((wave) => wave.kind === "BASELINE");
  const baseline = selectedPair ? cohort.followUpWaves.find((wave) => wave.id === selectedPair.baselineWaveId)! : baselineCandidates.length === 1 ? baselineCandidates[0] : null;
  const paired = baseline ? waveResults.filter((wave) => selectedPair ? wave.id === selectedPair.followUpWaveId : wave.id !== baseline.id).flatMap((wave) => metrics.flatMap((metric) => {
    const result = pairedMetric(metric, baseline.id, wave.id, valuesByWave.get(baseline.id)?.get(metric.id) ?? [], valuesByWave.get(wave.id)?.get(metric.id) ?? []);
    return result ? [result] : [];
  })) : [];
  return {
    id: cohort.id, name: cohort.name, programId: cohort.fundingProgramId, programName: cohort.fundingProgram.name, callId: cohort.fundingCallId,
    protocol: cohort.trackingProtocolVersion ? { id: cohort.trackingProtocolVersion.id, name: cohort.trackingProtocolVersion.trackingProtocol.name, version: cohort.trackingProtocolVersion.version } : null,
    enrollmentCount: cohort.enrollments.length, waves: waveResults, paired,
    quality: { unmappedIndicators: indicators.filter((indicator) => !indicator.metricDefinitionId).length, missingOffsets: waveResults.filter((wave) => wave.offsetMonths === null).length, ambiguousOffsets: ambiguousOffsets(waveResults) },
  };
}

export async function getPairedCohortAnalysis(access: AnalyticsAccess, cohortId: string, baselineWaveId: string, followUpWaveId: string, client: Prisma.TransactionClient = db) {
  return getCohortAnalytics(access, cohortId, client, { baselineWaveId, followUpWaveId });
}
