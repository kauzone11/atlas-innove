import type { Prisma, SocialPost } from "@prisma/client";
import { AuthorizationError } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import { isConnected } from "@/lib/social/follows";
import { notifySocial } from "@/lib/social/notifications";
import { createCommentSchema, updateCommentSchema } from "@/lib/social/schemas";
import { consumeSocialRate, lockPost, requireUnblocked } from "@/lib/social/transaction";

export async function requireCommentAllowed(client: Prisma.TransactionClient, userId: string, post: SocialPost) {
  if (post.commentPolicy === "OFF") throw new DomainConflictError("SOCIAL_COMMENTS_OFF");
  if (post.commentPolicy === "CONNECTIONS_ONLY" && !await isConnected(client, userId, post.authorUserId)) throw new DomainConflictError("SOCIAL_COMMENT_CONNECTION_REQUIRED");
}

export async function lockSocialComment(client: Prisma.TransactionClient, userId: string, commentId: string, options: { allowHidden?: boolean; allowDeleted?: boolean } = {}) {
  const initial = await client.postComment.findUnique({ where: { id: commentId }, select: { postId: true, authorUserId: true, parentComment: { select: { authorUserId: true } } } });
  if (!initial) throw new ResourceNotFoundError("SOCIAL_COMMENT_NOT_FOUND");
  const post = await lockPost(client, userId, initial.postId, [initial.authorUserId, ...(initial.parentComment ? [initial.parentComment.authorUserId] : [])]);
  await client.$queryRaw`SELECT "id" FROM "PostComment" WHERE "id" = ${commentId} FOR UPDATE`;
  const comment = await client.postComment.findUniqueOrThrow({ where: { id: commentId }, include: { parentComment: { select: { hiddenByPostAuthorAt: true, authorUserId: true } } } });
  await requireUnblocked(client, userId, comment.authorUserId);
  if (comment.parentComment) await requireUnblocked(client, userId, comment.parentComment.authorUserId);
  if ((!options.allowDeleted && comment.deletedAt) || (!options.allowHidden && (comment.hiddenByPostAuthorAt || comment.parentComment?.hiddenByPostAuthorAt))) throw new ResourceNotFoundError("SOCIAL_COMMENT_NOT_FOUND");
  return { comment, post };
}

export async function createComment(userId: string, postId: string, value: unknown) {
  const input = createCommentSchema.parse(value);
  return db.$transaction(async (client) => {
    const requested = input.parentCommentId ? await client.postComment.findFirst({ where: { id: input.parentCommentId, postId }, select: { id: true, authorUserId: true, parentCommentId: true, parentComment: { select: { authorUserId: true } } } }) : null;
    if (input.parentCommentId && !requested) throw new ResourceNotFoundError("SOCIAL_COMMENT_NOT_FOUND");
    const post = await lockPost(client, userId, postId, requested ? [requested.authorUserId, ...(requested.parentComment ? [requested.parentComment.authorUserId] : [])] : []);
    await requireCommentAllowed(client, userId, post);
    let parent: { id: string; authorUserId: string } | null = null;
    if (requested) {
      const current = await client.postComment.findFirst({ where: { id: requested.id, postId, deletedAt: null, hiddenByPostAuthorAt: null }, select: { id: true } });
      parent = await client.postComment.findFirst({ where: { id: requested.parentCommentId ?? requested.id, postId, parentCommentId: null, deletedAt: null, hiddenByPostAuthorAt: null }, select: { id: true, authorUserId: true } });
      if (!current || !parent) throw new ResourceNotFoundError("SOCIAL_COMMENT_NOT_FOUND");
      await requireUnblocked(client, userId, requested.authorUserId);
      await requireUnblocked(client, userId, parent.authorUserId);
    }
    await consumeSocialRate(client, userId, "COMMENT");
    const comment = await client.postComment.create({ data: { postId, authorUserId: userId, body: input.body, parentCommentId: parent?.id }, select: { id: true } });
    if (parent) await notifySocial(client, { actorUserId: userId, recipientUserId: parent.authorUserId, kind: "COMMENT_REPLY", postId, title: "Seu comentário recebeu uma resposta", dedupeKey: `social-reply:${comment.id}:${parent.authorUserId}` });
    if (!parent || parent.authorUserId !== post.authorUserId) await notifySocial(client, { actorUserId: userId, recipientUserId: post.authorUserId, kind: "POST_COMMENT", postId, title: "Sua publicação recebeu um comentário", dedupeKey: `social-comment:${comment.id}:${post.authorUserId}` });
    return comment;
  });
}

export async function updateComment(userId: string, commentId: string, value: unknown) {
  const input = updateCommentSchema.parse(value);
  return db.$transaction(async (client) => {
    const { comment, post } = await lockSocialComment(client, userId, commentId, { allowHidden: true });
    if (comment.authorUserId !== userId) throw new AuthorizationError("SOCIAL_AUTHOR_REQUIRED");
    await requireCommentAllowed(client, userId, post);
    await client.postComment.update({ where: { id: commentId }, data: { body: input.body, editedAt: new Date() } });
    return { id: commentId };
  });
}

export async function deleteComment(userId: string, commentId: string) {
  await db.$transaction(async (client) => {
    const { comment } = await lockSocialComment(client, userId, commentId, { allowHidden: true, allowDeleted: true });
    if (comment.authorUserId !== userId) throw new AuthorizationError("SOCIAL_AUTHOR_REQUIRED");
    if (!comment.deletedAt) await client.postComment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
  });
}

export async function hideComment(userId: string, commentId: string) {
  await db.$transaction(async (client) => {
    const { comment, post } = await lockSocialComment(client, userId, commentId, { allowHidden: true });
    if (post.authorUserId !== userId) throw new AuthorizationError("SOCIAL_POST_AUTHOR_REQUIRED");
    if (!comment.hiddenByPostAuthorAt) await client.postComment.update({ where: { id: commentId }, data: { hiddenByPostAuthorAt: new Date() } });
  });
}
