import { z } from "zod";
import { requireImportBatchActor, type ImportBatchRoute } from "@/lib/imports/api";
import { importErrorResponse, importResponse } from "@/lib/imports/http";
import { getImportBatch } from "@/lib/imports/staging";

export async function GET(request: Request, context: ImportBatchRoute) {
  try {
    const { userId, organizationId, batchId } = await requireImportBatchActor(context); const parameters = new URL(request.url).searchParams;
    const filter = z.enum(["ALL", "INVALID", "WARNINGS"]).parse(parameters.get("filter") ?? "ALL");
    return importResponse(await getImportBatch(userId, organizationId, batchId, { page: Number(parameters.get("page") ?? 1), filter }));
  } catch (error) { return importErrorResponse(error); }
}
