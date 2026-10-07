import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { errorResponse } from "@/lib/http";
import { assertSocialOrigin } from "@/lib/social/api";
import { organizationPostUpdateSchema } from "@/lib/institutions/schemas";
import { deleteInstitutionPost, updateInstitutionPost } from "@/lib/institutions/posts";

type Context = { params: Promise<{ organizationId: string; postId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const { organizationId, postId } = await context.params;
    const { user } = await requireAuthenticatedSession();
    assertSocialOrigin(request);
    await requireOrganizationAccess(organizationId, "MANAGER");
    const input = organizationPostUpdateSchema.parse(await request.json());
    return NextResponse.json({ post: await updateInstitutionPost(user.id, organizationId, postId, input) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { organizationId, postId } = await context.params;
    const { user } = await requireAuthenticatedSession();
    assertSocialOrigin(request);
    await requireOrganizationAccess(organizationId, "MANAGER");
    return NextResponse.json({ post: await deleteInstitutionPost(user.id, organizationId, postId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
