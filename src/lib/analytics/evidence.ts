import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import { observedValue } from "@/lib/monitoring/aggregates";
import { assertAnalyticsAccess, type AnalyticsAccess } from "@/lib/analytics/access";
import { metricFrom, metricSelect } from "@/lib/analytics/cohort";

const evidenceSchema = z.object({ cohortId: z.string().min(1).max(100), waveId: z.string().min(1).max(100), metricId: z.string().min(1).max(100), missing: z.boolean().optional(), page: z.number().int().min(1).max(10000).optional() }).strict();
export async function getMetricEvidence(access: AnalyticsAccess, input: z.infer<typeof evidenceSchema>, client: Prisma.TransactionClient = db) {
  const scope = evidenceSchema.parse(input);
  const { organizationId } = await assertAnalyticsAccess(access, "ANALYST", client);
  const wave = await client.followUpWave.findFirst({ where: { organizationId, cohortId: scope.cohortId, id: scope.waveId }, select: { name: true, scheduledFor: true, opensAt: true, createdAt: true, cohort: { select: { name: true, trackingProtocolVersionId: true } } } });
  if (!wave) throw new ResourceNotFoundError("FOLLOW_UP_WAVE_NOT_FOUND");
  const indicators = await client.indicatorDefinition.findMany({ where: { organizationId, trackingProtocolVersionId: wave.cohort.trackingProtocolVersionId ?? "", metricDefinitionId: scope.metricId }, select: { id: true, key: true, label: true, valueType: true, unit: true, allowedValues: true, metricDefinition: { select: metricSelect } } });
  if (!indicators.length) throw new ResourceNotFoundError("METRIC_NOT_FOUND");
  if (indicators.length !== 1) throw new DomainConflictError("ANALYTICS_METRIC_AMBIGUOUS");
  const indicator = indicators[0];
  if (!indicator.metricDefinition) throw new ResourceNotFoundError("METRIC_NOT_FOUND");
  const reference = wave.scheduledFor ?? wave.opensAt ?? wave.createdAt;
  const enrolledBy = wave.scheduledFor ? new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate(), 23, 59, 59, 999)) : reference;
  const validValue: Prisma.ObservationValueWhereInput = {
    organizationId, indicatorDefinitionId: indicator.id,
    ...(indicator.valueType === "INTEGER" ? { integerValue: { not: null } } : indicator.valueType === "CURRENCY" ? { decimalValue: { not: null } } : { textValue: { in: metricFrom(indicator.metricDefinition).allowedValues } }),
  };
  const contribution: Prisma.VentureObservationWhereInput = { status: "SUBMITTED", values: { some: validValue } };
  const contributingObservation: Prisma.VentureObservationWhereInput = { organizationId, cohortId: scope.cohortId, followUpWaveId: scope.waveId, ...contribution };
  const where: Prisma.VentureEnrollmentWhereInput = {
    organizationId, cohortId: scope.cohortId, enrolledAt: { lte: enrolledBy }, OR: [{ withdrawnAt: null }, { withdrawnAt: { gt: reference } }],
    ...(scope.missing ? { NOT: { observations: { some: contributingObservation } } } : { observations: { some: contributingObservation } }),
  };
  const page = scope.page ?? 1; const pageSize = 40;
  const [total, records] = await Promise.all([
    client.ventureEnrollment.count({ where }),
    client.ventureEnrollment.findMany({ where, orderBy: { id: "asc" }, skip: (page - 1) * pageSize, take: pageSize,
      select: { venture: { select: { id: true, name: true } }, observations: { where: { organizationId, cohortId: scope.cohortId, followUpWaveId: scope.waveId }, take: 1, select: { id: true, status: true, submittedAt: true, values: { where: { organizationId, indicatorDefinitionId: indicator.id }, select: { indicatorDefinitionId: true, integerValue: true, decimalValue: true, textValue: true } } } } },
    }),
  ]);
  const definition = { ...indicator, allowedValues: metricFrom(indicator.metricDefinition).allowedValues };
  return { page, pageSize, total, metric: metricFrom(indicator.metricDefinition), rows: records.map((record) => {
    const observation = record.observations[0];
    return { observationId: observation?.id ?? null, ventureId: record.venture.id, ventureName: record.venture.name, cohortName: wave.cohort.name, waveName: wave.name, value: observation?.status === "SUBMITTED" ? observedValue(definition, observation.values[0]) : null, status: observation?.status ?? "PENDING", submittedAt: observation?.submittedAt?.toISOString() ?? null, eligible: true };
  }) };
}
