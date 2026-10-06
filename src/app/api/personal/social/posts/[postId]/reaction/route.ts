import { socialWrite, type SocialRouteContext, reactionInput } from "@/lib/social/api";
import { reactToPost } from "@/lib/social/reactions";
export async function POST(request: Request, context: SocialRouteContext<"postId">) { const { postId } = await context.params; return socialWrite(request, (userId, input) => reactToPost(userId, postId, reactionInput.parse(input).type)); }
