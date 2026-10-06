import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import { canonicalUserPair, hasUserBlock, lockNetworkUsers, lockUserPair } from "@/lib/network/locking";
import { createNotification } from "@/lib/notifications/service";
import { followSettingsSchema, socialIdentifierSchema } from "@/lib/social/schemas";
import { consumeSocialRate } from "@/lib/social/transaction";

export async function createAutomaticFollows(client: Prisma.TransactionClient, firstUserId: string, secondUserId: string) {
  for (const [followerUserId, followedUserId] of [[firstUserId, secondUserId], [secondUserId, firstUserId]]) {
    if (!await client.userFollow.findFirst({ where: { followerUserId, followedUserId, endedAt: null }, select: { id: true } })) await client.userFollow.create({ data: { followerUserId, followedUserId } });
  }
}

export async function followUser(userId: string, targetId: string) {
  const followedUserId = socialIdentifierSchema.parse(targetId);
  if (userId === followedUserId) throw new DomainConflictError("SOCIAL_SELF_FOLLOW");
  return db.$transaction(async (client) => {
    const pair = await lockUserPair(client, userId, followedUserId);
    if (await hasUserBlock(client, userId, followedUserId)) throw new ResourceNotFoundError("SOCIAL_PROFILE_UNAVAILABLE");
    await client.$queryRaw`SELECT "id" FROM "InnovationProfile" WHERE "userId" = ${followedUserId} FOR SHARE`;
    const [profile, connection] = await Promise.all([
      client.innovationProfile.findUnique({ where: { userId: followedUserId }, select: { handle: true, headline: true, followPolicy: true, profileVisibility: true, publishedAt: true, directoryEnabled: true, user: { select: { profile: { select: { fullName: true } } } } } }),
      client.networkConnection.findFirst({ where: { ...pair, endedAt: null }, select: { id: true } }),
    ]);
    const visible = profile && (profile.profileVisibility === "PLATFORM" || (profile.profileVisibility === "PUBLIC" && (profile.publishedAt || profile.directoryEnabled)) || connection);
    if (!visible || !profile?.handle || !profile.headline?.trim() || !profile.user.profile?.fullName.trim()) throw new ResourceNotFoundError("SOCIAL_PROFILE_UNAVAILABLE");
    if (profile.followPolicy === "CONNECTIONS_ONLY" && !connection) throw new DomainConflictError("SOCIAL_FOLLOW_CONNECTION_REQUIRED");
    const active = await client.userFollow.findFirst({ where: { followerUserId: userId, followedUserId, endedAt: null }, select: { id: true } });
    if (active) return active;
    await consumeSocialRate(client, userId, "FOLLOW");
    const follow = await client.userFollow.create({ data: { followerUserId: userId, followedUserId }, select: { id: true } });
    await createNotification(client, { actorUserId: userId, recipientUserId: followedUserId, kind: "NEW_FOLLOWER", entityType: "USER_FOLLOW", entityId: follow.id, title: "Uma pessoa começou a seguir você", href: "/app/personal/profile/followers", dedupeKey: `social-follow:${userId}:${followedUserId}` });
    return follow;
  });
}

export async function unfollowUser(userId: string, targetId: string) {
  const followedUserId = socialIdentifierSchema.parse(targetId);
  if (userId === followedUserId) throw new DomainConflictError("SOCIAL_SELF_FOLLOW");
  await db.$transaction(async (client) => {
    await lockUserPair(client, userId, followedUserId);
    await client.userFollow.updateMany({ where: { followerUserId: userId, followedUserId, endedAt: null }, data: { endedAt: new Date() } });
  });
}

export async function updateFollowSettings(userId: string, value: unknown) {
  const input = followSettingsSchema.parse(value);
  await db.$transaction(async (client) => {
    // Every new follow locks its target; this lock prevents policy changes racing new subscriptions.
    await lockNetworkUsers(client, [userId]);
    await client.$queryRaw`SELECT "id" FROM "InnovationProfile" WHERE "userId" = ${userId} FOR UPDATE`;
    if (!await client.innovationProfile.findUnique({ where: { userId }, select: { id: true } })) throw new ResourceNotFoundError("SOCIAL_PROFILE_UNAVAILABLE");
    await client.innovationProfile.update({ where: { userId }, data: input });
    if (input.followPolicy === "CONNECTIONS_ONLY") await client.$executeRaw`
      UPDATE "UserFollow" follow SET "endedAt" = CURRENT_TIMESTAMP
      WHERE follow."followedUserId" = ${userId} AND follow."endedAt" IS NULL
      AND NOT EXISTS (SELECT 1 FROM "NetworkConnection" connection WHERE connection."endedAt" IS NULL AND
        ((connection."userAId" = follow."followerUserId" AND connection."userBId" = follow."followedUserId") OR
         (connection."userBId" = follow."followerUserId" AND connection."userAId" = follow."followedUserId")))`;
  });
}

export async function endConnectionOnlyFollows(client: Prisma.TransactionClient, a: string, b: string) {
  const profiles = await client.innovationProfile.findMany({ where: { userId: { in: [a, b] }, followPolicy: "CONNECTIONS_ONLY" }, select: { userId: true } });
  if (profiles.length) await client.userFollow.updateMany({ where: { followedUserId: { in: profiles.map((profile) => profile.userId) }, followerUserId: { in: [a, b] }, endedAt: null }, data: { endedAt: new Date() } });
}

export async function isConnected(client: Prisma.TransactionClient, userId: string, otherUserId: string) {
  return userId === otherUserId || Boolean(await client.networkConnection.findFirst({ where: { ...canonicalUserPair(userId, otherUserId), endedAt: null }, select: { id: true } }));
}
