import { db } from "@/lib/db";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import { canonicalUserPair, lockUserPair } from "@/lib/network/locking";
import { blockSchema } from "@/lib/network/schemas";
import { getNetworkIdentity } from "@/lib/network/connections";

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

export async function listBlockedUsers(userId: string) {
  const rows = await db.userBlock.findMany({ where: { blockerUserId: userId }, select: { blockedUserId: true, createdAt: true }, orderBy: [{ createdAt: "desc" }, { blockedUserId: "asc" }], take: 100 });
  return Promise.all(rows.map(async (row) => ({ userId: row.blockedUserId, fullName: (await getNetworkIdentity(userId, row.blockedUserId)).fullName, blockedAt: row.createdAt.toISOString() })));
}
