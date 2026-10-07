import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { assertSocialOrigin } from "@/lib/social/api";
import { followOrganization, unfollowOrganization } from "@/lib/institutions/service";

type Context = { params: Promise<{ organizationId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { user } = await requireAuthenticatedSession();
    assertSocialOrigin(request);
    const { organizationId } = await context.params;
    return NextResponse.json(await followOrganization(user.id, organizationId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { user } = await requireAuthenticatedSession();
    assertSocialOrigin(request);
    const { organizationId } = await context.params;
    return NextResponse.json(await unfollowOrganization(user.id, organizationId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
