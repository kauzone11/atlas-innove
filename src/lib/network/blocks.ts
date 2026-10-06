import { db } from "@/lib/db";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import { canonicalUserPair, lockUserPair } from "@/lib/network/locking";
import { blockSchema } from "@/lib/network/schemas";
import { boundedPage } from "@/lib/communication/schemas";

export async function blockUser(userId: string, value: unknown) {
  const { blockedUserId } = blockSchema.parse(value);
  if (userId === blockedUserId) throw new DomainConflictError("NETWORK_SELF_BLOCK");
  await db.$transaction(async (client) => {
    await lockUserPair(client, userId, blockedUserId);
    if (!await client.user.findUnique({ where: { id: blockedUserId }, select: { id: true } })) throw new ResourceNotFoundError("NETWORK_USER_NOT_FOUND");
    await client.userBlock.upsert({ where: { blockerUserId_blockedUserId: { blockerUserId: userId, blockedUserId } }, create: { blockerUserId: userId, blockedUserId }, update: {} });
    const { userAId, userBId } = canonicalUserPair(userId, blockedUserId);
    const now = new Date();
    await client.connectionRequest.updateMany({ where: { userAId, userBId, status: "PENDING" }, data: { status: "CANCELLED", cancelledAt: now } });
    await client.networkConnection.updateMany({ where: { userAId, userBId, endedAt: null }, data: { endedAt: now, endedByUserId: userId } });
  });
}

export async function unblockUser(userId: string, value: unknown) {
  const { blockedUserId } = blockSchema.parse(value);
  await db.$transaction(async (client) => {
    await lockUserPair(client, userId, blockedUserId);
    await client.userBlock.deleteMany({ where: { blockerUserId: userId, blockedUserId } });
  });
}

export async function listBlockedUsers(userId: string, rawPage: unknown = 1) {
  const page = boundedPage(rawPage);
  const rows = await db.userBlock.findMany({ where: { blockerUserId: userId }, select: { blockedUserId: true, createdAt: true, blocked: { select: { profile: { select: { fullName: true } } } } }, orderBy: [{ createdAt: "desc" }, { blockedUserId: "asc" }], take: 21, skip: (page - 1) * 20 });
  return { page, hasNext: rows.length > 20, items: rows.slice(0, 20).map((row) => ({ userId: row.blockedUserId, fullName: row.blocked.profile?.fullName || "Pessoa da plataforma", blockedAt: row.createdAt.toISOString() })) };
}
