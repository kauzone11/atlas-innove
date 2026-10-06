import { socialWrite, reactionInput, type SocialRouteContext } from "@/lib/social/api";
import { reactToComment } from "@/lib/social/reactions";
export async function POST(request: Request, context: SocialRouteContext<"commentId">) { const { commentId } = await context.params; return socialWrite(request, (userId, input) => reactToComment(userId, commentId, reactionInput.parse(input).type)); }
