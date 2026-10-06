import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { db } from "@/lib/db";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import { areMetricSemanticsCompatible } from "@/lib/analytics/metric-compatibility";
import { createProtocolVersionSchema, type CreateProtocolVersionInput } from "@/lib/tracking-protocols/schemas";

export type IndicatorDefinitionDto = {
  id: string;
  key: string;
  label: string;
  valueType: "INTEGER" | "CURRENCY" | "ENUM";
  unit: string | null;
  position: number;
  allowedValues: string[] | null;
  metricDefinitionId?: string | null;
};

export type TrackingProtocolVersionDto = {
  id: string;
  version: number;
  label: string | null;
  indicators: IndicatorDefinitionDto[];
};

export type TrackingProtocolDto = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  versions: TrackingProtocolVersionDto[];
};

export function enumOptions(value: Prisma.JsonValue | null): string[] | null {
  return Array.isArray(value) && value.every((option) => typeof option === "string") ? value as string[] : null;
}

export async function listTrackingProtocols(organizationId: string): Promise<TrackingProtocolDto[]> {
  const protocols = await db.trackingProtocol.findMany({
    where: { organizationId },
    include: { versions: { orderBy: { version: "desc" }, include: { indicators: { orderBy: { position: "asc" } } } } },
    orderBy: { name: "asc" },
  });
  return protocols.map((protocol) => ({
    id: protocol.id,
    slug: protocol.slug,
    name: protocol.name,
    description: protocol.description,
    versions: protocol.versions.map((version) => ({
      id: version.id,
      version: version.version,
      label: version.label,
      indicators: version.indicators.map((indicator) => ({
        id: indicator.id,
        key: indicator.key,
        label: indicator.label,
        valueType: indicator.valueType,
        unit: indicator.unit,
        position: indicator.position,
        allowedValues: enumOptions(indicator.allowedValues),
        metricDefinitionId: indicator.metricDefinitionId,
      })),
    })),
  }));
}

export async function createProtocolVersion(organizationId: string, rawInput: CreateProtocolVersionInput): Promise<TrackingProtocolDto> {
  const input = createProtocolVersionSchema.parse(rawInput);
  const protocolId = await db.$transaction(async (tx) => {
    let protocol;
    if (input.protocolId) {
      // The protocol lock makes monotonically increasing version numbers safe under concurrent publication.
      await tx.$queryRaw`SELECT "id" FROM "TrackingProtocol" WHERE "organizationId" = ${organizationId} AND "id" = ${input.protocolId} FOR UPDATE`;
      protocol = await tx.trackingProtocol.findFirst({ where: { organizationId, id: input.protocolId }, select: { id: true } });
      if (!protocol) throw new ResourceNotFoundError("TRACKING_PROTOCOL_NOT_FOUND");
    } else {
      const baseSlug = input.name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "protocol";
      protocol = await tx.trackingProtocol.create({
        data: { organizationId, name: input.name, description: input.description || null, slug: `${baseSlug}-${randomUUID().slice(0, 8)}` },
        select: { id: true },
      });
    }
    const latest = await tx.trackingProtocolVersion.findFirst({ where: { organizationId, trackingProtocolId: protocol.id }, orderBy: { version: "desc" }, include: { indicators: true } });
    const createdVersion = await tx.trackingProtocolVersion.create({
      data: {
        organizationId,
        trackingProtocolId: protocol.id,
        version: (latest?.version ?? 0) + 1,
        label: input.label || null,
      },
      select: { id: true },
    });
    for (const [position, indicator] of input.indicators.entries()) {
      const previous = latest?.indicators.find((item) => item.key === indicator.key);
      let metricDefinitionId = indicator.metricDefinitionId ?? null;
      if (!metricDefinitionId && previous?.metricDefinitionId && areMetricSemanticsCompatible(indicator, { ...previous, allowedValues: enumOptions(previous.allowedValues) })) metricDefinitionId = previous.metricDefinitionId;
      if (metricDefinitionId) {
        await tx.$queryRaw`SELECT "id" FROM "MetricDefinition" WHERE "organizationId" = ${organizationId} AND "id" = ${metricDefinitionId} FOR SHARE`;
        const metric = await tx.metricDefinition.findFirst({ where: { organizationId, id: metricDefinitionId, archivedAt: null } });
        if (!metric) throw new ResourceNotFoundError("METRIC_NOT_FOUND");
        if (!areMetricSemanticsCompatible(indicator, { ...metric, allowedValues: enumOptions(metric.allowedValues) })) throw new DomainConflictError("METRIC_MAPPING_INCOMPATIBLE");
      } else {
        // Protocol-local automatic identity never infers equivalence with another protocol.
        const metric = await tx.metricDefinition.create({ data: {
          organizationId, key: `protocol_${indicator.key}_${randomUUID().replaceAll("-", "")}`,
          label: indicator.label, valueType: indicator.valueType, unit: indicator.unit || null,
          allowedValues: indicator.valueType === "ENUM" ? indicator.allowedValues ?? [] : Prisma.DbNull,
          primaryAggregation: indicator.valueType === "ENUM" ? "DISTRIBUTION" : "TOTAL",
        }, select: { id: true } });
        metricDefinitionId = metric.id;
      }
      if (await tx.indicatorDefinition.findFirst({ where: { organizationId, trackingProtocolVersionId: createdVersion.id, metricDefinitionId }, select: { id: true } })) throw new DomainConflictError("METRIC_DUPLICATE_IN_VERSION");
      await tx.indicatorDefinition.create({ data: {
        organizationId, trackingProtocolVersionId: createdVersion.id, key: indicator.key, label: indicator.label,
        valueType: indicator.valueType, unit: indicator.unit || null, position, metricDefinitionId,
        allowedValues: indicator.valueType === "ENUM" ? indicator.allowedValues ?? [] : Prisma.DbNull,
      } });
    }
    return protocol.id;
  });
  const protocol = (await listTrackingProtocols(organizationId)).find((item) => item.id === protocolId);
  if (!protocol) throw new ResourceNotFoundError("TRACKING_PROTOCOL_NOT_FOUND");
  return protocol;
}
