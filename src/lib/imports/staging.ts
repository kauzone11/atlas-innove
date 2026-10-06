import { Prisma } from "@prisma/client";
import { assertImportAccess } from "@/lib/auth/imports-access";
import { db } from "@/lib/db";
import { parseImportCsv } from "@/lib/imports/csv";
import { ImportInputError } from "@/lib/imports/errors";
import { IMPORT_LIMITS } from "@/lib/imports/limits";
import { proposeImportMapping, validateImportMapping, type ImportMapping } from "@/lib/imports/mapping";
import { assertImportMode, createImportSchema, importMappingSchema, importOptionsSchema, importPageSchema, importRowFilterSchema, type CreateImportInput } from "@/lib/imports/schemas";
import { lockImportBatch, withImportTransaction } from "@/lib/imports/transaction";

export async function createImportBatch(userId: string, organizationId: string, input: CreateImportInput) {
  await assertImportAccess(userId, organizationId);
  const metadata = createImportSchema.parse(input);
  assertImportMode(metadata.type, metadata.options.mode);
  const parsed = parseImportCsv(input.bytes, metadata.delimiter);
  return withImportTransaction(userId, organizationId, async (client) => {
    const batch = await client.importBatch.create({ data: {
      organizationId, type: metadata.type, namespace: metadata.namespace, schemaVersion: metadata.schemaVersion,
      sourceName: metadata.sourceName, sourceDigest: parsed.sourceDigest, delimiter: parsed.delimiter,
      headers: parsed.headers, mapping: proposeImportMapping(metadata.type, parsed.headers), options: metadata.options,
      totalRows: parsed.rows.length, createdByUserId: userId,
    } });
    for (let offset = 0; offset < parsed.rows.length; offset += IMPORT_LIMITS.writeChunkSize) {
      await client.importRow.createMany({ data: parsed.rows.slice(offset, offset + IMPORT_LIMITS.writeChunkSize).map((row) => ({
        organizationId, batchId: batch.id, rowNumber: row.rowNumber, rawData: row.data,
      })) });
    }
    return batch;
  });
}

export async function updateImportMapping(userId: string, organizationId: string, batchId: string, expectedRevision: number, input: ImportMapping, options?: { mode: "CREATE_ONLY" | "UPSERT" }) {
  const mapping = importMappingSchema.parse(input);
  return withImportTransaction(userId, organizationId, async (client) => {
    const batch = await lockImportBatch(client, organizationId, batchId, expectedRevision);
    if (!["UPLOADED", "READY", "FAILED"].includes(batch.status)) throw new ImportInputError("IMPORT_BATCH_IMMUTABLE");
    const nextOptions = importOptionsSchema.parse(options ?? batch.options);
    assertImportMode(batch.type, nextOptions.mode);
    const reviewed = validateImportMapping(batch.type, batch.headers as string[], mapping);
    await client.importRow.updateMany({ where: { organizationId, batchId }, data: {
      status: "PENDING", normalizedData: Prisma.DbNull, resolvedReferences: Prisma.DbNull, errors: [], warnings: [],
    } });
    return client.importBatch.update({ where: { id: batchId, organizationId, revision: expectedRevision }, data: {
      mapping: reviewed.mapping, options: nextOptions, mappingConfirmedAt: new Date(), revision: { increment: 1 }, status: "UPLOADED",
      validatedAt: null, failedAt: null, failureCode: null, validRows: 0, invalidRows: 0, warningRows: 0,
    } });
  });
}

export async function getImportBatch(userId: string, organizationId: string, batchId: string, input: { page?: number; filter?: "ALL" | "INVALID" | "WARNINGS" } = {}) {
  const page = importPageSchema.parse(input.page); const filter = importRowFilterSchema.parse(input.filter);
  return db.$transaction(async (client) => {
    await assertImportAccess(userId, organizationId, client);
    const batch = await client.importBatch.findFirst({ where: { organizationId, id: batchId } });
    if (!batch) throw new ImportInputError("IMPORT_BATCH_NOT_FOUND");
    const rows = await client.importRow.findMany({ where: { organizationId, batchId,
      ...(filter === "INVALID" ? { status: "INVALID" } : {}), ...(filter === "WARNINGS" ? { NOT: { warnings: { equals: [] } } } : {}),
    }, orderBy: { rowNumber: "asc" }, skip: (page - 1) * IMPORT_LIMITS.pageSize, take: IMPORT_LIMITS.pageSize + 1 });
    const mapping = batch.mapping as ImportMapping;
    return { batch, rows: rows.slice(0, IMPORT_LIMITS.pageSize), page, filter, hasNext: rows.length > IMPORT_LIMITS.pageSize,
      ignoredHeaders: (batch.headers as string[]).filter((header) => !Object.values(mapping).includes(header)),
    };
  });
}

export async function listImportBatches(userId: string, organizationId: string, input: { page?: number } = {}) {
  const page = importPageSchema.parse(input.page);
  return db.$transaction(async (client) => {
    await assertImportAccess(userId, organizationId, client);
    const items = await client.importBatch.findMany({ where: { organizationId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * IMPORT_LIMITS.pageSize, take: IMPORT_LIMITS.pageSize + 1,
      select: { id: true, type: true, status: true, namespace: true, sourceName: true, totalRows: true, validRows: true, invalidRows: true, warningRows: true, appliedRows: true, createdAt: true, appliedAt: true, rolledBackAt: true },
    });
    return { items: items.slice(0, IMPORT_LIMITS.pageSize), page, hasNext: items.length > IMPORT_LIMITS.pageSize };
  });
}
