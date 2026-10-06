import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { updateCallDocumentVisibility } from "@/lib/opportunities/service";
import { errorResponse } from "@/lib/http";
const schema = z.object({ publicListingEnabled: z.boolean(), publishedAt: z.coerce.date().nullable().optional(), publicationConfirmed: z.literal(true, { errorMap: () => ({ message: "Confirme a alteração de publicação." }) }) });
export async function PATCH(request: Request, context: { params: Promise<{ organizationId: string; programId: string; callId: string; documentId: string }> }) {
  try { const { organizationId, programId, callId, documentId } = await context.params; const { auth } = await requireOrganizationAccess(organizationId, "MANAGER"); const input = schema.parse(await request.json()); await updateCallDocumentVisibility(auth.user.id, organizationId, programId, callId, documentId, input.publicListingEnabled, input.publishedAt); return NextResponse.json({ saved: true }); }
  catch (error) { return errorResponse(error); }
}
