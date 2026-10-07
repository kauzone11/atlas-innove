import { AuthorizationError } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { DomainConflictError } from "@/lib/errors";
import { lockNetworkUsers } from "@/lib/network/locking";
import { createPostSchema, updatePostSchema } from "@/lib/social/schemas";
import { consumeSocialRate, postTransaction, requireSocialIdentity } from "@/lib/social/transaction";
import { attachPostMedia } from "@/lib/media/attachments";
import { lockMedia } from "@/lib/media/service";

export async function createPost(userId: string, value: unknown) {
  const input = createPostSchema.parse(value);
  return db.$transaction(async (client) => {
    await lockNetworkUsers(client, [userId]);
    await requireSocialIdentity(client, userId, input.visibility === "PUBLIC");
    await consumeSocialRate(client, userId, "POST");
    const { media, ...data } = input;
    const post = await client.socialPost.create({ data: { ...data, authorUserId: userId, createdByUserId: userId }, select: { id: true } });
    if (media.length) await attachPostMedia(client, userId, post.id, media);
    return post;
  });
}

export async function updatePost(userId: string, postId: string, value: unknown) {
  const input = updatePostSchema.parse(value);
  return postTransaction(userId, postId, async (client, post) => {
    if (post.authorUserId !== userId) throw new AuthorizationError("SOCIAL_AUTHOR_REQUIRED");
    const body = input.body === undefined ? post.body : input.body;
    const externalUrl = input.externalUrl === undefined ? post.externalUrl : input.externalUrl;
    const mediaCount = input.media?.length ?? await client.socialPostMedia.count({ where: { postId } });
    if (!post.repostOfPostId && !body && !externalUrl && !mediaCount) throw new DomainConflictError("SOCIAL_POST_EMPTY");
    if (post.repostOfPostId && !body && await client.socialPost.findFirst({ where: { id: { not: postId }, authorUserId: userId, repostOfPostId: post.repostOfPostId, body: null, deletedAt: null }, select: { id: true } })) throw new DomainConflictError("SOCIAL_REPOST_EXISTS");
    const { media, ...data } = input;
    await client.socialPost.update({ where: { id: postId }, data: { ...data, editedAt: new Date() } });
    if (media !== undefined) await attachPostMedia(client, userId, postId, media);
    return { id: postId };
  });
}

export async function deletePost(userId: string, postId: string) {
  return postTransaction(userId, postId, async (client, post) => {
    if (post.authorUserId !== userId) throw new AuthorizationError("SOCIAL_AUTHOR_REQUIRED");
    await client.socialPost.update({ where: { id: postId }, data: { deletedAt: new Date() } });
    const media = await client.socialPostMedia.findMany({ where: { postId }, select: { mediaId: true } });
    await lockMedia(client, media.map((item) => item.mediaId));
    await client.mediaAsset.updateMany({ where: { id: { in: media.map((item) => item.mediaId) }, ownerUserId: userId }, data: { status: "DELETED", deletedAt: new Date() } });
    await client.featuredPost.deleteMany({ where: { postId } });
  });
}

export async function savePost(userId: string, postId: string, saved: boolean) {
  if (!saved) { await db.savedPost.deleteMany({ where: { userId, postId } }); return; }
  await postTransaction(userId, postId, async (client) => {
    await client.savedPost.upsert({ where: { userId_postId: { userId, postId } }, create: { userId, postId }, update: {} });
  });
}

export async function featurePost(userId: string, postId: string, featured: boolean) {
  if (!featured) { await db.featuredPost.deleteMany({ where: { userId, postId } }); return; }
  await postTransaction(userId, postId, async (client, post) => {
    if (post.authorUserId !== userId) throw new AuthorizationError("SOCIAL_AUTHOR_REQUIRED");
    const existing = await client.featuredPost.findMany({ where: { userId }, select: { postId: true, position: true } });
    if (existing.some((row) => row.postId === postId)) return;
    const position = [0, 1, 2].find((candidate) => !existing.some((row) => row.position === candidate));
    if (position === undefined) throw new DomainConflictError("SOCIAL_FEATURED_LIMIT");
    await client.featuredPost.create({ data: { userId, postId, position } });
  });
}
