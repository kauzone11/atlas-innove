import { requireImportBatchActor, type ImportBatchRoute } from "@/lib/imports/api";
import { importErrorResponse, importResponse } from "@/lib/imports/http";
import { getImportAudit } from "@/lib/imports/audit";

export async function GET(request: Request, context: ImportBatchRoute) {
  try {
    const { userId, organizationId, batchId } = await requireImportBatchActor(context);
    return importResponse(await getImportAudit(userId, organizationId, batchId, { page: Number(new URL(request.url).searchParams.get("page") ?? 1) }));
  } catch (error) { return importErrorResponse(error); }
}
