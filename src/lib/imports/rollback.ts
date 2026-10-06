import { Prisma, type ImportChange } from "@prisma/client";
import { z } from "zod";
import { importDigest } from "@/lib/imports/digest";
import { addImportEntities, emptyEntityState, lockImportEntities, MAX_IMPORT_ENTITIES, readImportEntities } from "@/lib/imports/entities";
import { ImportInputError } from "@/lib/imports/errors";
import { IMPORT_LIMITS } from "@/lib/imports/limits";
import { findRollbackDependencies } from "@/lib/imports/rollback-dependencies";
import { importPageSchema } from "@/lib/imports/schemas";
import type { ImportEntityType } from "@/lib/imports/templates";
import { lockImportBatch, withImportTransaction } from "@/lib/imports/transaction";

async function loadRollbackState(client: Prisma.TransactionClient, organizationId: string, changes: ImportChange[]) {
  const state = emptyEntityState();
  const wanted = new Map<ImportEntityType, Set<string>>();
  const want = (type: ImportEntityType, id?: string | null) => { if (id) { const ids = wanted.get(type) ?? new Set<string>(); ids.add(id); wanted.set(type, ids); } };
  for (const change of changes) want(change.entityType, change.entityId);
  for (let depth = 0; depth < 6; depth++) {
    let loaded = 0;
    for (const [type, ids] of wanted) {
      const missing = [...ids].filter((id) => !state[type].has(id));
      if (missing.length) { const records = await readImportEntities(client, organizationId, type, missing); addImportEntities(state, type, records); loaded += records.length; }
    }
    for (const call of state.FUNDING_CALLS.values()) want("FUNDING_PROGRAMS", call.fundingProgramId);
    for (const cohort of state.COHORTS.values()) { want("FUNDING_PROGRAMS", cohort.fundingProgramId); want("FUNDING_CALLS", cohort.fundingCallId); }
    for (const enrollment of state.VENTURE_ENROLLMENTS.values()) { want("COHORTS", enrollment.cohortId); want("VENTURES", enrollment.ventureId); }
    for (const wave of state.FOLLOW_UP_WAVES.values()) want("COHORTS", wave.cohortId);
    for (const observation of state.OBSERVATIONS.values()) { want("COHORTS", observation.cohortId); want("FOLLOW_UP_WAVES", observation.followUpWaveId); want("VENTURE_ENROLLMENTS", observation.ventureEnrollmentId); }
    for (const milestone of state.MILESTONES.values()) want("VENTURES", milestone.ventureId);
    if (!loaded) break;
  }
  await lockImportEntities(client, organizationId, state);
  const observationIds = [...state.OBSERVATIONS.keys()];
  if (observationIds.length) {
    await client.$queryRaw(Prisma.sql`SELECT "id" FROM "ObservationValue" WHERE "organizationId" = ${organizationId} AND "observationId" IN (${Prisma.join(observationIds)}) ORDER BY "id" FOR UPDATE`);
    state.OBSERVATIONS.clear(); addImportEntities(state, "OBSERVATIONS", await readImportEntities(client, organizationId, "OBSERVATIONS", observationIds));
  }
  return state;
}

