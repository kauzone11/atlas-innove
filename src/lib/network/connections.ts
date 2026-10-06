import type { Prisma } from "@prisma/client";
import { AuthorizationError } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import { canonicalUserPair, hasUserBlock, lockUserPair } from "@/lib/network/locking";
import { connectionRequestSchema, requestActionSchema } from "@/lib/network/schemas";
import { createNotification } from "@/lib/notifications/service";
import { loadInteractionIdentities } from "@/lib/network/interaction-identity";
import { boundedPage } from "@/lib/communication/schemas";
import { createAutomaticFollows, endConnectionOnlyFollows } from "@/lib/social/follows";

export type PersonNetworkState = { state: "AVAILABLE" | "UNAVAILABLE" | "CONNECTED" | "OUTGOING" | "INCOMING"; requestId?: string; connectionId?: string };

async function eligibleRecipient(client: Prisma.TransactionClient, userId: string) {
  return client.innovationProfile.findFirst({ where: { userId, directoryEnabled: true, profileVisibility: { in: ["PUBLIC", "PLATFORM"] }, handle: { not: null }, headline: { not: null }, collaborationStatus: { not: "NOT_AVAILABLE" } }, select: { id: true, handle: true, headline: true } });
}

export async function getPersonNetworkState(userId: string, targetUserId: string): Promise<PersonNetworkState> {
  if (userId === targetUserId || await hasUserBlock(db, userId, targetUserId)) return { state: "UNAVAILABLE" };
  const { userAId, userBId } = canonicalUserPair(userId, targetUserId);
  const connection = await db.networkConnection.findFirst({ where: { userAId, userBId, endedAt: null }, select: { id: true } });
  if (connection) return { state: "CONNECTED", connectionId: connection.id };
  const request = await db.connectionRequest.findFirst({ where: { userAId, userBId, status: "PENDING" }, select: { id: true, requesterUserId: true } });
  if (request) return { state: request.requesterUserId === userId ? "OUTGOING" : "INCOMING", requestId: request.id };
  return { state: await eligibleRecipient(db, targetUserId) ? "AVAILABLE" : "UNAVAILABLE" };
}

