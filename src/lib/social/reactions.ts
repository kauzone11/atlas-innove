import { db } from "@/lib/db";
import { lockSocialComment, requireCommentAllowed } from "@/lib/social/comments";
import { notifySocial } from "@/lib/social/notifications";
import { reactionTypeSchema } from "@/lib/social/schemas";
import { consumeSocialRate, postTransaction } from "@/lib/social/transaction";

export async function reactToPost(userId: string, postId: string, value: unknown) {
  const type = reactionTypeSchema.nullable().parse(value);
  await postTransaction(userId, postId, async (client, post) => {
    const existing = await client.postReaction.findUnique({ where: { postId_userId: { postId, userId } }, select: { type: true } });
    if ((existing?.type ?? null) === type) return;
    await consumeSocialRate(client, userId, "REACTION");
    if (!type) { await client.postReaction.deleteMany({ where: { postId, userId } }); return; }
    await client.postReaction.upsert({ where: { postId_userId: { postId, userId } }, create: { postId, userId, type }, update: { type } });
    if (post.authorUserId) await notifySocial(client, { actorUserId: userId, recipientUserId: post.authorUserId, kind: "POST_REACTION", postId, title: "Sua publicação recebeu uma reação", dedupeKey: `social-reaction:${postId}:${userId}` });
  });
}

export async function reactToComment(userId: string, commentId: string, value: unknown) {
  const type = reactionTypeSchema.nullable().parse(value);
  await db.$transaction(async (client) => {
    const { comment, post } = await lockSocialComment(client, userId, commentId);
    await requireCommentAllowed(client, userId, post);
    const existing = await client.commentReaction.findUnique({ where: { commentId_userId: { commentId, userId } }, select: { type: true } });
    if ((existing?.type ?? null) === type) return;
    await consumeSocialRate(client, userId, "REACTION");
    if (!type) { await client.commentReaction.deleteMany({ where: { commentId, userId } }); return; }
    await client.commentReaction.upsert({ where: { commentId_userId: { commentId, userId } }, create: { commentId, userId, type }, update: { type } });
    await notifySocial(client, { actorUserId: userId, recipientUserId: comment.authorUserId, kind: "COMMENT_REACTION", postId: post.id, title: "Seu comentário recebeu uma reação", dedupeKey: `social-comment-reaction:${commentId}:${userId}` });
  });
}
