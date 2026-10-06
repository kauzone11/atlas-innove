import { Prisma, type ImportBatch } from "@prisma/client";
import { ImportInputError } from "@/lib/imports/errors";
import { importDigest, importJson } from "@/lib/imports/digest";
import { readImportEntities } from "@/lib/imports/entities";
import { IMPORT_LIMITS } from "@/lib/imports/limits";
import type { ImportMapping } from "@/lib/imports/mapping";
import type { ImportEntityType } from "@/lib/imports/templates";
import { lockImportBatch, withImportTransaction } from "@/lib/imports/transaction";
import { evaluateImportBatch, type EvaluatedImportRow } from "@/lib/imports/validation";
import type { ImportReferenceContext } from "@/lib/imports/references";
import { isEnrollmentEligibleAt } from "@/lib/observations/validation";
import { writeObservationGroup } from "@/lib/imports/observations";
import { getImportMetadataPatch } from "@/lib/imports/metadata";

type AppliedEntity = { rowId: string; entityType: ImportEntityType; entityId: string; operation: "CREATE" | "UPDATE"; beforeData?: Prisma.InputJsonValue; externalId?: string; createExternalReference?: boolean };

async function writeStructuralRow(client: Prisma.TransactionClient, batch: ImportBatch, item: EvaluatedImportRow, context: ImportReferenceContext): Promise<AppliedEntity> {
  const { input, refs, existingId } = item.resolved!; const organizationId = batch.organizationId;
  let record: { id: string }; let beforeData: Prisma.InputJsonValue | undefined;
  const mapping = batch.mapping as ImportMapping;
  switch (input.type) {
    case "FUNDING_PROGRAMS": {
      if (existingId) {
        beforeData = importJson(context.state.FUNDING_PROGRAMS.get(existingId));
        record = await client.fundingProgram.update({ where: { organizationId, id: existingId }, data: getImportMetadataPatch(input, mapping) });
      } else record = await client.fundingProgram.create({ data: { ...input.data, organizationId, createdByUserId: batch.createdByUserId } });
      break;
    }
    case "FUNDING_CALLS": record = await client.fundingCall.create({ data: { ...input.data, organizationId, fundingProgramId: refs.funding_program! } }); break;
    case "COHORTS": record = await client.cohort.create({ data: { ...input.data, organizationId, fundingProgramId: refs.funding_program!, fundingCallId: refs.funding_call ?? null } }); break;
    case "VENTURES": {
      if (existingId) {
        beforeData = importJson(context.state.VENTURES.get(existingId));
        record = await client.venture.update({ where: { organizationId, id: existingId }, data: getImportMetadataPatch(input, mapping) });
      } else record = await client.venture.create({ data: { ...input.data, organizationId } });
      break;
    }
    case "VENTURE_ENROLLMENTS": record = await client.ventureEnrollment.create({ data: { ...input.data, organizationId, cohortId: refs.cohort!, ventureId: refs.venture! } }); break;
    case "FOLLOW_UP_WAVES": record = await client.followUpWave.create({ data: { ...input.data, organizationId, cohortId: refs.cohort! } }); break;
    case "MILESTONES": record = await client.milestone.create({ data: { ...input.data, organizationId, ventureId: refs.venture! } }); break;
    case "OBSERVATIONS": throw new ImportInputError("IMPORT_OBSERVATION_GROUP_REQUIRED");
  }
  return { rowId: item.row.id, entityType: input.type, entityId: record.id, operation: item.operation, beforeData, externalId: input.externalId };
}

async function createHistoricalPlaceholders(client: Prisma.TransactionClient, batch: ImportBatch, rows: EvaluatedImportRow[], applied: AppliedEntity[], context: ImportReferenceContext) {
  const byRow = new Map(applied.map((item) => [item.rowId, item]));
  const placeholders: Array<{ rowId: string; cohortId: string; ventureEnrollmentId: string; followUpWaveId: string }> = [];
  for (const item of rows) {
    const { input, refs } = item.resolved!; const entity = byRow.get(item.row.id)!;
    if (input.type === "FOLLOW_UP_WAVES") {
      for (const enrollment of context.state.VENTURE_ENROLLMENTS.values()) {
        if (enrollment.cohortId === refs.cohort && isEnrollmentEligibleAt(enrollment, input.data.scheduledFor!, true)) placeholders.push({ rowId: item.row.id, cohortId: refs.cohort!, ventureEnrollmentId: enrollment.id, followUpWaveId: entity.entityId });
      }
    } else if (input.type === "VENTURE_ENROLLMENTS") {
      for (const wave of context.state.FOLLOW_UP_WAVES.values()) {
        if (wave.cohortId === refs.cohort && isEnrollmentEligibleAt(input.data, wave.scheduledFor ?? wave.opensAt ?? wave.createdAt, Boolean(wave.scheduledFor))) placeholders.push({ rowId: item.row.id, cohortId: refs.cohort!, ventureEnrollmentId: entity.entityId, followUpWaveId: wave.id });
      }
    }
  }
  const source = new Map(placeholders.map((item) => [JSON.stringify([item.ventureEnrollmentId, item.followUpWaveId]), item.rowId]));
  for (let offset = 0; offset < placeholders.length; offset += IMPORT_LIMITS.writeChunkSize) {
    const created = await client.ventureObservation.createManyAndReturn({ data: placeholders.slice(offset, offset + IMPORT_LIMITS.writeChunkSize).map(({ cohortId, ventureEnrollmentId, followUpWaveId }) => ({ organizationId: batch.organizationId, cohortId, ventureEnrollmentId, followUpWaveId })) });
    applied.push(...created.map((record) => ({ rowId: source.get(JSON.stringify([record.ventureEnrollmentId, record.followUpWaveId]))!, entityType: "OBSERVATIONS" as const, entityId: record.id, operation: "CREATE" as const })));
  }
}

