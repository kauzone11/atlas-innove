import { z } from "zod";
import { socialWrite, type SocialRouteContext } from "@/lib/social/api";
import { savePost } from "@/lib/social/posts";
export async function POST(request: Request, context: SocialRouteContext<"postId">) { const { postId } = await context.params; return socialWrite(request, (userId, input) => savePost(userId, postId, z.object({ saved: z.boolean() }).strict().parse(input).saved)); }
