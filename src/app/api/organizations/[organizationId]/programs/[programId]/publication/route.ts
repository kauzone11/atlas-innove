import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { errorResponse } from "@/lib/http";
import { assertSocialOrigin } from "@/lib/social/api";
import { organizationPublicationSchema } from "@/lib/institutions/schemas";
import { setProgramPublication } from "@/lib/institutions/service";

type Context = { params: Promise<{ organizationId: string; programId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const { organizationId, programId } = await context.params;
    const { user } = await requireAuthenticatedSession();
    assertSocialOrigin(request);
    await requireOrganizationAccess(organizationId, "MANAGER");
    const input = organizationPublicationSchema.parse(await request.json());
    return NextResponse.json(await setProgramPublication(organizationId, programId, user.id, input.published), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
