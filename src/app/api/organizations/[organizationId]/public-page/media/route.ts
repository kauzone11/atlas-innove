import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { errorResponse } from "@/lib/http";
import { assertSocialOrigin } from "@/lib/social/api";
import { setOrganizationProfileMedia } from "@/lib/institutions/service";

type Context = { params: Promise<{ organizationId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const { organizationId } = await context.params;
    const { user } = await requireAuthenticatedSession();
    assertSocialOrigin(request);
    await requireOrganizationAccess(organizationId, "ADMIN");
    return NextResponse.json(await setOrganizationProfileMedia(organizationId, user.id, await request.json()), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
