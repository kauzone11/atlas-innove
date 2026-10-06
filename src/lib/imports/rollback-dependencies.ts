import { Prisma, type ImportBatch, type ImportChange } from "@prisma/client";
import { addImportEntities, emptyEntityState, ENTITY_TABLES, MAX_IMPORT_ENTITIES, type ImportEntityState } from "@/lib/imports/entities";
import { ImportInputError } from "@/lib/imports/errors";
import type { ImportEntityType } from "@/lib/imports/templates";

type Dependency = { parent: ImportEntityType; table: string; column: string; child?: ImportEntityType; timestamp?: string; personal?: boolean };
const DEPENDENCIES: Dependency[] = [
  { parent: "FUNDING_PROGRAMS", table: "FundingCall", column: "fundingProgramId", child: "FUNDING_CALLS" },
  { parent: "FUNDING_PROGRAMS", table: "Cohort", column: "fundingProgramId", child: "COHORTS" },
  { parent: "FUNDING_PROGRAMS", table: "AnalyticsReportSnapshot", column: "fundingProgramId", timestamp: "generatedAt" },
  { parent: "FUNDING_PROGRAMS", table: "DataExportAudit", column: "fundingProgramId" },
  ...["Application", "ApplicationEvaluation", "Award", "EvaluationCriterion", "FundingCallDocument"].map((table) => ({ parent: "FUNDING_CALLS" as const, table, column: "fundingCallId" })),
  { parent: "FUNDING_CALLS", table: "SavedFundingCall", column: "fundingCallId", personal: true },
  { parent: "FUNDING_CALLS", table: "Cohort", column: "fundingCallId", child: "COHORTS" },
  { parent: "COHORTS", table: "FollowUpWave", column: "cohortId", child: "FOLLOW_UP_WAVES" },
  { parent: "COHORTS", table: "VentureEnrollment", column: "cohortId", child: "VENTURE_ENROLLMENTS" },
  { parent: "COHORTS", table: "VentureObservation", column: "cohortId", child: "OBSERVATIONS" },
  { parent: "COHORTS", table: "AnalyticsReportSnapshot", column: "cohortId", timestamp: "generatedAt" },
  { parent: "COHORTS", table: "DataExportAudit", column: "cohortId" },
  { parent: "VENTURES", table: "VentureEnrollment", column: "ventureId", child: "VENTURE_ENROLLMENTS" },
  { parent: "VENTURES", table: "Milestone", column: "ventureId", child: "MILESTONES" },
  { parent: "VENTURE_ENROLLMENTS", table: "VentureObservation", column: "ventureEnrollmentId", child: "OBSERVATIONS" },
  { parent: "FOLLOW_UP_WAVES", table: "VentureObservation", column: "followUpWaveId", child: "OBSERVATIONS" },
];