async function inspectRollback(client: Prisma.TransactionClient, organizationId: string, batchId: string, expectedRevision?: number) {
  const batch = await lockImportBatch(client, organizationId, batchId, expectedRevision);
  if (batch.status !== "APPLIED") throw new ImportInputError("IMPORT_NOT_APPLIED");
  const changes = await client.importChange.findMany({ where: { organizationId, batchId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: MAX_IMPORT_ENTITIES + 1 });
  if (!changes.length || changes.length > MAX_IMPORT_ENTITIES) throw new ImportInputError("IMPORT_AUDIT_INCOMPLETE");
  const state = await loadRollbackState(client, organizationId, changes);
  const dependencies = await findRollbackDependencies(client, batch, changes, state);
  const reasons = new Set(dependencies.reasons);
  const items = changes.map((change) => {
    const record = state[change.entityType].get(change.entityId); const itemReasons: string[] = [];
    if (!record) itemReasons.push("IMPORT_RECORD_MISSING");
    else if (importDigest(record) !== change.afterDigest) itemReasons.push("IMPORT_RECORD_CHANGED");
    if (change.rolledBackAt) itemReasons.push("IMPORT_AUDIT_INCOMPLETE");
    if (dependencies.blocked.has(JSON.stringify([change.entityType, change.entityId]))) itemReasons.push(...dependencies.reasons);
    if (change.operation === "UPDATE" && !["FUNDING_PROGRAMS", "VENTURES", "OBSERVATIONS"].includes(change.entityType)) itemReasons.push("IMPORT_RESTORE_UNAVAILABLE");
    for (const reason of itemReasons) reasons.add(reason);
    return { id: change.id, entityType: change.entityType, entityId: change.entityId, operation: change.operation, safe: itemReasons.length === 0, reasons: [...new Set(itemReasons)] };
  });
  return { batch, changes, state, items, reasons: [...reasons], canRollback: items.every((item) => item.safe) };
}

export async function previewImportRollback(userId: string, organizationId: string, batchId: string, input: { page?: number } = {}) {
  const page = importPageSchema.parse(input.page);
  return withImportTransaction(userId, organizationId, async (client) => {
    const preview = await inspectRollback(client, organizationId, batchId);
    return { batchId, revision: preview.batch.revision, canRollback: preview.canRollback, totalChanges: preview.items.length,
      blockedCount: preview.items.filter((item) => !item.safe).length, reasons: preview.reasons, page,
      items: preview.items.slice((page - 1) * IMPORT_LIMITS.pageSize, page * IMPORT_LIMITS.pageSize), hasNext: page * IMPORT_LIMITS.pageSize < preview.items.length,
    };
  });
}

const beforeIdentity = z.object({ id: z.string(), organizationId: z.string(), updatedAt: z.string().datetime() });
async function restoreUpdate(client: Prisma.TransactionClient, organizationId: string, change: ImportChange) {
  const identity = beforeIdentity.parse(change.beforeData);
  if (identity.id !== change.entityId || identity.organizationId !== organizationId) throw new ImportInputError("IMPORT_AUDIT_INCOMPLETE");
  const updatedAt = new Date(identity.updatedAt);
  switch (change.entityType) {
    case "FUNDING_PROGRAMS": {
      const before = z.object({ name: z.string(), description: z.string().nullable(), code: z.string().nullable() }).parse(change.beforeData);
      await client.fundingProgram.update({ where: { organizationId, id: change.entityId }, data: { ...before, updatedAt } }); break;
    }
    case "VENTURES": {
      const before = z.object({ name: z.string(), legalName: z.string().nullable(), externalReference: z.string().nullable() }).parse(change.beforeData);
      await client.venture.update({ where: { organizationId, id: change.entityId }, data: { ...before, updatedAt } }); break;
    }
    case "OBSERVATIONS": {
      const before = z.object({ status: z.literal("PENDING"), revision: z.literal(0), startedAt: z.null(), submittedAt: z.null(), values: z.array(z.unknown()).length(0) }).parse(change.beforeData);
      await client.observationValue.deleteMany({ where: { organizationId, observationId: change.entityId } });
      await client.ventureObservation.update({ where: { organizationId, id: change.entityId }, data: { status: before.status, revision: before.revision, startedAt: null, submittedAt: null, updatedAt } }); break;
    }
    default: throw new ImportInputError("IMPORT_RESTORE_UNAVAILABLE");
  }
}

const DELETE_ORDER: ImportEntityType[] = ["OBSERVATIONS", "FOLLOW_UP_WAVES", "VENTURE_ENROLLMENTS", "MILESTONES", "VENTURES", "COHORTS", "FUNDING_CALLS", "FUNDING_PROGRAMS"];
async function deleteCreated(client: Prisma.TransactionClient, organizationId: string, changes: ImportChange[]) {
  for (const type of DELETE_ORDER) {
    const ids = changes.filter((change) => change.operation === "CREATE" && change.entityType === type).map((change) => change.entityId);
    if (!ids.length) continue;
    const where = { organizationId, id: { in: ids } }; let deleted: { count: number };
    switch (type) {
      case "OBSERVATIONS":
        await client.observationValue.deleteMany({ where: { organizationId, observationId: { in: ids } } });
        deleted = await client.ventureObservation.deleteMany({ where }); break;
      case "FOLLOW_UP_WAVES": deleted = await client.followUpWave.deleteMany({ where }); break;
      case "VENTURE_ENROLLMENTS": deleted = await client.ventureEnrollment.deleteMany({ where }); break;
      case "MILESTONES": deleted = await client.milestone.deleteMany({ where }); break;
      case "VENTURES": deleted = await client.venture.deleteMany({ where }); break;
      case "COHORTS": deleted = await client.cohort.deleteMany({ where }); break;
      case "FUNDING_CALLS": deleted = await client.fundingCall.deleteMany({ where }); break;
      case "FUNDING_PROGRAMS": deleted = await client.fundingProgram.deleteMany({ where }); break;
    }
    if (deleted.count !== ids.length) throw new ImportInputError("IMPORT_ROLLBACK_CHANGED");
  }
}

export async function rollbackImportBatch(userId: string, organizationId: string, batchId: string, expectedRevision: number) {
  // NO KEY UPDATE serializes analytics FOR SHARE reads while remaining compatible with native FK checks.
  // Parent locks and explicit dependency checks protect domain children without an organization/cohort lock inversion.
  return withImportTransaction(userId, organizationId, async (client) => {
    const inspection = await inspectRollback(client, organizationId, batchId, expectedRevision);
    if (!inspection.canRollback) throw new ImportInputError("IMPORT_ROLLBACK_BLOCKED");
    // A waiting RepeatableRead report must detect its stale snapshot after this rollback commits.
    await client.$executeRaw`UPDATE "Organization" SET "updatedAt" = GREATEST(clock_timestamp(), "updatedAt" + interval '1 millisecond') WHERE "id" = ${organizationId}`;
    await client.externalReference.deleteMany({ where: { organizationId, createdByImportBatchId: batchId } });
    for (const change of inspection.changes.filter((item) => item.operation === "UPDATE")) await restoreUpdate(client, organizationId, change);
    await deleteCreated(client, organizationId, inspection.changes);
    const rolledBackAt = new Date();
    await client.importChange.updateMany({ where: { organizationId, batchId }, data: { rolledBackAt } });
    await client.importRow.updateMany({ where: { organizationId, batchId }, data: { status: "ROLLED_BACK" } });
    return client.importBatch.update({ where: { id: batchId, organizationId, revision: expectedRevision }, data: { status: "ROLLED_BACK", revision: { increment: 1 }, rolledBackAt, rolledBackByUserId: userId } });
  }, true);
}
