import { Prisma, type ImportBatch } from "@prisma/client";
import { ImportInputError } from "@/lib/imports/errors";
import { addImportEntities, emptyEntityState, ENTITY_LOCK_ORDER, lockImportEntities, MAX_IMPORT_ENTITIES, readImportEntities, type ImportEntityState } from "@/lib/imports/entities";
import { REFERENCE_TYPES, type NormalizedImportRow, type ReferenceName } from "@/lib/imports/normalization";
import { importDigest } from "@/lib/imports/digest";
import type { ImportEntityType } from "@/lib/imports/templates";

export type ResolvedImportInput = { rowId: string; rowNumber: number; input: NormalizedImportRow; refs: Partial<Record<ReferenceName, string>>; existingId?: string; referenceIssues?: Array<{ code: string; field: string }> };
const unique = (values: Array<string | null | undefined>) => [...new Set(values.filter((value): value is string => Boolean(value)))];

export async function resolveImportReferences(client: Prisma.TransactionClient, batch: ImportBatch, inputs: Array<Omit<ResolvedImportInput, "refs" | "existingId">>, lock: boolean) {
  const organizationId = batch.organizationId;
  const requested = new Map<ImportEntityType, Set<string>>();
  const request = (type: ImportEntityType, externalId: string) => {
    const values = requested.get(type) ?? new Set<string>(); values.add(externalId); requested.set(type, values);
  };
  for (const { input } of inputs) {
    request(input.type, input.externalId);
    for (const [name, ref] of Object.entries(input.refs)) if (ref.kind === "external") request(REFERENCE_TYPES[name as ReferenceName], ref.id);
  }
  const externalReferences = requested.size ? await client.externalReference.findMany({ where: { organizationId, namespace: batch.namespace, OR: [...requested].map(([entityType, ids]) => ({ entityType, externalId: { in: [...ids] } })) } }) : [];
  const external = new Map(externalReferences.map((ref) => [JSON.stringify([ref.entityType, ref.externalId]), ref.entityId]));
  const resolved: ResolvedImportInput[] = inputs.map((row) => ({ ...row, refs: Object.fromEntries(Object.entries(row.input.refs).map(([name, ref]) => [name, ref.kind === "internal" ? ref.id : external.get(JSON.stringify([REFERENCE_TYPES[name as ReferenceName], ref.id]))]).filter((entry) => entry[1])), existingId: external.get(JSON.stringify([row.input.type, row.input.externalId])) }));
  const wanted = new Map<ImportEntityType, Set<string>>();
  const want = (type: ImportEntityType, id?: string | null) => { if (id) { const ids = wanted.get(type) ?? new Set<string>(); ids.add(id); wanted.set(type, ids); } };
  for (const row of resolved) {
    want(row.input.type, row.existingId);
    for (const [name, id] of Object.entries(row.refs)) want(REFERENCE_TYPES[name as ReferenceName], id);
  }
  const state = emptyEntityState();
  for (const [type, ids] of wanted) addImportEntities(state, type, await readImportEntities(client, organizationId, type, [...ids]));
  await resolveObservationAlternatives(client, organizationId, state, resolved);
  for (const row of resolved) for (const [name, id] of Object.entries(row.refs)) want(REFERENCE_TYPES[name as ReferenceName], id);
  await loadNaturalConflicts(client, organizationId, state, resolved);
  for (let depth = 0; depth < 4; depth++) {
    for (const call of state.FUNDING_CALLS.values()) want("FUNDING_PROGRAMS", call.fundingProgramId);
    for (const cohort of state.COHORTS.values()) { want("FUNDING_PROGRAMS", cohort.fundingProgramId); want("FUNDING_CALLS", cohort.fundingCallId); }
    for (const wave of state.FOLLOW_UP_WAVES.values()) want("COHORTS", wave.cohortId);
    for (const enrollment of state.VENTURE_ENROLLMENTS.values()) { want("COHORTS", enrollment.cohortId); want("VENTURES", enrollment.ventureId); }
    for (const observation of state.OBSERVATIONS.values()) { want("COHORTS", observation.cohortId); want("FOLLOW_UP_WAVES", observation.followUpWaveId); want("VENTURE_ENROLLMENTS", observation.ventureEnrollmentId); }
    for (const milestone of state.MILESTONES.values()) want("VENTURES", milestone.ventureId);
    let loaded = 0;
    for (const [type, ids] of wanted) {
      const missing = [...ids].filter((id) => !state[type].has(id));
      if (missing.length) { const rows = await readImportEntities(client, organizationId, type, missing); addImportEntities(state, type, rows); loaded += rows.length; }
    }
    if (!loaded) break;
  }
  if (lock) {
    await lockImportEntities(client, organizationId, state);
    // A native child may have committed before its parent lock was acquired. Include it in the locked snapshot.
    await resolveObservationAlternatives(client, organizationId, state, resolved);
    await loadNaturalConflicts(client, organizationId, state, resolved);
    await lockImportEntities(client, organizationId, state);
  }
  const protocolIds = unique([...state.COHORTS.values()].map((cohort) => cohort.trackingProtocolVersionId).concat(inputs.flatMap(({ input }) => input.type === "COHORTS" ? [input.data.trackingProtocolVersionId ?? null] : [])));
  if (lock && protocolIds.length) {
    // Native wave creation holds the cohort lock first; protocol readers follow that order.
    await client.$queryRaw(Prisma.sql`SELECT "id" FROM "TrackingProtocolVersion" WHERE "organizationId" = ${organizationId} AND "id" IN (${Prisma.join(protocolIds)}) ORDER BY "id" FOR SHARE`);
  }
  const versions = protocolIds.length ? await client.trackingProtocolVersion.findMany({ where: { organizationId, id: { in: protocolIds } }, include: { indicators: { orderBy: { id: "asc" } } } }) : [];
  const contextDigest = importDigest({ entities: Object.fromEntries(ENTITY_LOCK_ORDER.map((type) => [type, [...state[type].values()].sort((a, b) => a.id.localeCompare(b.id))])), versions: versions.sort((a, b) => a.id.localeCompare(b.id)), external: externalReferences.sort((a, b) => a.id.localeCompare(b.id)) });
  return { resolved, state, versions: new Map(versions.map((version) => [version.id, version])), contextDigest };
}
export type ImportReferenceContext = Awaited<ReturnType<typeof resolveImportReferences>>;

