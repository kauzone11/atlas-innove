import { NextResponse } from "next/server";
import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { saveExternalOpportunity } from "@/lib/opportunities/service";
import { externalOpportunitySchema } from "@/lib/opportunities/schemas";
import { errorResponse, isUniqueConstraintError } from "@/lib/http";
export async function PATCH(request: Request, context: { params: Promise<{ organizationId: string; opportunityId: string }> }) {
  try { const { organizationId, opportunityId } = await context.params; const { auth } = await requireOrganizationAccess(organizationId, "MANAGER"); return NextResponse.json({ opportunity: await saveExternalOpportunity(auth.user.id, organizationId, opportunityId, externalOpportunitySchema.parse(await request.json())) }); }
  catch (error) { if (isUniqueConstraintError(error)) return NextResponse.json({ error: "Este número de chamada já está registrado nesta instituição." }, { status: 409 }); return errorResponse(error); }
}
