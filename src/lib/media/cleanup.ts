import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { lockNetworkUsers } from "@/lib/network/locking";
import { createObjectStorage, type ObjectStorage } from "@/lib/storage/client";
import { parseDerivatives } from "@/lib/media/presentation";

const variants = ["small", "medium", "large"] as const;

export async function deletePhysicalMedia(id: string, storage: ObjectStorage) {
  const asset = await db.mediaAsset.findFirst({ where: { id, status: "DELETED", physicalDeletedAt: null } });
  if (!asset) return;
  const derivatives = parseDerivatives(asset.derivatives);
  if (!derivatives) throw new Error("MEDIA_DERIVATIVE_METADATA_INVALID");
  for (const key of new Set(variants.map((variant) => derivatives[variant].key))) await storage.delete(key);
  await db.mediaAsset.updateMany({ where: { id, status: "DELETED", physicalDeletedAt: null }, data: { physicalDeletedAt: new Date() } });
}

export async function cleanupMedia(options: { now?: Date; limit?: number; storage?: ObjectStorage; ownerUserId?: string } = {}) {
  const now = options.now ?? new Date();
  const storage = options.storage ?? createObjectStorage();
  const where: Prisma.MediaAssetWhereInput = { ...(options.ownerUserId ? { ownerUserId: options.ownerUserId } : {}), OR: [
    { status: "DELETED", physicalDeletedAt: null },
    { status: "PENDING", createdAt: { lt: new Date(now.getTime() - 3600000) } },
    { status: "READY", createdAt: { lt: new Date(now.getTime() - 86400000) }, avatarOf: null, coverOf: null, postMedia: null },
  ] };
  const candidates = await db.mediaAsset.findMany({ where, select: { id: true, ownerUserId: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: Math.max(1, Math.min(options.limit ?? 50, 100)) });
  let deleted = 0; let failed = 0;
  for (const candidate of candidates) {
    try {
      const claimed = await db.$transaction(async (client) => {
        await lockNetworkUsers(client, [candidate.ownerUserId]);
        await client.$queryRaw`SELECT "id" FROM "MediaAsset" WHERE "id" = ${candidate.id} FOR UPDATE`;
        const asset = await client.mediaAsset.findFirst({ where: { AND: [where, { id: candidate.id }] }, select: { status: true } });
        if (!asset) return false;
        if (asset.status !== "DELETED") await client.mediaAsset.update({ where: { id: candidate.id }, data: { status: "DELETED", deletedAt: now } });
        return true;
      });
      if (claimed) { await deletePhysicalMedia(candidate.id, storage); deleted++; }
    } catch { failed++; }
  }
  return { examined: candidates.length, deleted, failed };
}
