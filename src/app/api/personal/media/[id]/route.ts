import { socialWrite, type SocialRouteContext } from "@/lib/social/api";
import { deleteUnattachedMedia } from "@/lib/media/service";
export async function DELETE(request: Request, context: SocialRouteContext<"id">) {
  return socialWrite(request, async (userId) => deleteUnattachedMedia(userId, (await context.params).id));
}
