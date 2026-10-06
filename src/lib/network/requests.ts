import { Prisma } from "@prisma/client";
import { AuthorizationError } from "@/lib/auth/authorization";
import { projectAccessWhere, requireProjectAccess } from "@/lib/auth/participant-access";
import { db } from "@/lib/db";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import { loadInteractionIdentities } from "@/lib/network/interaction-identity";
import { boundedPage } from "@/lib/communication/schemas";
import { lockNetworkUsers } from "@/lib/network/locking";
import { projectContactAllowedSql, projectManagerIds } from "@/lib/network/project-contact";
export { projectManagerIds } from "@/lib/network/project-contact";
import { projectRequestSchema, requestActionSchema } from "@/lib/network/schemas";
import { createNotification, createNotifications } from "@/lib/notifications/service";

export type ProjectRequestState = { state: "AVAILABLE" | "UNAVAILABLE" | "PENDING" | "MEMBER"; requestId?: string };

export async function lockProjectContactUsers(client: Prisma.TransactionClient, userIds: string[]) {
  await lockNetworkUsers(client, userIds);
}

export async function lockProjectForContact(client: Prisma.TransactionClient, projectId: string) {
  const initial = await client.project.findUnique({ where: { id: projectId }, select: { primaryTeamId: true } });
  if (!initial) throw new ResourceNotFoundError("PROJECT_NOT_FOUND");
  if (initial.primaryTeamId) await client.$queryRaw`SELECT "id" FROM "Team" WHERE "id" = ${initial.primaryTeamId} FOR UPDATE`;
  await client.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${projectId} FOR UPDATE`;
  const current = await client.project.findUniqueOrThrow({ where: { id: projectId }, select: { primaryTeamId: true } });
  // A team swap must retry before nested authorization can acquire a different team under the project lock.
  if (current.primaryTeamId !== initial.primaryTeamId) throw new DomainConflictError("PROJECT_CONCURRENT_CHANGE");
}

export async function assertProjectContactAllowed(client: Prisma.TransactionClient, projectId: string, userId: string, lockedManagerIds?: string[]) {
  const managers = await projectManagerIds(client, projectId);
  if (lockedManagerIds && managers.some((manager) => !lockedManagerIds.includes(manager))) throw new DomainConflictError("PROJECT_CONCURRENT_CHANGE");
  const [contact] = await client.$queryRaw<Array<{ allowed: boolean }>>(Prisma.sql`SELECT ${projectContactAllowedSql(Prisma.sql`${projectId}`, userId)} AS allowed`);
  if (!contact.allowed) throw new DomainConflictError("NETWORK_CONTACT_UNAVAILABLE");
  return managers;
}

export async function getProjectRequestState(userId: string, projectId: string): Promise<ProjectRequestState> {
  if (await db.project.findFirst({ where: { id: projectId, ...projectAccessWhere(userId) }, select: { id: true } })) return { state: "MEMBER" };
  const request = await db.projectCollaborationRequest.findFirst({ where: { projectId, requesterUserId: userId, status: "PENDING" }, select: { id: true } });
  if (request) return { state: "PENDING", requestId: request.id };
  const project = await db.project.findFirst({ where: { id: projectId, directoryEnabled: true, collaborationOpen: true, visibility: { in: ["PUBLIC", "PLATFORM"] }, archivedAt: null, status: { not: "ARCHIVED" } }, select: { id: true } });
  if (!project) return { state: "UNAVAILABLE" };
  try { await assertProjectContactAllowed(db, projectId, userId); } catch { return { state: "UNAVAILABLE" }; }
  return { state: "AVAILABLE" };
}

export async function sendProjectRequest(userId: string, projectId: string, value: unknown) {
  const input = projectRequestSchema.parse(value);
  return db.$transaction(async (client) => {
    const managers = await projectManagerIds(client, projectId);
    await lockProjectContactUsers(client, [...managers, userId]);
    await lockProjectForContact(client, projectId);
    const project = await client.project.findFirst({ where: { id: projectId, directoryEnabled: true, collaborationOpen: true, visibility: { in: ["PUBLIC", "PLATFORM"] }, archivedAt: null, status: { not: "ARCHIVED" } }, select: { id: true } });
    if (!project) throw new ResourceNotFoundError("PROJECT_COLLABORATION_UNAVAILABLE");
    const currentManagerIds = await assertProjectContactAllowed(client, projectId, userId, managers);
    if (await client.project.findFirst({ where: { id: projectId, ...projectAccessWhere(userId) }, select: { id: true } })) throw new DomainConflictError("PROJECT_ALREADY_MEMBER");
    if (await client.projectCollaborationRequest.findFirst({ where: { projectId, requesterUserId: userId, status: "PENDING" }, select: { id: true } })) throw new DomainConflictError("PROJECT_REQUEST_PENDING");
    if (await client.projectCollaborationRequest.count({ where: { requesterUserId: userId, createdAt: { gte: new Date(Date.now() - 86400000) } } }) >= 20) throw new DomainConflictError("NETWORK_REQUEST_LIMIT");
    const request = await client.projectCollaborationRequest.create({ data: { projectId, requesterUserId: userId, message: input.message || null }, select: { id: true } });
    await createNotifications(client, currentManagerIds.map((manager) => ({ recipientUserId: manager, actorUserId: userId, kind: "PROJECT_COLLABORATION_REQUEST", entityType: "PROJECT_COLLABORATION_REQUEST", entityId: request.id, dedupeKey: `project-request:${request.id}:${manager}`, title: "Interesse em colaborar no projeto", href: `/app/personal/projects/${projectId}?section=requests` })));
    return request;
  });
}

export async function respondProjectRequest(userId: string, projectId: string, requestId: string, value: unknown) {
  const { action } = requestActionSchema.parse(value);
  await db.$transaction(async (client) => {
    const initial = await client.projectCollaborationRequest.findFirst({ where: { id: requestId, projectId }, select: { requesterUserId: true } });
    if (!initial) throw new ResourceNotFoundError("PROJECT_REQUEST_NOT_FOUND");
    const managers = await projectManagerIds(client, projectId);
    await lockProjectContactUsers(client, [...managers, userId, initial.requesterUserId]);
    await lockProjectForContact(client, projectId);
    await client.$queryRaw`SELECT "id" FROM "ProjectCollaborationRequest" WHERE "id" = ${requestId} FOR UPDATE`;
    const request = await client.projectCollaborationRequest.findUniqueOrThrow({ where: { id: requestId } });
    if (action === "cancel") {
      if (request.requesterUserId !== userId) throw new AuthorizationError("NETWORK_REQUEST_FORBIDDEN");
    } else await requireProjectAccess(userId, projectId, true, client);
    if (request.status !== "PENDING") throw new DomainConflictError("NETWORK_REQUEST_RESOLVED");
    if (action === "accept") {
      await assertProjectContactAllowed(client, projectId, request.requesterUserId, managers);
      if (await client.project.findFirst({ where: { id: projectId, ...projectAccessWhere(request.requesterUserId) }, select: { id: true } })) throw new DomainConflictError("PROJECT_ALREADY_MEMBER");
      await client.projectMembership.create({ data: { projectId, userId: request.requesterUserId, role: "MEMBER" } });
      await createNotification(client, { recipientUserId: request.requesterUserId, actorUserId: userId, kind: "PROJECT_COLLABORATION_ACCEPTED", entityType: "PROJECT", entityId: projectId, dedupeKey: `project-request-accepted:${requestId}`, title: "Solicitação de colaboração aceita", href: `/app/personal/projects/${projectId}` });
    }
    await client.projectCollaborationRequest.update({ where: { id: requestId }, data: { status: action === "accept" ? "ACCEPTED" : action === "decline" ? "DECLINED" : "CANCELLED", ...(action === "cancel" ? { cancelledAt: new Date() } : { respondedAt: new Date(), respondedByUserId: userId }) } });
  });
}

export async function listProjectRequests(userId: string, projectId?: string, rawPage: unknown = 1) {
  const page = boundedPage(rawPage);
  if (projectId) await requireProjectAccess(userId, projectId, true);
  const records = await db.projectCollaborationRequest.findMany({ where: { status: "PENDING", ...(projectId ? { projectId } : { OR: [{ requesterUserId: userId }, { project: { OR: [{ memberships: { some: { userId, leftAt: null, role: { in: ["OWNER", "LEAD"] } } } }, { primaryTeam: { archivedAt: null, memberships: { some: { userId, leftAt: null, status: "ACTIVE", role: { in: ["OWNER", "LEAD"] } } } } }] } }] }) }, select: { id: true, projectId: true, requesterUserId: true, message: true, createdAt: true, project: { select: { name: true, archivedAt: true, status: true } } }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 21, skip: (page - 1) * 20 });
  const rows = records.slice(0, 20);
  const identities = await loadInteractionIdentities(userId, rows.map((row) => row.requesterUserId));
  const items = rows.map((row) => ({ id: row.id, projectId: row.projectId, projectName: row.project.name, message: row.message, incoming: row.requesterUserId !== userId, actionable: !row.project.archivedAt && row.project.status !== "ARCHIVED", createdAt: row.createdAt.toISOString(), person: identities.get(row.requesterUserId)! }));
  return { items, page, hasNext: records.length > 20 };
}