async function resolveObservationAlternatives(client: Prisma.TransactionClient, organizationId: string, state: ImportEntityState, rows: ResolvedImportInput[]) {
  const alternatives = rows.filter((row) => row.input.type === "OBSERVATIONS");
  const pairs = alternatives.filter((row) => !row.input.refs.venture_enrollment && row.refs.cohort && row.refs.venture).map((row) => ({ cohortId: row.refs.cohort!, ventureId: row.refs.venture! }));
  if (pairs.length) addImportEntities(state, "VENTURE_ENROLLMENTS", await client.ventureEnrollment.findMany({ where: { organizationId, OR: pairs }, take: MAX_IMPORT_ENTITIES + 1 }));
  for (const row of alternatives) {
    row.referenceIssues = [];
    if (!row.input.refs.venture_enrollment) {
      const found = [...state.VENTURE_ENROLLMENTS.values()].filter((record) => record.cohortId === row.refs.cohort && record.ventureId === row.refs.venture);
      row.refs.venture_enrollment = found.length === 1 ? found[0].id : undefined;
    }
  }
  const offsets = alternatives.flatMap((row) => {
    const cohortId = row.refs.venture_enrollment ? state.VENTURE_ENROLLMENTS.get(row.refs.venture_enrollment)?.cohortId : row.refs.cohort;
    return row.input.type === "OBSERVATIONS" && row.input.data.waveOffsetMonths !== null && cohortId ? [{ cohortId, offsetMonths: row.input.data.waveOffsetMonths }] : [];
  });
  if (offsets.length) addImportEntities(state, "FOLLOW_UP_WAVES", await client.followUpWave.findMany({ where: { organizationId, OR: offsets }, take: MAX_IMPORT_ENTITIES + 1 }));
  for (const row of alternatives) {
    if (row.input.type !== "OBSERVATIONS" || row.input.data.waveOffsetMonths === null) continue;
    const offsetMonths = row.input.data.waveOffsetMonths;
    const cohortId = row.refs.venture_enrollment ? state.VENTURE_ENROLLMENTS.get(row.refs.venture_enrollment)?.cohortId : row.refs.cohort;
    const found = [...state.FOLLOW_UP_WAVES.values()].filter((record) => record.cohortId === cohortId && record.offsetMonths === offsetMonths);
    row.refs.follow_up_wave = found.length === 1 ? found[0].id : undefined;
    if (found.length > 1) row.referenceIssues!.push({ code: "IMPORT_OFFSET_AMBIGUOUS", field: "wave_offset_months" });
  }
}

