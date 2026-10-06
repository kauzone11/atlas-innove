import { z } from "zod";
import { requireImportActor, type ImportOrganizationRoute } from "@/lib/imports/api";
import { importErrorResponse } from "@/lib/imports/http";
import { IMPORT_TYPES, importTemplateCsv } from "@/lib/imports/templates";

export async function GET(request: Request, context: ImportOrganizationRoute) {
  try {
    await requireImportActor(context);
    const type = z.enum(IMPORT_TYPES).parse(new URL(request.url).searchParams.get("type"));
    return new Response(importTemplateCsv(type), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="atlas-innove-${type.toLowerCase()}-v1.csv"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return importErrorResponse(error); }
}
