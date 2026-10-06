import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { assertObservationStatusTransition } from "@/lib/domain-invariants";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import { saveObservationValuesSchema, type SaveObservationValuesInput } from "@/lib/observations/schemas";
import { isEnrollmentEligibleAt, validateObservationValues } from "@/lib/observations/validation";
import { enumOptions, type IndicatorDefinitionDto } from "@/lib/tracking-protocols/service";

const observationInclude = {
  cohort: { include: { fundingProgram: { select: { id: true, name: true } }, trackingProtocolVersion: { include: { trackingProtocol: { select: { id: true, name: true } }, indicators: { orderBy: { position: "asc" as const } } } } } },
  followUpWave: true,
  ventureEnrollment: { include: { venture: { select: { id: true, name: true } } } },
  values: true,
} as const;

type ObservationRecord = Prisma.VentureObservationGetPayload<{ include: typeof observationInclude }>;

export type ObservationWorkspaceDto = {
  id: string;
  organizationId: string;
  revision: number;
  status: string;
  startedAt: string | null;
  submittedAt: string | null;
  updatedAt: string;
  cohort: { id: string; name: string; fundingProgram: { id: string; name: string } };
  venture: { id: string; name: string };
  wave: { id: string; name: string; status: string; referenceAt: string };
  protocol: { id: string; name: string; versionId: string; version: number; label: string | null } | null;
  indicators: IndicatorDefinitionDto[];
  values: { indicatorDefinitionId: string; value: string | null }[];
  readOnlyReason: "SUBMITTED" | "MISSED" | "WAVE_NOT_OPEN" | "ENROLLMENT_NOT_ELIGIBLE" | "PROTOCOL_MISSING" | null;
};

function serializeObservation(record: ObservationRecord): ObservationWorkspaceDto {
  const version = record.cohort.trackingProtocolVersion;
  const referenceAt = record.followUpWave.scheduledFor ?? record.followUpWave.opensAt ?? record.followUpWave.createdAt;
  const readOnlyReason = record.status === "SUBMITTED" ? "SUBMITTED"
    : record.status === "MISSED" ? "MISSED"
    : record.followUpWave.status !== "OPEN" ? "WAVE_NOT_OPEN"
    : !isEnrollmentEligibleAt(record.ventureEnrollment, referenceAt, Boolean(record.followUpWave.scheduledFor)) ? "ENROLLMENT_NOT_ELIGIBLE"
    : !version?.indicators.length ? "PROTOCOL_MISSING" : null;
  return {
    id: record.id,
    organizationId: record.organizationId,
    revision: record.revision,
    status: record.status,
    startedAt: record.startedAt?.toISOString() ?? null,
    submittedAt: record.submittedAt?.toISOString() ?? null,
    updatedAt: record.updatedAt.toISOString(),
    cohort: { id: record.cohort.id, name: record.cohort.name, fundingProgram: record.cohort.fundingProgram },
    venture: record.ventureEnrollment.venture,
    wave: { id: record.followUpWave.id, name: record.followUpWave.name, status: record.followUpWave.status, referenceAt: referenceAt.toISOString() },
    protocol: version ? { id: version.trackingProtocol.id, name: version.trackingProtocol.name, versionId: version.id, version: version.version, label: version.label } : null,
    indicators: version?.indicators.map((indicator) => ({ id: indicator.id, key: indicator.key, label: indicator.label, valueType: indicator.valueType, unit: indicator.unit, position: indicator.position, allowedValues: enumOptions(indicator.allowedValues) })) ?? [],
    values: record.values.map((value) => ({ indicatorDefinitionId: value.indicatorDefinitionId, value: value.integerValue !== null ? String(value.integerValue) : value.decimalValue !== null ? value.decimalValue.toFixed(2) : value.textValue })),
    readOnlyReason,
  };
}

export async function getObservationWorkspace(organizationId: string, observationId: string): Promise<ObservationWorkspaceDto | null> {
  const record = await db.ventureObservation.findFirst({ where: { organizationId, id: observationId }, include: observationInclude });
  return record ? serializeObservation(record) : null;
}

