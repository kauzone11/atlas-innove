import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { errorResponse } from "@/lib/http";
import { assertSocialOrigin } from "@/lib/social/api";
import { organizationPostSchema } from "@/lib/institutions/schemas";
import { createInstitutionPost } from "@/lib/institutions/posts";

type Context = { params: Promise<{ organizationId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { organizationId } = await context.params;
    const { user } = await requireAuthenticatedSession();
    assertSocialOrigin(request);
    await requireOrganizationAccess(organizationId, "MANAGER");
    const input = organizationPostSchema.parse(await request.json());
    return NextResponse.json({ post: await createInstitutionPost(user.id, organizationId, input) }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
