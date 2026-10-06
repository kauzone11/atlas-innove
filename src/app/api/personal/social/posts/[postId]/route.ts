import { socialRead, socialWrite, type SocialRouteContext } from "@/lib/social/api";
import { getPost } from "@/lib/social/read-model";
import { updatePost, deletePost } from "@/lib/social/posts";
import { ResourceNotFoundError } from "@/lib/errors";
export async function GET(_request: Request, context: SocialRouteContext<"postId">) {
  const { postId } = await context.params;
  return socialRead(async (userId) => { const post = await getPost(postId, userId); if (!post) throw new ResourceNotFoundError("SOCIAL_POST_NOT_FOUND"); return post; });
}
export async function PATCH(request: Request, context: SocialRouteContext<"postId">) { const { postId } = await context.params; return socialWrite(request, (userId, input) => updatePost(userId, postId, input)); }
export async function DELETE(request: Request, context: SocialRouteContext<"postId">) { const { postId } = await context.params; return socialWrite(request, (userId) => deletePost(userId, postId)); }
