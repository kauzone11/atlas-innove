import { Prisma, type FundingProgram, type FundingCall, type Cohort, type Venture, type VentureEnrollment, type FollowUpWave, type VentureObservation, type ObservationValue, type Milestone } from "@prisma/client";
import type { ImportEntityType } from "@/lib/imports/templates";
import { ImportInputError } from "@/lib/imports/errors";

export type ImportEntityModels = {
  FUNDING_PROGRAMS: FundingProgram; FUNDING_CALLS: FundingCall; COHORTS: Cohort; VENTURES: Venture;
  VENTURE_ENROLLMENTS: VentureEnrollment; FOLLOW_UP_WAVES: FollowUpWave;
  OBSERVATIONS: VentureObservation & { values: ObservationValue[] }; MILESTONES: Milestone;
};
export type ImportEntityState = { [K in ImportEntityType]: Map<string, ImportEntityModels[K]> };
export const ENTITY_TABLES: Record<ImportEntityType, string> = {
  FUNDING_PROGRAMS: "FundingProgram", FUNDING_CALLS: "FundingCall", COHORTS: "Cohort", VENTURES: "Venture",
  VENTURE_ENROLLMENTS: "VentureEnrollment", FOLLOW_UP_WAVES: "FollowUpWave", OBSERVATIONS: "VentureObservation", MILESTONES: "Milestone",
};
export const ENTITY_LOCK_ORDER: ImportEntityType[] = ["FUNDING_PROGRAMS", "FUNDING_CALLS", "COHORTS", "VENTURES", "FOLLOW_UP_WAVES", "VENTURE_ENROLLMENTS", "OBSERVATIONS", "MILESTONES"];
export const MAX_IMPORT_ENTITIES = 5000;

export function emptyEntityState(): ImportEntityState {
  return { FUNDING_PROGRAMS: new Map(), FUNDING_CALLS: new Map(), COHORTS: new Map(), VENTURES: new Map(), VENTURE_ENROLLMENTS: new Map(), FOLLOW_UP_WAVES: new Map(), OBSERVATIONS: new Map(), MILESTONES: new Map() };
}

export async function readImportEntities<K extends ImportEntityType>(client: Prisma.TransactionClient, organizationId: string, type: K, ids: string[]): Promise<ImportEntityModels[K][]> {
  const where = { organizationId, id: { in: ids } };
  const take = MAX_IMPORT_ENTITIES + 1;
  let result;
  switch (type) {
    case "FUNDING_PROGRAMS": result = await client.fundingProgram.findMany({ where, take }); break;
    case "FUNDING_CALLS": result = await client.fundingCall.findMany({ where, take }); break;
    case "COHORTS": result = await client.cohort.findMany({ where, take }); break;
    case "VENTURES": result = await client.venture.findMany({ where, take }); break;
    case "VENTURE_ENROLLMENTS": result = await client.ventureEnrollment.findMany({ where, take }); break;
    case "FOLLOW_UP_WAVES": result = await client.followUpWave.findMany({ where, take }); break;
    case "OBSERVATIONS": result = await client.ventureObservation.findMany({ where, take, include: { values: { orderBy: { indicatorDefinitionId: "asc" } } } }); break;
    case "MILESTONES": result = await client.milestone.findMany({ where, take }); break;
  }
  if (!result) throw new ImportInputError("IMPORT_TYPE_INVALID");
  if (result.length > MAX_IMPORT_ENTITIES) throw new ImportInputError("IMPORT_ENTITY_LIMIT");
  // The exhaustive dispatch binds every key to its Prisma model; callers retain that type relation.
  return result as ImportEntityModels[K][];
}

export function addImportEntities<K extends ImportEntityType>(state: ImportEntityState, type: K, records: ImportEntityModels[K][]) {
  const target = state[type] as Map<string, ImportEntityModels[K]>;
  for (const record of records) target.set(record.id, record);
  if (Object.values(state).reduce((count, map) => count + map.size, 0) > MAX_IMPORT_ENTITIES) throw new ImportInputError("IMPORT_ENTITY_LIMIT");
}

export async function lockImportEntities(client: Prisma.TransactionClient, organizationId: string, state: ImportEntityState) {
  for (const type of ENTITY_LOCK_ORDER) {
    const ids = [...state[type].keys()].sort();
    if (!ids.length) continue;
    await client.$queryRaw(Prisma.sql`SELECT "id" FROM ${Prisma.raw(`"${ENTITY_TABLES[type]}"`)} WHERE "organizationId" = ${organizationId} AND "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`);
  }
  for (const type of ENTITY_LOCK_ORDER) {
    const ids = [...state[type].keys()];
    if (!ids.length) continue;
    state[type].clear();
    addImportEntities(state, type, await readImportEntities(client, organizationId, type, ids));
  }
}
