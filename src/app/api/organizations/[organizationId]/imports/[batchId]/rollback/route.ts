import { requireImportBatchActor, assertImportOrigin, importConfirmationSchema, type ImportBatchRoute } from "@/lib/imports/api";
import { readImportJson } from "@/lib/imports/body";
import { importErrorResponse, importResponse } from "@/lib/imports/http";
import { previewImportRollback, rollbackImportBatch } from "@/lib/imports/rollback";

export async function GET(request: Request, context: ImportBatchRoute) {
  try {
    const { userId, organizationId, batchId } = await requireImportBatchActor(context);
    return importResponse(await previewImportRollback(userId, organizationId, batchId, { page: Number(new URL(request.url).searchParams.get("page") ?? 1) }));
  } catch (error) { return importErrorResponse(error); }
}
export async function POST(request: Request, context: ImportBatchRoute) {
  try {
    const { userId, organizationId, batchId } = await requireImportBatchActor(context); assertImportOrigin(request);
    const input = importConfirmationSchema.parse(await readImportJson(request));
    return importResponse(await rollbackImportBatch(userId, organizationId, batchId, input.expectedRevision));
  } catch (error) { return importErrorResponse(error); }
}
