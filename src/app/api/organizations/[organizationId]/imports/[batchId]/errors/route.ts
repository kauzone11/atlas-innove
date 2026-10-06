import { requireImportBatchActor, type ImportBatchRoute } from "@/lib/imports/api";
import { importErrorResponse } from "@/lib/imports/http";
import { getImportErrorCsv } from "@/lib/imports/audit";

export async function GET(_request: Request, context: ImportBatchRoute) {
  try {
    const { userId, organizationId, batchId } = await requireImportBatchActor(context);
    return new Response(await getImportErrorCsv(userId, organizationId, batchId), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="atlas-innove-revisao-da-importacao.csv"', "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return importErrorResponse(error); }
}
