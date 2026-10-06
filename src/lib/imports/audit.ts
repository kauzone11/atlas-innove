import { db } from "@/lib/db";
import { assertImportAccess } from "@/lib/auth/imports-access";
import { serializeCsv } from "@/lib/analytics/csv";
import { ImportInputError } from "@/lib/imports/errors";
import { importFieldLabel, importMessage } from "@/lib/imports/copy";
import { IMPORT_LIMITS } from "@/lib/imports/limits";
import { importPageSchema } from "@/lib/imports/schemas";
import type { ImportIssue } from "@/lib/imports/validation";

export async function getImportAudit(userId: string, organizationId: string, batchId: string, input: { page?: number } = {}) {
  const page = importPageSchema.parse(input.page);
  return db.$transaction(async (client) => {
    await assertImportAccess(userId, organizationId, client);
    if (!await client.importBatch.findFirst({ where: { organizationId, id: batchId }, select: { id: true } })) throw new ImportInputError("IMPORT_BATCH_NOT_FOUND");
    const changes = await client.importChange.findMany({ where: { organizationId, batchId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], skip: (page - 1) * IMPORT_LIMITS.pageSize, take: IMPORT_LIMITS.pageSize + 1 });
    return { items: changes.slice(0, IMPORT_LIMITS.pageSize), page, hasNext: changes.length > IMPORT_LIMITS.pageSize };
  });
}

export async function getImportErrorCsv(userId: string, organizationId: string, batchId: string) {
  return db.$transaction(async (client) => {
    await assertImportAccess(userId, organizationId, client);
    const batch = await client.importBatch.findFirst({ where: { organizationId, id: batchId } });
    if (!batch) throw new ImportInputError("IMPORT_BATCH_NOT_FOUND");
    const rows = await client.importRow.findMany({ where: { organizationId, batchId, OR: [{ status: "INVALID" }, { NOT: { warnings: { equals: [] } } }] }, orderBy: { rowNumber: "asc" }, take: IMPORT_LIMITS.maxRows });
    const headers = batch.headers as string[];
    const describe = (issues: ImportIssue[]) => issues.map((issue) => `${issue.field ? `${importFieldLabel(batch.type, issue.field)}: ` : ""}${importMessage(issue.code)}`).join(" | ");
    return serializeCsv(["Linha", "Erros", "Avisos", ...headers.map((header) => `Origem: ${header}`)], rows.map((row) => [row.rowNumber, describe(row.errors as ImportIssue[]), describe(row.warnings as ImportIssue[]), ...headers.map((header) => (row.rawData as Record<string, string>)[header] ?? "")]));
  });
}

export async function getImportQualityLink(userId: string, organizationId: string, batchId: string) {
  return db.$transaction(async (client) => {
    await assertImportAccess(userId, organizationId, client);
    const batch = await client.importBatch.findFirst({ where: { organizationId, id: batchId } });
    if (!batch) throw new ImportInputError("IMPORT_BATCH_NOT_FOUND");
    const base = "/app/analytics/quality";
    if (batch.status !== "APPLIED") return base;
    const changes = await client.importChange.findMany({ where: { organizationId, batchId }, select: { entityType: true, entityId: true } });
    const ids = (type: string) => changes.filter((change) => change.entityType === type).map((change) => change.entityId);
    if (batch.type === "FUNDING_PROGRAMS" && changes.length === 1) return `${base}?${new URLSearchParams({ programId: changes[0].entityId })}`;
    if (batch.type === "FUNDING_CALLS" && changes.length === 1) {
      const call = await client.fundingCall.findFirst({ where: { organizationId, id: changes[0].entityId }, select: { id: true, fundingProgramId: true } });
      if (call) return `${base}?${new URLSearchParams({ programId: call.fundingProgramId, callId: call.id })}`;
    }
    const cohorts = await client.cohort.findMany({ where: { organizationId, OR: [
      { id: { in: ids("COHORTS") } }, { followUpWaves: { some: { organizationId, id: { in: ids("FOLLOW_UP_WAVES") } } } },
      { observations: { some: { organizationId, id: { in: ids("OBSERVATIONS") } } } },
      { enrollments: { some: { organizationId, OR: [{ id: { in: ids("VENTURE_ENROLLMENTS") } }, { ventureId: { in: ids("VENTURES") } }] } } },
    ] }, select: { id: true, fundingProgramId: true }, take: 2 });
    return cohorts.length === 1 ? `${base}?${new URLSearchParams({ programId: cohorts[0].fundingProgramId, cohortId: cohorts[0].id })}` : base;
  });
}