async function loadNaturalConflicts(client: Prisma.TransactionClient, organizationId: string, state: ImportEntityState, rows: ResolvedImportInput[]) {
  const take = MAX_IMPORT_ENTITIES + 1;
  const programs = rows.flatMap(({ input }) => input.type === "FUNDING_PROGRAMS" ? [input.data.slug] : []);
  if (programs.length) addImportEntities(state, "FUNDING_PROGRAMS", await client.fundingProgram.findMany({ where: { organizationId, slug: { in: programs } }, take }));
  const calls = rows.flatMap(({ input }) => input.type === "FUNDING_CALLS" ? [input.data.callNumber] : []);
  if (calls.length) addImportEntities(state, "FUNDING_CALLS", await client.fundingCall.findMany({ where: { organizationId, callNumber: { in: calls } }, take }));
  const cohorts = rows.flatMap(({ input, refs }) => input.type === "COHORTS" && input.data.code && refs.funding_program ? [{ fundingProgramId: refs.funding_program, code: input.data.code }] : []);
  if (cohorts.length) addImportEntities(state, "COHORTS", await client.cohort.findMany({ where: { organizationId, OR: cohorts }, take }));
  const ventures = rows.flatMap(({ input }) => input.type === "VENTURES" && input.data.slug ? [input.data.slug] : []);
  if (ventures.length) addImportEntities(state, "VENTURES", await client.venture.findMany({ where: { organizationId, slug: { in: ventures } }, take }));
  const cohortIds = unique(rows.filter(({ input }) => input.type === "VENTURE_ENROLLMENTS" || input.type === "FOLLOW_UP_WAVES").map(({ refs }) => refs.cohort));
  if (cohortIds.length) {
    // Bound both generated placeholders and all rows whose history is relevant to those placeholders.
    addImportEntities(state, "VENTURE_ENROLLMENTS", await client.ventureEnrollment.findMany({ where: { organizationId, cohortId: { in: cohortIds } }, take }));
    addImportEntities(state, "FOLLOW_UP_WAVES", await client.followUpWave.findMany({ where: { organizationId, cohortId: { in: cohortIds } }, take }));
  }
  const observations = rows.filter(({ input, refs }) => input.type === "OBSERVATIONS" && refs.venture_enrollment && refs.follow_up_wave).map(({ refs }) => ({ ventureEnrollmentId: refs.venture_enrollment!, followUpWaveId: refs.follow_up_wave! }));
  if (observations.length) addImportEntities(state, "OBSERVATIONS", await client.ventureObservation.findMany({ where: { organizationId, OR: observations }, include: { values: { orderBy: { indicatorDefinitionId: "asc" } } }, take }));
  const milestones = rows.flatMap(({ input, refs }) => input.type === "MILESTONES" && refs.venture ? [{ ventureId: refs.venture, occurredAt: input.data.occurredAt, title: input.data.title }] : []);
  if (milestones.length) addImportEntities(state, "MILESTONES", await client.milestone.findMany({ where: { organizationId, OR: milestones }, take }));
  if (Object.values(state).reduce((count, map) => count + map.size, 0) > MAX_IMPORT_ENTITIES) throw new ImportInputError("IMPORT_ENTITY_LIMIT");
}
