import { socialRead, socialWrite, type SocialRouteContext } from "@/lib/social/api";
import { getComments } from "@/lib/social/read-model";
import { createComment } from "@/lib/social/comments";
export async function GET(request: Request, context: SocialRouteContext<"postId">) { const { postId } = await context.params; const query = new URL(request.url).searchParams; return socialRead((userId) => getComments(postId, userId, { page: query.get("page") ?? 1, parentCommentId: query.get("parentCommentId") })); }
export async function POST(request: Request, context: SocialRouteContext<"postId">) { const { postId } = await context.params; return socialWrite(request, (userId, input) => createComment(userId, postId, input)); }
