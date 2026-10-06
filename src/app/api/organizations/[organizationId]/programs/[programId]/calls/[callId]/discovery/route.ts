import { NextResponse } from "next/server";
import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { updateFundingCallDiscovery } from "@/lib/opportunities/service";
import { discoveryMetadataSchema } from "@/lib/opportunities/schemas";
import { errorResponse } from "@/lib/http";

export async function PATCH(request: Request, context: { params: Promise<{ organizationId: string; programId: string; callId: string }> }) {
  try {
    const { organizationId, programId, callId } = await context.params;
    const { auth } = await requireOrganizationAccess(organizationId, "MANAGER");
    await updateFundingCallDiscovery(auth.user.id, organizationId, programId, callId, discoveryMetadataSchema.parse(await request.json()));
    return NextResponse.json({ saved: true });
  } catch (error) { return errorResponse(error); }
}
