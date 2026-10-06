import { z } from "zod";
import { requireImportBatchActor, assertImportOrigin, type ImportBatchRoute } from "@/lib/imports/api";
import { readImportJson } from "@/lib/imports/body";
import { importErrorResponse, importResponse } from "@/lib/imports/http";
import { importMappingSchema, importOptionsSchema, importRevisionSchema } from "@/lib/imports/schemas";
import { updateImportMapping } from "@/lib/imports/staging";

const schema = z.object({ expectedRevision: importRevisionSchema, mapping: importMappingSchema, options: importOptionsSchema.optional() }).strict();
export async function PATCH(request: Request, context: ImportBatchRoute) {
  try {
    const { userId, organizationId, batchId } = await requireImportBatchActor(context); assertImportOrigin(request);
    const input = schema.parse(await readImportJson(request));
    return importResponse(await updateImportMapping(userId, organizationId, batchId, input.expectedRevision, input.mapping, input.options));
  } catch (error) { return importErrorResponse(error); }
}
