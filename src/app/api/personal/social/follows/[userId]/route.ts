import { z } from "zod";
import { socialWrite, type SocialRouteContext } from "@/lib/social/api";
import { followUser, unfollowUser } from "@/lib/social/follows";
export async function POST(request: Request, context: SocialRouteContext<"userId">) { const { userId: targetId } = await context.params; return socialWrite(request, (userId, input) => z.object({ following: z.boolean() }).strict().parse(input).following ? followUser(userId, targetId) : unfollowUser(userId, targetId)); }
