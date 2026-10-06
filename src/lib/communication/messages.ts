import { Prisma } from "@prisma/client";
import { AuthorizationError } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import { canonicalUserPair, hasUserBlock, lockUserPair, requireActiveConnection } from "@/lib/network/locking";
import { createNotification } from "@/lib/notifications/service";
import { boundedPage, createConversationSchema, sendMessageSchema } from "@/lib/communication/schemas";

const personSelect = { id: true, profile: { select: { fullName: true } }, innovationProfile: { select: { handle: true, headline: true, profileVisibility: true, directoryEnabled: true, publishedAt: true } } } as const;
const conversationSelect = {
  id: true, userAId: true, userBId: true, createdAt: true, lastMessageAt: true,
  participants: { select: { userId: true, lastReadAt: true, user: { select: personSelect } } },
} as const;
const messageSelect = { id: true, senderUserId: true, body: true, createdAt: true, deletedAt: true } as const;
type ConversationRecord = Prisma.ConversationGetPayload<{ select: typeof conversationSelect }>;
type MessageRecord = Prisma.DirectMessageGetPayload<{ select: typeof messageSelect }>;

function personDto(person: Prisma.UserGetPayload<{ select: typeof personSelect }>) {
  const profile = person.innovationProfile;
  const visible = profile?.profileVisibility === "PLATFORM" || (profile?.profileVisibility === "PUBLIC" && Boolean(profile.publishedAt || profile.directoryEnabled));
  return { userId: person.id, fullName: person.profile?.fullName || "Pessoa da plataforma", handle: visible && profile?.directoryEnabled ? profile.handle : null, headline: visible ? profile?.headline ?? null : null };
}
function messageDto(message: MessageRecord) {
  return { id: message.id, senderUserId: message.senderUserId, body: message.deletedAt ? null : message.body, createdAt: message.createdAt.toISOString(), deleted: Boolean(message.deletedAt) };
}

async function requireConversation(userId: string, conversationId: string, client: Prisma.TransactionClient = db): Promise<ConversationRecord> {
  const conversation = await client.conversation.findFirst({ where: { id: conversationId, participants: { some: { userId } } }, select: conversationSelect });
  if (!conversation) throw new ResourceNotFoundError("CONVERSATION_NOT_FOUND");
  const expected = new Set([conversation.userAId, conversation.userBId]);
  if (expected.size !== 2 || conversation.participants.length !== 2 || conversation.participants.some((entry) => !expected.has(entry.userId))) throw new DomainConflictError("CONVERSATION_PARTICIPANTS_INVALID");
  return conversation;
}

export async function startConversation(userId: string, value: unknown): Promise<string> {
  const { otherUserId } = createConversationSchema.parse(value);
  if (otherUserId === userId) throw new AuthorizationError("CONVERSATION_SELF_FORBIDDEN");
  return db.$transaction(async (client) => {
    await lockUserPair(client, userId, otherUserId);
    await requireActiveConnection(client, userId, otherUserId);
    const pair = canonicalUserPair(userId, otherUserId);
    const existing = await client.conversation.findUnique({ where: { userAId_userBId: pair }, select: { id: true } });
    if (existing) { await requireConversation(userId, existing.id, client); return existing.id; }
    return (await client.conversation.create({ data: { ...pair, participants: { create: [{ userId: pair.userAId }, { userId: pair.userBId }] } }, select: { id: true } })).id;
  });
}

