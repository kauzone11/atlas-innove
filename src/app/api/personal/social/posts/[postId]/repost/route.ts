import { socialWrite, type SocialRouteContext } from "@/lib/social/api";
import { repostPost } from "@/lib/social/reposts";
export async function POST(request: Request, context: SocialRouteContext<"postId">) { const { postId } = await context.params; return socialWrite(request, (userId, input) => repostPost(userId, postId, input)); }
