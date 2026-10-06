import { requireImportBatchActor, assertImportOrigin, importActionSchema, type ImportBatchRoute } from "@/lib/imports/api";
import { readImportJson } from "@/lib/imports/body";
import { importErrorResponse, importResponse } from "@/lib/imports/http";
import { validateImportBatch } from "@/lib/imports/validation";

export async function POST(request: Request, context: ImportBatchRoute) {
  try {
    const { userId, organizationId, batchId } = await requireImportBatchActor(context); assertImportOrigin(request);
    const input = importActionSchema.parse(await readImportJson(request));
    return importResponse(await validateImportBatch(userId, organizationId, batchId, input.expectedRevision));
  } catch (error) { return importErrorResponse(error); }
}
