import type { Prisma, SocialPost } from "@prisma/client";
import { db } from "@/lib/db";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import { hasUserBlock, lockNetworkUsers } from "@/lib/network/locking";
import { requireVisiblePost } from "@/lib/social/visibility";

export async function consumeSocialRate(client: Prisma.TransactionClient, userId: string, kind: "POST" | "COMMENT" | "REACTION" | "FOLLOW", now = new Date()) {
  const limits = { POST: [20, 86_400_000], COMMENT: [30, 60_000], REACTION: [120, 60_000], FOLLOW: [100, 86_400_000] } as const;
  const [limit, window] = limits[kind];
  if (await client.socialRateLimitEvent.count({ where: { userId, kind, createdAt: { gte: new Date(now.getTime() - window) } } }) >= limit) throw new DomainConflictError("SOCIAL_RATE_LIMIT");
  await client.socialRateLimitEvent.deleteMany({ where: { userId, createdAt: { lt: new Date(now.getTime() - 86_400_000) } } });
  await client.socialRateLimitEvent.create({ data: { userId, kind, createdAt: now } });
}

export async function requireSocialIdentity(client: Prisma.TransactionClient, userId: string, publicPost = false) {
  await client.$queryRaw`SELECT "id" FROM "InnovationProfile" WHERE "userId" = ${userId} FOR SHARE`;
  const person = await client.user.findUnique({ where: { id: userId }, select: { profile: { select: { fullName: true } }, innovationProfile: { select: { id: true, handle: true, headline: true, profileVisibility: true, publishedAt: true } } } });
  if (!person?.profile?.fullName.trim() || !person.innovationProfile?.handle || !person.innovationProfile.headline?.trim()) throw new DomainConflictError("SOCIAL_PROFILE_INCOMPLETE");
  if (publicPost && (person.innovationProfile.profileVisibility !== "PUBLIC" || !person.innovationProfile.publishedAt)) throw new DomainConflictError("SOCIAL_PUBLIC_PROFILE_REQUIRED");
  return person.innovationProfile;
}

export async function lockPost(client: Prisma.TransactionClient, userId: string, postId: string, otherUserIds: string[] = []): Promise<SocialPost> {
  const initial = await client.socialPost.findUnique({ where: { id: postId }, select: { authorUserId: true } });
  if (!initial) throw new ResourceNotFoundError("SOCIAL_POST_NOT_FOUND");
  await lockNetworkUsers(client, [userId, ...(initial.authorUserId ? [initial.authorUserId] : []), ...otherUserIds]);
  await client.$queryRaw`SELECT "id" FROM "SocialPost" WHERE "id" = ${postId} FOR UPDATE`;
  return requireVisiblePost(client, postId, userId);
}

export async function requireUnblocked(client: Prisma.TransactionClient, userId: string, otherUserId: string) {
  if (userId !== otherUserId && await hasUserBlock(client, userId, otherUserId)) throw new ResourceNotFoundError("SOCIAL_CONTENT_UNAVAILABLE");
}

export function postTransaction<T>(userId: string, postId: string, action: (client: Prisma.TransactionClient, post: SocialPost) => Promise<T>) {
  return db.$transaction(async (client) => action(client, await lockPost(client, userId, postId)));
}
