import { requireImportBatchActor, assertImportOrigin, importConfirmationSchema, type ImportBatchRoute } from "@/lib/imports/api";
import { readImportJson } from "@/lib/imports/body";
import { importErrorResponse, importResponse } from "@/lib/imports/http";
import { applyImportBatch } from "@/lib/imports/apply";

export async function POST(request: Request, context: ImportBatchRoute) {
  try {
    const { userId, organizationId, batchId } = await requireImportBatchActor(context); assertImportOrigin(request);
    const input = importConfirmationSchema.parse(await readImportJson(request));
    return importResponse(await applyImportBatch(userId, organizationId, batchId, input.expectedRevision));
  } catch (error) { return importErrorResponse(error); }
}
