import type { NotificationKind, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ResourceNotFoundError } from "@/lib/errors";
import { hasUserBlock } from "@/lib/network/locking";
import { z } from "zod";

export type NotificationInput = {
  recipientUserId: string; actorUserId?: string | null; kind: NotificationKind;
  entityType?: string; entityId?: string; title: string; body?: string | null;
  href: string; dedupeKey: string;
};

const contactKinds = new Set<NotificationKind>([
  "NEW_FOLLOWER", "POST_REACTION", "POST_COMMENT", "COMMENT_REPLY", "COMMENT_REACTION", "POST_REPOST",
  "CONNECTION_REQUEST", "CONNECTION_ACCEPTED", "TEAM_INVITE", "TEAM_INVITE_ACCEPTED",
  "PROJECT_INVITE", "PROJECT_INVITE_ACCEPTED", "PROJECT_COLLABORATION_REQUEST",
  "PROJECT_COLLABORATION_ACCEPTED", "DIRECT_MESSAGE", "PROJECT_DISCUSSION", "PROJECT_MENTION",
]);
export const NOTIFICATION_CHUNK_SIZE = 100;
const socialKinds: NotificationKind[] = ["NEW_FOLLOWER", "POST_REACTION", "POST_COMMENT", "COMMENT_REPLY", "COMMENT_REACTION", "POST_REPOST"];

function validNotificationTarget(input: NotificationInput): boolean {
  return !/[\\\r\n]/.test(input.href) && (input.href.startsWith("/app/") || (socialKinds.includes(input.kind) && /^\/posts\/[A-Za-z0-9_-]{1,128}$/.test(input.href)));
}

function currentSocialNotificationWhere(userId: string): Prisma.NotificationWhereInput {
  return { OR: [{ kind: { notIn: socialKinds } }, { actorUserId: null }, { actor: { is: {
    blocksInitiated: { none: { blockedUserId: userId } }, blocksReceived: { none: { blockerUserId: userId } },
  } } }] };
}

export async function createNotification(client: Prisma.TransactionClient, input: NotificationInput) {
  if (input.actorUserId === input.recipientUserId) return null;
  if (!validNotificationTarget(input)) throw new Error("INVALID_NOTIFICATION_TARGET");
  if (input.actorUserId && contactKinds.has(input.kind) && await hasUserBlock(client, input.actorUserId, input.recipientUserId)) return null;
  // Duplicate events never change the original read/archive state.
  await client.notification.createMany({ data: [input], skipDuplicates: true });
  return client.notification.findUnique({ where: { recipientUserId_dedupeKey: { recipientUserId: input.recipientUserId, dedupeKey: input.dedupeKey } }, select: { id: true } });
}

export async function createNotifications(client: Prisma.TransactionClient, inputs: NotificationInput[]) {
  const unique = [...new Map(inputs.map((input) => [JSON.stringify([input.recipientUserId, input.dedupeKey]), input])).values()];
  for (const input of unique) if (!validNotificationTarget(input)) throw new Error("INVALID_NOTIFICATION_TARGET");
  for (let offset = 0; offset < unique.length; offset += NOTIFICATION_CHUNK_SIZE) {
    const chunk = unique.slice(offset, offset + NOTIFICATION_CHUNK_SIZE).filter((input) => input.actorUserId !== input.recipientUserId);
    const contacts = chunk.filter((input) => input.actorUserId && contactKinds.has(input.kind));
    const blocks = contacts.length ? await client.userBlock.findMany({ where: { OR: contacts.flatMap((input) => [
      { blockerUserId: input.actorUserId!, blockedUserId: input.recipientUserId },
      { blockerUserId: input.recipientUserId, blockedUserId: input.actorUserId! },
    ]) }, select: { blockerUserId: true, blockedUserId: true } }) : [];
    const blockedPairs = new Set(blocks.map((block) => JSON.stringify([block.blockerUserId, block.blockedUserId].sort())));
    const data = chunk.filter((input) => !input.actorUserId || !contactKinds.has(input.kind) || !blockedPairs.has(JSON.stringify([input.actorUserId, input.recipientUserId].sort())));
    if (data.length) await client.notification.createMany({ data, skipDuplicates: true });
  }
}

export async function unreadNotificationCount(userId: string) {
  return db.notification.count({ where: { recipientUserId: userId, readAt: null, archivedAt: null, ...currentSocialNotificationWhere(userId) } });
}

export async function listNotifications(userId: string, rawPage = 1) {
  const page = z.coerce.number().int().min(1).max(10000).catch(1).parse(rawPage);
  const records = await db.notification.findMany({ where: { recipientUserId: userId, archivedAt: null, ...currentSocialNotificationWhere(userId) },
    select: { id: true, kind: true, title: true, body: true, href: true, readAt: true, createdAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 30, take: 31,
  });
  return { page, hasNext: records.length > 30, notifications: records.slice(0, 30).map((record) => ({
    ...record, readAt: record.readAt?.toISOString() ?? null, createdAt: record.createdAt.toISOString(),
  })) };
}

const actionSchema = z.object({ action: z.enum(["read", "archive", "readAll"]) }).strict();
export async function updateNotification(userId: string, id: string | null, value: unknown) {
  const { action } = actionSchema.parse(value);
  if (action === "readAll") {
    await db.notification.updateMany({ where: { recipientUserId: userId, readAt: null, archivedAt: null }, data: { readAt: new Date() } });
    return;
  }
  if (!id) throw new ResourceNotFoundError("NOTIFICATION_NOT_FOUND");
  const result = await db.notification.updateMany({ where: { id, recipientUserId: userId, archivedAt: null },
    data: action === "archive" ? { archivedAt: new Date() } : { readAt: new Date() },
  });
  if (!result.count) throw new ResourceNotFoundError("NOTIFICATION_NOT_FOUND");
}
