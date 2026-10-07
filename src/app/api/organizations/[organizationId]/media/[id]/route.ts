import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { assertSocialOrigin } from "@/lib/social/api";
import { deleteUnattachedOrganizationMedia } from "@/lib/media/service";

type Context = { params: Promise<{ organizationId: string; id: string }> };

export async function DELETE(request: Request, context: Context) {
  try {
    const { organizationId, id } = await context.params;
    const { user } = await requireAuthenticatedSession();
    assertSocialOrigin(request);
    await deleteUnattachedOrganizationMedia(user.id, organizationId, id);
    return Response.json({ deleted: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
