import { requireImportActor, assertImportOrigin, type ImportOrganizationRoute } from "@/lib/imports/api";
import { readImportForm } from "@/lib/imports/body";
import { importErrorResponse, importResponse } from "@/lib/imports/http";
import { createImportBatch, listImportBatches } from "@/lib/imports/staging";

export async function GET(request: Request, context: ImportOrganizationRoute) {
  try {
    const { userId, organizationId } = await requireImportActor(context);
    return importResponse(await listImportBatches(userId, organizationId, { page: Number(new URL(request.url).searchParams.get("page") ?? 1) }));
  } catch (error) { return importErrorResponse(error); }
}
export async function POST(request: Request, context: ImportOrganizationRoute) {
  try {
    const { userId, organizationId } = await requireImportActor(context); assertImportOrigin(request);
    return importResponse(await createImportBatch(userId, organizationId, await readImportForm(request)), 201);
  } catch (error) { return importErrorResponse(error); }
}
