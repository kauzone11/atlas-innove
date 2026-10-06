import { z } from "zod";
import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { ImportInputError } from "@/lib/imports/errors";
import { importRevisionSchema } from "@/lib/imports/schemas";

export type ImportOrganizationRoute = { params: Promise<{ organizationId: string }> };
export type ImportBatchRoute = { params: Promise<{ organizationId: string; batchId: string }> };
export const importActionSchema = z.object({ expectedRevision: importRevisionSchema }).strict();
export const importConfirmationSchema = importActionSchema.extend({ confirmed: z.literal(true) }).strict();

export async function requireImportActor(context: ImportOrganizationRoute) {
  const { organizationId } = await context.params;
  const access = await requireOrganizationAccess(organizationId, "MANAGER");
  return { organizationId, userId: access.auth.user.id };
}
export async function requireImportBatchActor(context: ImportBatchRoute) {
  const actor = await requireImportActor(context); const { batchId } = await context.params;
  z.string().min(1).max(200).parse(batchId);
  return { ...actor, batchId };
}
export function assertImportOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    let allowed = false;
    try { allowed = new URL(origin).host === new URL(request.url).host; } catch { allowed = false; }
    if (!allowed) throw new ImportInputError("IMPORT_ORIGIN_REJECTED");
  }
}