async function lockObservationContext(tx: Prisma.TransactionClient, organizationId: string, observationId: string): Promise<ObservationRecord> {
  const scope = await tx.ventureObservation.findFirst({ where: { organizationId, id: observationId }, select: { cohortId: true, followUpWaveId: true, ventureEnrollmentId: true } });
  if (!scope) throw new ResourceNotFoundError("VENTURE_OBSERVATION_NOT_FOUND");
  // Shared lock order serializes protocol assignment, withdrawal, wave closure and submission.
  await tx.$queryRaw`SELECT "id" FROM "Cohort" WHERE "organizationId" = ${organizationId} AND "id" = ${scope.cohortId} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "FollowUpWave" WHERE "organizationId" = ${organizationId} AND "cohortId" = ${scope.cohortId} AND "id" = ${scope.followUpWaveId} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "VentureEnrollment" WHERE "organizationId" = ${organizationId} AND "cohortId" = ${scope.cohortId} AND "id" = ${scope.ventureEnrollmentId} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "VentureObservation" WHERE "organizationId" = ${organizationId} AND "id" = ${observationId} FOR UPDATE`;
  const record = await tx.ventureObservation.findFirst({ where: { organizationId, id: observationId }, include: observationInclude });
  if (!record) throw new ResourceNotFoundError("VENTURE_OBSERVATION_NOT_FOUND");
  return record;
}

export async function saveObservationValues(organizationId: string, observationId: string, rawInput: SaveObservationValuesInput): Promise<ObservationWorkspaceDto> {
  const input = saveObservationValuesSchema.parse(rawInput);
  return db.$transaction(async (tx) => {
    const current = await lockObservationContext(tx, organizationId, observationId);
    if (current.revision !== input.expectedRevision) throw new DomainConflictError("OBSERVATION_REVISION_CONFLICT");
    const workspace = serializeObservation(current);
    if (workspace.readOnlyReason) throw new DomainConflictError(`OBSERVATION_${workspace.readOnlyReason}`);
    const values = validateObservationValues(workspace.indicators, input.values);
    if (input.submit && !values.length) throw new DomainConflictError("OBSERVATION_SUBMISSION_EMPTY");
    if (current.status === "PENDING") assertObservationStatusTransition("PENDING", "IN_PROGRESS");
    if (input.submit) assertObservationStatusTransition("IN_PROGRESS", "SUBMITTED");
    // Every save replaces the complete draft snapshot. Missing inputs intentionally stay absent.
    await tx.observationValue.deleteMany({ where: { organizationId, observationId } });
    if (values.length) {
      await tx.observationValue.createMany({ data: values.map((value) => ({ organizationId, observationId, ...value, decimalValue: value.decimalValue === null ? null : new Prisma.Decimal(value.decimalValue) })) });
    }
    const updated = await tx.ventureObservation.updateMany({
      where: { organizationId, id: observationId, revision: input.expectedRevision, status: current.status },
      data: { revision: { increment: 1 }, status: input.submit ? "SUBMITTED" : "IN_PROGRESS", startedAt: current.startedAt ?? new Date(), submittedAt: input.submit ? new Date() : null },
    });
    if (updated.count !== 1) throw new DomainConflictError("OBSERVATION_REVISION_CONFLICT");
    const saved = await tx.ventureObservation.findFirst({ where: { organizationId, id: observationId }, include: observationInclude });
    if (!saved) throw new ResourceNotFoundError("VENTURE_OBSERVATION_NOT_FOUND");
    return serializeObservation(saved);
  });
}

export async function changeObservationStatus(organizationId: string, observationId: string, status: "IN_PROGRESS" | "MISSED", expectedRevision: number) {
  return db.$transaction(async (tx) => {
    const current = await lockObservationContext(tx, organizationId, observationId);
    if (current.revision !== expectedRevision) throw new DomainConflictError("OBSERVATION_REVISION_CONFLICT");
    assertObservationStatusTransition(current.status, status);
    if (current.followUpWave.status !== "OPEN" && !(status === "MISSED" && current.followUpWave.status === "CLOSED")) throw new DomainConflictError("OBSERVATION_WAVE_NOT_OPEN");
    const referenceAt = current.followUpWave.scheduledFor ?? current.followUpWave.opensAt ?? current.followUpWave.createdAt;
    if (!isEnrollmentEligibleAt(current.ventureEnrollment, referenceAt, Boolean(current.followUpWave.scheduledFor))) throw new DomainConflictError("OBSERVATION_ENROLLMENT_NOT_ELIGIBLE");
    const updated = await tx.ventureObservation.updateMany({
      where: { organizationId, id: observationId, revision: expectedRevision, status: current.status },
      data: { status, revision: { increment: 1 }, ...(status === "IN_PROGRESS" && !current.startedAt ? { startedAt: new Date() } : {}) },
    });
    if (updated.count !== 1) throw new DomainConflictError("OBSERVATION_REVISION_CONFLICT");
    const record = await tx.ventureObservation.findFirst({ where: { organizationId, id: observationId }, select: { id: true, status: true, revision: true, startedAt: true, submittedAt: true } });
    if (!record) throw new ResourceNotFoundError("VENTURE_OBSERVATION_NOT_FOUND");
    return { ...record, startedAt: record.startedAt?.toISOString() ?? null, submittedAt: record.submittedAt?.toISOString() ?? null };
  });
}
