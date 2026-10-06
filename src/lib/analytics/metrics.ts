import { Prisma, type MetricAggregationMode } from "@prisma/client";
import { assertAnalyticsAccess, type AnalyticsAccess } from "./access";
import { areMetricSemanticsCompatible, canChangeMetricMapping, type MetricSemantics } from "./metric-compatibility";
import { metricDefinitionSchema, type MetricDefinitionInput } from "./metric-schemas";
import { db } from "@/lib/db";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";

function options(value: Prisma.JsonValue | null): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value as string[] : null;
}

export type MetricIndicatorDto = MetricSemantics & {
  id: string; key: string; label: string; unit: string | null; allowedValues: string[] | null;
  protocolId: string; protocolName: string; protocolVersion: number; hasObservations: boolean;
};
export type MetricDefinitionDto = MetricSemantics & {
  id: string; key: string; label: string; description: string | null; unit: string | null;
  allowedValues: string[] | null; primaryAggregation: MetricAggregationMode; archivedAt: string | null;
  indicators: MetricIndicatorDto[];
};

export async function listMetrics(access: AnalyticsAccess): Promise<{ metrics: MetricDefinitionDto[]; unmappedIndicators: MetricIndicatorDto[] }> {
  const { organizationId } = await assertAnalyticsAccess(access, "ANALYST");
  const [metrics, indicators] = await Promise.all([
    db.metricDefinition.findMany({ where: { organizationId }, orderBy: [{ archivedAt: "asc" }, { label: "asc" }] }),
    db.indicatorDefinition.findMany({ where: { organizationId }, include: { trackingProtocolVersion: { include: { trackingProtocol: { select: { id: true, name: true } } } }, _count: { select: { observationValues: true } } }, orderBy: [{ trackingProtocolVersionId: "asc" }, { position: "asc" }] }),
  ]);
  const mapped = new Map<string, MetricIndicatorDto[]>();
  const unmappedIndicators: MetricIndicatorDto[] = [];
  for (const indicator of indicators) {
    const dto: MetricIndicatorDto = {
      id: indicator.id, key: indicator.key, label: indicator.label, valueType: indicator.valueType, unit: indicator.unit,
      allowedValues: options(indicator.allowedValues), protocolId: indicator.trackingProtocolVersion.trackingProtocol.id,
      protocolName: indicator.trackingProtocolVersion.trackingProtocol.name, protocolVersion: indicator.trackingProtocolVersion.version,
      hasObservations: indicator._count.observationValues > 0,
    };
    if (indicator.metricDefinitionId) mapped.set(indicator.metricDefinitionId, [...(mapped.get(indicator.metricDefinitionId) ?? []), dto]);
    else unmappedIndicators.push(dto);
  }
  return { metrics: metrics.map((metric) => ({ id: metric.id, key: metric.key, label: metric.label, description: metric.description, valueType: metric.valueType, unit: metric.unit, allowedValues: options(metric.allowedValues), primaryAggregation: metric.primaryAggregation, archivedAt: metric.archivedAt?.toISOString() ?? null, indicators: mapped.get(metric.id) ?? [] })), unmappedIndicators };
}

function metricData(input: MetricDefinitionInput) {
  return { ...input, description: input.description || null, unit: input.unit || null, allowedValues: input.valueType === "ENUM" ? input.allowedValues ?? [] : Prisma.DbNull };
}

export async function createMetric(access: AnalyticsAccess, rawInput: MetricDefinitionInput) {
  const input = metricDefinitionSchema.parse(rawInput);
  return db.$transaction(async (client) => {
    const { organizationId } = await assertAnalyticsAccess(access, "MANAGER", client);
    if (await client.metricDefinition.findUnique({ where: { organizationId_key: { organizationId, key: input.key } }, select: { id: true } })) throw new DomainConflictError("METRIC_KEY_EXISTS");
    return client.metricDefinition.create({ data: { organizationId, ...metricData(input) }, select: { id: true } });
  }).catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new DomainConflictError("METRIC_KEY_EXISTS");
    throw error;
  });
}

