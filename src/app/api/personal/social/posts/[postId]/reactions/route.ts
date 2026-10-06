import { socialRead, type SocialRouteContext } from "@/lib/social/api";
import { getReactionList } from "@/lib/social/read-model";
export async function GET(request: Request, context: SocialRouteContext<"postId">) { const { postId } = await context.params; return socialRead((userId) => getReactionList(postId, userId, new URL(request.url).searchParams.get("page") ?? 1)); }
