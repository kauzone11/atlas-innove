import type { Prisma } from "@prisma/client";
import { DomainConflictError } from "@/lib/errors";

export function canonicalUserPair(a: string, b: string) {
  if (a === b) throw new DomainConflictError("NETWORK_SELF_ACTION");
  return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
}

export async function lockUserPair(client: Prisma.TransactionClient, a: string, b: string) {
  const pair = canonicalUserPair(a, b);
  await lockNetworkUsers(client, [a, b]);
  return pair;
}

export async function lockNetworkUsers(client: Prisma.TransactionClient, ids: string[]) {
  // Advisory locks serialize contact/rate-limit mutations without conflicting with domain notification foreign keys.
  for (const id of [...new Set(ids)].sort()) await client.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(825901, hashtext(${id}))`;
}

export async function hasUserBlock(client: Prisma.TransactionClient, a: string, b: string) {
  return Boolean(await client.userBlock.findFirst({ where: { OR: [
    { blockerUserId: a, blockedUserId: b }, { blockerUserId: b, blockedUserId: a },
  ] }, select: { blockerUserId: true } }));
}

export async function requireActiveConnection(client: Prisma.TransactionClient, a: string, b: string) {
  const pair = canonicalUserPair(a, b);
  if (await hasUserBlock(client, a, b)) throw new DomainConflictError("NETWORK_CONTACT_UNAVAILABLE");
  const connection = await client.networkConnection.findFirst({ where: { ...pair, endedAt: null }, select: { id: true } });
  if (!connection) throw new DomainConflictError("ACTIVE_CONNECTION_REQUIRED");
  return connection;
}
