import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { errorResponse } from "@/lib/http";
import { assertSocialOrigin } from "@/lib/social/api";
import { getPublicPageManagement, updateOrganizationProfile } from "@/lib/institutions/service";

type Context = { params: Promise<{ organizationId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { organizationId } = await context.params;
    const { auth } = await requireOrganizationAccess(organizationId);
    return NextResponse.json(await getPublicPageManagement(organizationId, auth.user.id), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { organizationId } = await context.params;
    const { user } = await requireAuthenticatedSession();
    assertSocialOrigin(request);
    await requireOrganizationAccess(organizationId, "ADMIN");
    return NextResponse.json(await updateOrganizationProfile(organizationId, user.id, await request.json()), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