export async function listConversations(userId: string, rawPage: unknown = 1) {
  const page = boundedPage(rawPage); const pageSize = 30;
  const where: Prisma.ConversationWhereInput = { participants: { some: { userId } } };
  const [records, total] = await Promise.all([
    db.conversation.findMany({ where, select: conversationSelect, orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    db.conversation.count({ where }),
  ]);
  const unread = records.length ? await db.$queryRaw<Array<{ conversationId: string; count: number }>>(Prisma.sql`
    SELECT message."conversationId", count(*)::int AS count FROM "DirectMessage" message
    JOIN "ConversationParticipant" participant ON participant."conversationId" = message."conversationId" AND participant."userId" = ${userId}
    WHERE message."conversationId" IN (${Prisma.join(records.map((record) => record.id))}) AND message."senderUserId" <> ${userId}
      AND (participant."lastReadAt" IS NULL OR message."createdAt" > participant."lastReadAt")
    GROUP BY message."conversationId"
  `) : [];
  const unreadCounts = new Map(unread.map((row) => [row.conversationId, row.count]));
  const conversations = records.map((conversation) => {
    const mine = conversation.participants.find((entry) => entry.userId === userId);
    const other = conversation.participants.find((entry) => entry.userId !== userId);
    const expected = new Set([conversation.userAId, conversation.userBId]);
    if (!mine || !other || expected.size !== 2 || conversation.participants.length !== 2 || conversation.participants.some((entry) => !expected.has(entry.userId))) throw new DomainConflictError("CONVERSATION_PARTICIPANTS_INVALID");
    const unreadCount = unreadCounts.get(conversation.id) ?? 0;
    return { id: conversation.id, person: personDto(other.user), lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null, unreadCount };
  });
  return { conversations, total, page, pageSize };
}

export async function getConversation(userId: string, conversationId: string, beforeId?: string) {
  const conversation = await requireConversation(userId, conversationId);
  const other = conversation.participants.find((entry) => entry.userId !== userId)!;
  let cursor: { createdAt: Date; id: string } | null = null;
  if (beforeId) {
    cursor = await db.directMessage.findFirst({ where: { id: beforeId, conversationId }, select: { id: true, createdAt: true } });
    if (!cursor) throw new ResourceNotFoundError("MESSAGE_NOT_FOUND");
  }
  const records = await db.directMessage.findMany({
    where: { conversationId, ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {}) },
    select: messageSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 51,
  });
  const messages = records.slice(0, 50).reverse().map(messageDto);
  const activeConnection = await db.networkConnection.findFirst({ where: { ...canonicalUserPair(userId, other.userId), endedAt: null }, select: { id: true } });
  const blocked = await hasUserBlock(db, userId, other.userId);
  const canSend = Boolean(activeConnection) && !blocked;
  return { id: conversationId, person: { ...personDto(other.user), ...(blocked ? { handle: null, headline: null } : {}) }, messages, olderCursor: records.length > 50 ? messages[0]?.id ?? null : null, canSend };
}

export async function markConversationRead(userId: string, conversationId: string, lastMessageId: string): Promise<void> {
  await db.$transaction(async (client) => {
    const conversation = await requireConversation(userId, conversationId, client);
    await lockUserPair(client, conversation.userAId, conversation.userBId);
    const displayed = await client.directMessage.findFirst({ where: { id: lastMessageId, conversationId }, select: { createdAt: true } });
    if (!displayed) throw new ResourceNotFoundError("MESSAGE_NOT_FOUND");
    const lastReadAt = displayed.createdAt;
    await client.conversationParticipant.updateMany({ where: { conversationId, userId, OR: [{ lastReadAt: null }, { lastReadAt: { lt: lastReadAt } }] }, data: { lastReadAt } });
  });
}

export async function sendDirectMessage(userId: string, conversationId: string, value: unknown, now = new Date()) {
  const input = sendMessageSchema.parse(value);
  return db.$transaction(async (client) => {
    const conversation = await requireConversation(userId, conversationId, client);
    await lockUserPair(client, conversation.userAId, conversation.userBId);
    const otherUserId = conversation.userAId === userId ? conversation.userBId : conversation.userAId;
    await requireActiveConnection(client, userId, otherUserId);
    if (await client.directMessage.count({ where: { senderUserId: userId, createdAt: { gte: new Date(now.getTime() - 60_000) } } }) >= 30) throw new DomainConflictError("MESSAGE_RATE_LIMIT");
    const current = await client.conversation.findUniqueOrThrow({ where: { id: conversationId }, select: { lastMessageAt: true } });
    // Millisecond ordering lets lastReadAt acknowledge only rendered messages, even during a concurrent send.
    const createdAt = current.lastMessageAt && current.lastMessageAt >= now ? new Date(current.lastMessageAt.getTime() + 1) : now;
    const message = await client.directMessage.create({ data: { conversationId, senderUserId: userId, body: input.body, createdAt }, select: messageSelect });
    await client.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: createdAt } });
    await createNotification(client, { actorUserId: userId, recipientUserId: otherUserId, kind: "DIRECT_MESSAGE", entityType: "CONVERSATION", entityId: conversationId, title: "Nova mensagem", body: "Uma pessoa da sua rede enviou uma mensagem.", href: `/app/messages/${conversationId}`, dedupeKey: `direct-message:${message.id}:${otherUserId}` });
    return messageDto(message);
  });
}
