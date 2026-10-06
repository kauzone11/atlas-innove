import type { Prisma } from "@prisma/client";
import { AuthorizationError } from "@/lib/auth/authorization";
import { requireProjectAccess } from "@/lib/auth/participant-access";
import { db } from "@/lib/db";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import { createNotifications } from "@/lib/notifications/service";
import { lockNetworkUsers } from "@/lib/network/locking";
import { boundedPage, createDiscussionSchema, discussionStatusSchema, discussionSubscriptionSchema, sendMessageSchema } from "@/lib/communication/schemas";

const personSelect = { id: true, profile: { select: { fullName: true } } } as const;
const discussionSelect = { id: true, projectId: true, title: true, status: true, createdByUserId: true, createdAt: true, updatedAt: true, createdBy: { select: personSelect }, _count: { select: { messages: true } } } as const;
const messageSelect = { id: true, authorUserId: true, body: true, createdAt: true, deletedAt: true, author: { select: personSelect } } as const;
type DiscussionRecord = Prisma.ProjectDiscussionGetPayload<{ select: typeof discussionSelect }>;

function discussionDto(record: DiscussionRecord) {
  return { id: record.id, projectId: record.projectId, title: record.title, status: record.status, createdByUserId: record.createdByUserId, createdByName: record.createdBy.profile?.fullName ?? "Pessoa da plataforma", createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(), replyCount: Math.max(0, record._count.messages - 1) };
}

async function currentCollaboratorIds(projectId: string, client: Prisma.TransactionClient = db): Promise<string[]> {
  const project = await client.project.findUnique({ where: { id: projectId }, select: {
    memberships: { where: { leftAt: null }, select: { userId: true } },
    primaryTeam: { select: { archivedAt: true, memberships: { where: { status: "ACTIVE", leftAt: null }, select: { userId: true } } } },
  } });
  if (!project) throw new ResourceNotFoundError("PROJECT_NOT_FOUND");
  return [...new Set([...project.memberships.map((member) => member.userId), ...(!project.primaryTeam?.archivedAt ? project.primaryTeam?.memberships.map((member) => member.userId) ?? [] : [])])];
}

