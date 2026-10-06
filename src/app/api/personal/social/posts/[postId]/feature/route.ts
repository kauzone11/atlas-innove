import { z } from "zod";
import { socialWrite, type SocialRouteContext } from "@/lib/social/api";
import { featurePost } from "@/lib/social/posts";
export async function POST(request: Request, context: SocialRouteContext<"postId">) { const { postId } = await context.params; return socialWrite(request, (userId, input) => featurePost(userId, postId, z.object({ featured: z.boolean() }).strict().parse(input).featured)); }