async function recordImportChanges(client: Prisma.TransactionClient, batch: ImportBatch, applied: AppliedEntity[]) {
  const changes: Prisma.ImportChangeCreateManyInput[] = [];
  for (const type of new Set(applied.map((item) => item.entityType))) {
    const matching = applied.filter((item) => item.entityType === type);
    const entities = await readImportEntities(client, batch.organizationId, type, matching.map((item) => item.entityId));
    const byId = new Map(entities.map((item) => [item.id, item]));
    for (const item of matching) {
      const entity = byId.get(item.entityId);
      if (!entity) throw new ImportInputError("IMPORT_WRITE_NOT_CONFIRMED");
      changes.push({ organizationId: batch.organizationId, batchId: batch.id, rowId: item.rowId, entityType: type, entityId: item.entityId, operation: item.operation, beforeData: item.beforeData, afterDigest: importDigest(entity) });
    }
  }
  for (let offset = 0; offset < changes.length; offset += IMPORT_LIMITS.writeChunkSize) await client.importChange.createMany({ data: changes.slice(offset, offset + IMPORT_LIMITS.writeChunkSize) });
  const mappings = applied.filter((item) => item.externalId && (item.operation === "CREATE" || item.createExternalReference)).map((item) => ({ organizationId: batch.organizationId, namespace: batch.namespace, entityType: item.entityType, externalId: item.externalId!, entityId: item.entityId, createdByImportBatchId: batch.id }));
  for (let offset = 0; offset < mappings.length; offset += IMPORT_LIMITS.writeChunkSize) await client.externalReference.createMany({ data: mappings.slice(offset, offset + IMPORT_LIMITS.writeChunkSize) });
}

export async function applyImportBatch(userId: string, organizationId: string, batchId: string, expectedRevision: number) {
  let attempted = false;
  try {
    return await withImportTransaction(userId, organizationId, async (client) => {
      const batch = await lockImportBatch(client, organizationId, batchId, expectedRevision);
      if (batch.status !== "READY") throw new ImportInputError("IMPORT_NOT_READY");
      attempted = true;
      const evaluation = await evaluateImportBatch(client, batch, true);
      if (evaluation.rows.some((item) => item.errors.length)) throw new ImportInputError("IMPORT_REVALIDATION_FAILED");
      if (evaluation.rows.some((item) => (item.row.resolvedReferences as { contextDigest?: string } | null)?.contextDigest !== evaluation.context.contextDigest)) throw new ImportInputError("IMPORT_REFERENCE_CHANGED");
      await client.importBatch.update({ where: { id: batchId, organizationId }, data: { status: "APPLYING" } });
      const applied: AppliedEntity[] = [];
      if (batch.type === "OBSERVATIONS") {
        for (const group of evaluation.observationGroups) {
          const entityId = await writeObservationGroup(client, organizationId, group);
          applied.push({ rowId: group.rows[0].row.id, entityType: "OBSERVATIONS", entityId, operation: group.existing ? "UPDATE" : "CREATE", beforeData: group.existing ? importJson(group.existing) : undefined, externalId: group.externalId, createExternalReference: true });
        }
      } else for (const item of evaluation.rows) applied.push(await writeStructuralRow(client, batch, item, evaluation.context));
      await createHistoricalPlaceholders(client, batch, evaluation.rows, applied, evaluation.context);
      await recordImportChanges(client, batch, applied);
      await client.importRow.updateMany({ where: { organizationId, batchId }, data: { status: "APPLIED" } });
      return client.importBatch.update({ where: { id: batchId, organizationId, revision: expectedRevision }, data: { status: "APPLIED", revision: { increment: 1 }, appliedRows: batch.totalRows, appliedAt: new Date(), appliedByUserId: userId, failedAt: null, failureCode: null } });
    });
  } catch (error) {
    if (attempted) {
      await withImportTransaction(userId, organizationId, async (client) => {
        const current = await lockImportBatch(client, organizationId, batchId);
        if (current.revision === expectedRevision && current.status === "READY") await client.importBatch.update({ where: { id: batchId, organizationId, revision: expectedRevision }, data: { status: "FAILED", revision: { increment: 1 }, failedAt: new Date(), failureCode: error instanceof ImportInputError ? error.code : "IMPORT_APPLY_FAILED" } });
      }).catch(() => undefined);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientUnknownRequestError) throw new ImportInputError("IMPORT_APPLY_FAILED");
    throw error;
  }
}
