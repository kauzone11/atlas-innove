import { db } from "@/lib/db";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import { lockNetworkUsers } from "@/lib/network/locking";
import { notifySocial } from "@/lib/social/notifications";
import { repostSchema } from "@/lib/social/schemas";
import { consumeSocialRate, requireSocialIdentity } from "@/lib/social/transaction";
import { requireVisiblePost } from "@/lib/social/visibility";

export async function repostPost(userId: string, postId: string, value: unknown = {}) {
  const input = repostSchema.parse(value);
  return db.$transaction(async (client) => {
    const initial = await client.socialPost.findUnique({ where: { id: postId }, select: { authorUserId: true, repostOfPostId: true, repostOf: { select: { authorUserId: true } } } });
    if (!initial) throw new ResourceNotFoundError("SOCIAL_POST_NOT_FOUND");
    await lockNetworkUsers(client, [userId, initial.authorUserId, ...(initial.repostOf ? [initial.repostOf.authorUserId] : [])]);
    const originalId = initial.repostOfPostId ?? postId;
    for (const id of [...new Set([postId, originalId])].sort()) await client.$queryRaw`SELECT "id" FROM "SocialPost" WHERE "id" = ${id} FOR UPDATE`;
    await requireVisiblePost(client, postId, userId);
    const original = await requireVisiblePost(client, originalId, userId);
    if (original.repostOfPostId || !original.allowReposts || original.visibility === "CONNECTIONS") throw new DomainConflictError("SOCIAL_REPOST_UNAVAILABLE");
    const visibility = input.visibility ?? original.visibility;
    if (original.visibility === "PLATFORM" && visibility === "PUBLIC") throw new DomainConflictError("SOCIAL_REPOST_AUDIENCE");
    await requireSocialIdentity(client, userId, visibility === "PUBLIC");
    // Retrying a simple repost keeps one active share while commentary creates an explicit new post.
    if (!input.body) {
      const existing = await client.socialPost.findFirst({ where: { authorUserId: userId, repostOfPostId: originalId, body: null, deletedAt: null }, select: { id: true } });
      if (existing) return existing;
    }
    await consumeSocialRate(client, userId, "POST");
    const repost = await client.socialPost.create({ data: { ...input, visibility, repostOfPostId: originalId, authorUserId: userId }, select: { id: true } });
    await notifySocial(client, { actorUserId: userId, recipientUserId: original.authorUserId, kind: "POST_REPOST", postId: originalId, title: "Sua publicação foi repostada", dedupeKey: `social-repost:${originalId}:${userId}` });
    return repost;
  });
}
