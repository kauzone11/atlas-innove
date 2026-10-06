import { socialWrite, type SocialRouteContext } from "@/lib/social/api";
import { hideComment } from "@/lib/social/comments";
export async function POST(request: Request, context: SocialRouteContext<"commentId">) { const { commentId } = await context.params; return socialWrite(request, (userId) => hideComment(userId, commentId)); }