export async function sendConnectionRequest(userId: string, value: unknown) {
  const input = connectionRequestSchema.parse(value);
  if (userId === input.recipientUserId) throw new DomainConflictError("NETWORK_SELF_REQUEST");
  return db.$transaction(async (client) => {
    await lockUserPair(client, userId, input.recipientUserId);
    if (await hasUserBlock(client, userId, input.recipientUserId)) throw new DomainConflictError("NETWORK_CONTACT_UNAVAILABLE");
    // Privacy saves take a profile row lock; request eligibility remains stable through contact creation.
    await client.$queryRaw`SELECT "id" FROM "InnovationProfile" WHERE "userId" = ${input.recipientUserId} FOR SHARE`;
    const eligible = await eligibleRecipient(client, input.recipientUserId);
    if (!eligible?.handle?.trim() || !eligible.headline?.trim()) throw new ResourceNotFoundError("NETWORK_PROFILE_UNAVAILABLE");
    const { userAId, userBId } = canonicalUserPair(userId, input.recipientUserId);
    if (await client.networkConnection.findFirst({ where: { userAId, userBId, endedAt: null }, select: { id: true } })) throw new DomainConflictError("NETWORK_ALREADY_CONNECTED");
    const pending = await client.connectionRequest.findFirst({ where: { userAId, userBId, status: "PENDING" }, select: { id: true, requesterUserId: true } });
    if (pending) throw new DomainConflictError(pending.requesterUserId === userId ? "NETWORK_REQUEST_PENDING" : "NETWORK_INCOMING_REQUEST");
    const count = await client.connectionRequest.count({ where: { requesterUserId: userId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
    if (count >= 20) throw new DomainConflictError("NETWORK_REQUEST_LIMIT");
    const request = await client.connectionRequest.create({ data: { requesterUserId: userId, recipientUserId: input.recipientUserId, userAId, userBId, message: input.message || null }, select: { id: true } });
    await createNotification(client, { recipientUserId: input.recipientUserId, actorUserId: userId, kind: "CONNECTION_REQUEST", entityType: "CONNECTION_REQUEST", entityId: request.id, dedupeKey: `connection-request:${request.id}`, title: "Nova solicitação de conexão", href: "/app/personal/network/requests" });
    return request;
  });
}

export async function respondConnectionRequest(userId: string, requestId: string, value: unknown) {
  const { action } = requestActionSchema.parse(value);
  return db.$transaction(async (client) => {
    const initial = await client.connectionRequest.findUnique({ where: { id: requestId }, select: { requesterUserId: true, recipientUserId: true } });
    if (!initial) throw new ResourceNotFoundError("NETWORK_REQUEST_NOT_FOUND");
    await lockUserPair(client, initial.requesterUserId, initial.recipientUserId);
    await client.$queryRaw`SELECT "id" FROM "ConnectionRequest" WHERE "id" = ${requestId} FOR UPDATE`;
    const request = await client.connectionRequest.findUniqueOrThrow({ where: { id: requestId } });
    if ((action === "cancel" ? request.requesterUserId : request.recipientUserId) !== userId) throw new AuthorizationError("NETWORK_REQUEST_FORBIDDEN");
    if (request.status !== "PENDING") throw new DomainConflictError("NETWORK_REQUEST_RESOLVED");
    if (action === "accept" && await hasUserBlock(client, request.requesterUserId, request.recipientUserId)) throw new DomainConflictError("NETWORK_CONTACT_UNAVAILABLE");
    const now = new Date();
    await client.connectionRequest.update({ where: { id: requestId }, data: { status: action === "accept" ? "ACCEPTED" : action === "decline" ? "DECLINED" : "CANCELLED", ...(action === "cancel" ? { cancelledAt: now } : { respondedAt: now }) } });
    if (action === "accept") {
      const connection = await client.networkConnection.create({ data: { userAId: request.userAId, userBId: request.userBId, sourceRequestId: request.id } });
      await createAutomaticFollows(client, request.userAId, request.userBId);
      await createNotification(client, { recipientUserId: request.requesterUserId, actorUserId: userId, kind: "CONNECTION_ACCEPTED", entityType: "NETWORK_CONNECTION", entityId: connection.id, dedupeKey: `connection-accepted:${request.id}`, title: "Solicitação de conexão aceita", href: "/app/personal/network/connections" });
      return { connectionId: connection.id };
    }
    return { connectionId: null };
  });
}

export async function disconnectConnection(userId: string, connectionId: string) {
  await db.$transaction(async (client) => {
    const initial = await client.networkConnection.findUnique({ where: { id: connectionId }, select: { userAId: true, userBId: true } });
    if (!initial || ![initial.userAId, initial.userBId].includes(userId)) throw new ResourceNotFoundError("NETWORK_CONNECTION_NOT_FOUND");
    await lockUserPair(client, initial.userAId, initial.userBId);
    await client.networkConnection.updateMany({ where: { id: connectionId, endedAt: null }, data: { endedAt: new Date(), endedByUserId: userId } });
    await endConnectionOnlyFollows(client, initial.userAId, initial.userBId);
  });
}

export async function listConnections(userId: string, rawPage: unknown = 1) {
  const page = boundedPage(rawPage);
  const records = await db.networkConnection.findMany({ where: { endedAt: null, OR: [{ userAId: userId }, { userBId: userId }] }, orderBy: [{ connectedAt: "desc" }, { id: "asc" }], take: 21, skip: (page - 1) * 20 });
  const rows = records.slice(0, 20);
  const identities = await loadInteractionIdentities(userId, rows.map((row) => row.userAId === userId ? row.userBId : row.userAId));
  const items = rows.map((record) => ({ id: record.id, connectedAt: record.connectedAt.toISOString(), person: identities.get(record.userAId === userId ? record.userBId : record.userAId)! }));
  return { items, page, hasMore: records.length > 20 };
}

export async function listConnectionRequests(userId: string, rawPage: unknown = 1) {
  const page = boundedPage(rawPage);
  const records = await db.connectionRequest.findMany({ where: { status: "PENDING", OR: [{ requesterUserId: userId }, { recipientUserId: userId }] }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 21, skip: (page - 1) * 20 });
  const rows = records.slice(0, 20);
  const identities = await loadInteractionIdentities(userId, rows.map((row) => row.requesterUserId === userId ? row.recipientUserId : row.requesterUserId));
  const items = rows.map((record) => ({ id: record.id, message: record.message, incoming: record.recipientUserId === userId, createdAt: record.createdAt.toISOString(), person: identities.get(record.requesterUserId === userId ? record.recipientUserId : record.requesterUserId)! }));
  return { items, page, hasNext: records.length > 20 };
}