export async function findRollbackDependencies(client: Prisma.TransactionClient, batch: ImportBatch, changes: ImportChange[], state: ImportEntityState) {
  const blocked = new Set<string>(); const reasons = new Set<string>();
  const key = (type: ImportEntityType, id: string) => JSON.stringify([type, id]);
  for (const dependency of DEPENDENCIES) {
    const matching = changes.filter((change) => change.entityType === dependency.parent);
    if (!matching.length) continue;
    const created = matching.filter((change) => change.operation === "CREATE").map((change) => change.entityId);
    const updated = matching.filter((change) => change.operation === "UPDATE").map((change) => change.entityId);
    const ownChildren = dependency.child ? changes.filter((change) => change.entityType === dependency.child && change.operation === "CREATE").map((change) => change.entityId) : [];
    const parentColumn = Prisma.raw(`c."${dependency.column}"`);
    const createdFilter = created.length ? Prisma.sql`${parentColumn} IN (${Prisma.join(created)})` : Prisma.sql`false`;
    const updatedFilter = updated.length ? Prisma.sql`(${parentColumn} IN (${Prisma.join(updated)}) AND c.${Prisma.raw(`"${dependency.timestamp ?? "createdAt"}"`)} >= ${batch.appliedAt})` : Prisma.sql`false`;
    const rows = await client.$queryRaw<Array<{ parentId: string }>>(Prisma.sql`
      SELECT DISTINCT ${parentColumn} AS "parentId" FROM ${Prisma.raw(`"${dependency.table}"`)} c
      JOIN ${Prisma.raw(`"${ENTITY_TABLES[dependency.parent]}"`)} p ON p."id" = ${parentColumn} AND p."organizationId" = ${batch.organizationId}
      WHERE ${dependency.personal ? Prisma.sql`true` : Prisma.sql`c."organizationId" = ${batch.organizationId}`}
      AND (${createdFilter} OR ${updatedFilter})
      ${ownChildren.length ? Prisma.sql`AND c."id" NOT IN (${Prisma.join(ownChildren)})` : Prisma.empty}
    `);
    if (rows.length) reasons.add("IMPORT_DEPENDENT_RECORDS");
    for (const row of rows) blocked.add(key(dependency.parent, row.parentId));
  }
  const scopes = [...new Set(changes.map((change) => change.entityType))].map((entityType) => ({ entityType, entityId: { in: changes.filter((change) => change.entityType === entityType).map((change) => change.entityId) } }));
  const later = await client.importChange.findMany({ where: { organizationId: batch.organizationId, batchId: { not: batch.id }, rolledBackAt: null,
    batch: { organizationId: batch.organizationId, status: "APPLIED", appliedAt: { gte: batch.appliedAt! } }, OR: scopes,
  }, select: { entityType: true, entityId: true }, take: MAX_IMPORT_ENTITIES + 1 });
  if (later.length) reasons.add("IMPORT_LATER_BATCH_DEPENDENCY");
  for (const change of later) blocked.add(key(change.entityType, change.entityId));
  const creates = changes.filter((change) => change.operation === "CREATE");
  if (creates.length) {
    const mappings = await client.externalReference.findMany({ where: { organizationId: batch.organizationId, OR: creates.map((change) => ({ entityType: change.entityType, entityId: change.entityId })),
      AND: [{ OR: [{ createdByImportBatchId: null }, { createdByImportBatchId: { not: batch.id } }] }],
    }, select: { entityType: true, entityId: true }, take: MAX_IMPORT_ENTITIES + 1 });
    if (mappings.length) reasons.add("IMPORT_EXTERNAL_REFERENCE_DEPENDENCY");
    for (const mapping of mappings) blocked.add(key(mapping.entityType, mapping.entityId));
  }
  const affected = emptyEntityState();
  for (const change of changes) {
    const record = state[change.entityType].get(change.entityId);
    if (record) addImportEntities(affected, change.entityType, [record]);
  }
  if (await hasFrozenAnalysis(client, batch, affected)) {
    reasons.add("IMPORT_FROZEN_ANALYSIS_DEPENDENCY");
    for (const change of changes) blocked.add(key(change.entityType, change.entityId));
  }
  return { blocked, reasons: [...reasons] };
}

async function hasFrozenAnalysis(client: Prisma.TransactionClient, batch: ImportBatch, state: ImportEntityState) {
  const organizationId = batch.organizationId;
  const programIds = new Set(state.FUNDING_PROGRAMS.keys());
  const callIds = [...state.FUNDING_CALLS.keys()];
  const cohortIds = new Set(state.COHORTS.keys());
  const ventureIds = new Set(state.VENTURES.keys());
  for (const call of state.FUNDING_CALLS.values()) programIds.add(call.fundingProgramId);
  for (const item of [...state.VENTURE_ENROLLMENTS.values(), ...state.FOLLOW_UP_WAVES.values(), ...state.OBSERVATIONS.values()]) cohortIds.add(item.cohortId);
  for (const item of state.MILESTONES.values()) ventureIds.add(item.ventureId);
  const cohorts = await client.cohort.findMany({ where: { organizationId, OR: [
    { id: { in: [...cohortIds] } }, { fundingProgramId: { in: [...programIds] } }, { fundingCallId: { in: callIds } },
    { enrollments: { some: { organizationId, ventureId: { in: [...ventureIds] } } } },
  ] }, select: { id: true, fundingProgramId: true }, take: MAX_IMPORT_ENTITIES + 1 });
  if (cohorts.length > MAX_IMPORT_ENTITIES) throw new ImportInputError("IMPORT_ENTITY_LIMIT");
  for (const cohort of cohorts) { cohortIds.add(cohort.id); programIds.add(cohort.fundingProgramId); }
  const scope = [
    { fundingProgramId: null, cohortId: null }, { fundingProgramId: { in: [...programIds] }, cohortId: null }, { cohortId: { in: [...cohortIds] } },
  ];
  const [report, exported] = await Promise.all([
    client.analyticsReportSnapshot.findFirst({ where: { organizationId, dataAsOf: { gte: batch.appliedAt! }, OR: scope }, select: { id: true } }),
    client.dataExportAudit.findFirst({ where: { organizationId, dataAsOf: { gte: batch.appliedAt! }, OR: scope }, select: { id: true } }),
  ]);
  return Boolean(report || exported);
}