export async function updateMetric(access: AnalyticsAccess, id: string, rawInput: MetricDefinitionInput) {
  const input = metricDefinitionSchema.parse(rawInput);
  return db.$transaction(async (client) => {
    const { organizationId } = await assertAnalyticsAccess(access, "MANAGER", client);
    await client.$queryRaw`SELECT "id" FROM "MetricDefinition" WHERE "organizationId" = ${organizationId} AND "id" = ${id} FOR UPDATE`;
    const metric = await client.metricDefinition.findFirst({ where: { organizationId, id }, include: { indicators: { include: { _count: { select: { observationValues: true } } } } } });
    if (!metric) throw new ResourceNotFoundError("METRIC_NOT_FOUND");
    if (metric.archivedAt) throw new DomainConflictError("METRIC_ARCHIVED");
    if (input.key !== metric.key) throw new DomainConflictError("METRIC_KEY_IMMUTABLE");
    const compatible = areMetricSemanticsCompatible({ ...metric, allowedValues: options(metric.allowedValues) }, input);
    if (!compatible && metric.indicators.some((indicator) => indicator._count.observationValues > 0)) throw new DomainConflictError("METRIC_HISTORY_FROZEN");
    if (metric.indicators.some((indicator) => !areMetricSemanticsCompatible({ ...indicator, allowedValues: options(indicator.allowedValues) }, input))) throw new DomainConflictError("METRIC_MAPPING_INCOMPATIBLE");
    return client.metricDefinition.update({ where: { organizationId_id: { organizationId, id } }, data: metricData(input), select: { id: true } });
  });
}

export async function mapIndicatorToMetric(access: AnalyticsAccess, indicatorDefinitionId: string, metricDefinitionId: string | null) {
  return db.$transaction(async (client) => {
    const { organizationId } = await assertAnalyticsAccess(access, "MANAGER", client);
    await client.$queryRaw`SELECT "id" FROM "IndicatorDefinition" WHERE "organizationId" = ${organizationId} AND "id" = ${indicatorDefinitionId} FOR UPDATE`;
    const indicator = await client.indicatorDefinition.findFirst({ where: { organizationId, id: indicatorDefinitionId }, include: { _count: { select: { observationValues: true } } } });
    if (!indicator) throw new ResourceNotFoundError("INDICATOR_NOT_FOUND");
    if (!canChangeMetricMapping(indicator.metricDefinitionId, metricDefinitionId, indicator._count.observationValues > 0)) throw new DomainConflictError("METRIC_MAPPING_HISTORY_FROZEN");
    if (metricDefinitionId) {
      await client.$queryRaw`SELECT "id" FROM "MetricDefinition" WHERE "organizationId" = ${organizationId} AND "id" = ${metricDefinitionId} FOR UPDATE`;
      const metric = await client.metricDefinition.findFirst({ where: { organizationId, id: metricDefinitionId, archivedAt: null } });
      if (!metric) throw new ResourceNotFoundError("METRIC_NOT_FOUND");
      if (!areMetricSemanticsCompatible({ ...indicator, allowedValues: options(indicator.allowedValues) }, { ...metric, allowedValues: options(metric.allowedValues) })) throw new DomainConflictError("METRIC_MAPPING_INCOMPATIBLE");
      if (await client.indicatorDefinition.findFirst({ where: { organizationId, trackingProtocolVersionId: indicator.trackingProtocolVersionId, metricDefinitionId, id: { not: indicatorDefinitionId } }, select: { id: true } })) throw new DomainConflictError("METRIC_DUPLICATE_IN_VERSION");
    }
    return client.indicatorDefinition.update({ where: { organizationId_id: { organizationId, id: indicatorDefinitionId } }, data: { metricDefinitionId }, select: { id: true } });
  });
}

export async function archiveMetric(access: AnalyticsAccess, id: string) {
  return db.$transaction(async (client) => {
    const { organizationId } = await assertAnalyticsAccess(access, "MANAGER", client);
    await client.$queryRaw`SELECT "id" FROM "MetricDefinition" WHERE "organizationId" = ${organizationId} AND "id" = ${id} FOR UPDATE`;
    const metric = await client.metricDefinition.findFirst({ where: { organizationId, id }, include: { _count: { select: { indicators: true } } } });
    if (!metric) throw new ResourceNotFoundError("METRIC_NOT_FOUND");
    if (metric._count.indicators) throw new DomainConflictError("METRIC_IN_USE");
    if (metric.archivedAt) return { id: metric.id };
    return client.metricDefinition.update({ where: { organizationId_id: { organizationId, id } }, data: { archivedAt: metric.archivedAt ?? new Date() }, select: { id: true } });
  });
}