async function discussionAccess(userId: string, projectId: string, client: Prisma.TransactionClient = db, mutate = false) {
  let lockedTeamId: string | null | undefined;
  if (mutate) {
    // The established team -> project order serializes replies with membership and archive changes.
    const project = await client.project.findUnique({ where: { id: projectId }, select: { primaryTeamId: true } });
    lockedTeamId = project?.primaryTeamId;
    if (project?.primaryTeamId) await client.$queryRaw`SELECT "id" FROM "Team" WHERE "id" = ${project.primaryTeamId} FOR UPDATE`;
    await client.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${projectId} FOR UPDATE`;
  }
  const access = await requireProjectAccess(userId, projectId, false, client);
  if (mutate && access.primaryTeamId !== lockedTeamId) throw new DomainConflictError("PROJECT_CONCURRENT_CHANGE");
  const collaboratorIds = await currentCollaboratorIds(projectId, client);
  if (!collaboratorIds.includes(userId)) throw new ResourceNotFoundError("PROJECT_NOT_FOUND");
  if (mutate && (access.archivedAt || access.status === "ARCHIVED")) throw new DomainConflictError("PROJECT_ARCHIVED");
  return { access, collaboratorIds };
}

async function requireDiscussion(projectId: string, discussionId: string, client: Prisma.TransactionClient = db) {
  const discussion = await client.projectDiscussion.findFirst({ where: { id: discussionId, projectId }, select: discussionSelect });
  if (!discussion) throw new ResourceNotFoundError("DISCUSSION_NOT_FOUND");
  return discussion;
}

async function checkRate(userId: string, client: Prisma.TransactionClient, now: Date) {
  if (await client.projectDiscussionMessage.count({ where: { authorUserId: userId, createdAt: { gte: new Date(now.getTime() - 60_000) } } }) >= 30) throw new DomainConflictError("DISCUSSION_RATE_LIMIT");
}

export async function listProjectDiscussions(userId: string, projectId: string, rawPage: unknown = 1) {
  const { access } = await discussionAccess(userId, projectId); const page = boundedPage(rawPage); const pageSize = 30;
  const [records, total] = await Promise.all([
    db.projectDiscussion.findMany({ where: { projectId }, select: discussionSelect, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    db.projectDiscussion.count({ where: { projectId } }),
  ]);
  return { project: { id: access.id, name: access.name }, discussions: records.map(discussionDto), page, pageSize, total, canCreate: !access.archivedAt && access.status !== "ARCHIVED" };
}

export async function getProjectDiscussion(userId: string, projectId: string, discussionId: string, beforeId?: string) {
  const { access } = await discussionAccess(userId, projectId);
  const discussion = await requireDiscussion(projectId, discussionId);
  let cursor: { createdAt: Date; id: string } | null = null;
  if (beforeId) {
    cursor = await db.projectDiscussionMessage.findFirst({ where: { id: beforeId, discussionId }, select: { id: true, createdAt: true } });
    if (!cursor) throw new ResourceNotFoundError("DISCUSSION_MESSAGE_NOT_FOUND");
  }
  const [records, subscription] = await Promise.all([
    db.projectDiscussionMessage.findMany({ where: { discussionId, ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {}) }, select: messageSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 51 }),
    db.projectDiscussionSubscription.findUnique({ where: { discussionId_userId: { discussionId, userId } }, select: { userId: true } }),
  ]);
  const messages = records.slice(0, 50).reverse().map((record) => ({ id: record.id, authorUserId: record.authorUserId, authorName: record.author.profile?.fullName ?? "Pessoa da plataforma", body: record.deletedAt ? null : record.body, deleted: Boolean(record.deletedAt), createdAt: record.createdAt.toISOString() }));
  const active = !access.archivedAt && access.status !== "ARCHIVED";
  return { ...discussionDto(discussion), projectName: access.name, messages, olderCursor: records.length > 50 ? messages[0]?.id ?? null : null, subscribed: Boolean(subscription), canSubscribe: active, canManage: access.canManage, canReply: discussion.status === "OPEN" && active };
}

export async function createProjectDiscussion(userId: string, projectId: string, value: unknown, now = new Date()) {
  const input = createDiscussionSchema.parse(value);
  return db.$transaction(async (client) => {
    await lockNetworkUsers(client, [userId]);
    await discussionAccess(userId, projectId, client, true);
    await checkRate(userId, client, now);
    const discussion = await client.projectDiscussion.create({ data: { projectId, title: input.title, createdByUserId: userId, createdAt: now, messages: { create: { authorUserId: userId, body: input.body, createdAt: now } }, subscriptions: { create: { userId } } }, select: discussionSelect });
    return discussionDto(discussion);
  });
}

export async function replyProjectDiscussion(userId: string, projectId: string, discussionId: string, value: unknown, now = new Date()) {
  const { body } = sendMessageSchema.parse(value);
  return db.$transaction(async (client) => {
    await lockNetworkUsers(client, [userId]);
    const { collaboratorIds } = await discussionAccess(userId, projectId, client, true);
    const discussion = await requireDiscussion(projectId, discussionId, client);
    if (discussion.status !== "OPEN") throw new DomainConflictError("DISCUSSION_CLOSED");
    await checkRate(userId, client, now);
    const message = await client.projectDiscussionMessage.create({ data: { discussionId, authorUserId: userId, body, createdAt: now }, select: { id: true } });
    await client.projectDiscussion.update({ where: { id: discussionId }, data: { updatedAt: now } });
    await client.projectDiscussionSubscription.upsert({ where: { discussionId_userId: { discussionId, userId } }, create: { discussionId, userId }, update: {} });
    let afterUserId: string | undefined;
    for (;;) {
      const subscribers: Array<{ userId: string }> = await client.projectDiscussionSubscription.findMany({ where: { discussionId, userId: { in: collaboratorIds, not: userId, ...(afterUserId ? { gt: afterUserId } : {}) } }, orderBy: { userId: "asc" }, select: { userId: true }, take: 100 });
      if (!subscribers.length) break;
      await createNotifications(client, subscribers.map(({ userId: recipientUserId }) => ({ actorUserId: userId, recipientUserId, kind: "PROJECT_DISCUSSION" as const, entityType: "PROJECT_DISCUSSION", entityId: discussionId, title: "Resposta em discussão do projeto", body: "Uma discussão que você acompanha recebeu uma resposta.", href: `/app/personal/projects/${projectId}/discussions/${discussionId}`, dedupeKey: `discussion-reply:${message.id}:${recipientUserId}` })));
      afterUserId = subscribers.at(-1)?.userId;
    }
    return { messageId: message.id };
  });
}

export async function updateDiscussionStatus(userId: string, projectId: string, discussionId: string, value: unknown) {
  const input = discussionStatusSchema.parse(value);
  return db.$transaction(async (client) => {
    const { access } = await discussionAccess(userId, projectId, client, true);
    if (!access.canManage) throw new AuthorizationError("PARTICIPANT_ROLE_FORBIDDEN");
    await requireDiscussion(projectId, discussionId, client);
    return discussionDto(await client.projectDiscussion.update({ where: { id: discussionId }, data: { status: input.status }, select: discussionSelect }));
  });
}

export async function updateDiscussionSubscription(userId: string, projectId: string, discussionId: string, value: unknown): Promise<void> {
  const { subscribed } = discussionSubscriptionSchema.parse(value);
  await db.$transaction(async (client) => {
    await discussionAccess(userId, projectId, client, true);
    await requireDiscussion(projectId, discussionId, client);
    if (subscribed) await client.projectDiscussionSubscription.upsert({ where: { discussionId_userId: { discussionId, userId } }, create: { discussionId, userId }, update: {} });
    else await client.projectDiscussionSubscription.deleteMany({ where: { discussionId, userId } });
  });
}
