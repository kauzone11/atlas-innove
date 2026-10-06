import type { Prisma } from "@prisma/client";
import { assertImportAccess } from "@/lib/auth/imports-access";
import { db } from "@/lib/db";
import { ImportInputError } from "@/lib/imports/errors";
import { importRevisionSchema } from "@/lib/imports/schemas";

export async function withImportTransaction<T>(userId: string, organizationId: string, action: (client: Prisma.TransactionClient) => Promise<T>) {
  return db.$transaction(async (client) => {
    await assertImportAccess(userId, organizationId, client);
    // Serialize import mutations per tenant, including external-ID allocation across batches.
    await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'institutional-import:' + organizationId}, 0))`;
    return action(client);
  }, { maxWait: 10000, timeout: 30000 });
}

export async function lockImportBatch(client: Prisma.TransactionClient, organizationId: string, batchId: string, expectedRevision?: number) {
  if (expectedRevision !== undefined) importRevisionSchema.parse(expectedRevision);
  await client.$queryRaw`SELECT "id" FROM "ImportBatch" WHERE "organizationId" = ${organizationId} AND "id" = ${batchId} FOR UPDATE`;
  const batch = await client.importBatch.findFirst({ where: { id: batchId, organizationId } });
  if (!batch) throw new ImportInputError("IMPORT_BATCH_NOT_FOUND");
  if (expectedRevision !== undefined && batch.revision !== expectedRevision) throw new ImportInputError("IMPORT_REVISION_CONFLICT");
  return batch;
}
