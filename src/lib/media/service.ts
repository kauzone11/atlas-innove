import { randomUUID } from "node:crypto";
import { deletePhysicalMedia } from "@/lib/media/cleanup";
export { cleanupMedia, deletePhysicalMedia } from "@/lib/media/cleanup";
import type { MediaAsset, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { lockNetworkUsers, hasUserBlock } from "@/lib/network/locking";
import { canViewProfileSection } from "@/lib/profiles/service";
import { visiblePostWhere } from "@/lib/social/visibility";
import { createObjectStorage, type ObjectStorage } from "@/lib/storage/client";
import { MediaError, unavailableMedia, unavailableStorage } from "@/lib/media/errors";
import { mediaDto, mediaSelect, parseDerivatives } from "@/lib/media/presentation";
import { mediaKindSchema, mediaIdentifierSchema, profileMediaSchema, type ImageCrop } from "@/lib/media/schemas";
import { processImage, withImageProcessingSlot } from "@/lib/media/processing";
import type { MediaDerivatives, MediaVariant } from "@/lib/media/types";

const variants = ["small", "medium", "large"] as const;
export async function getOwnAvatarMedia(userId: string) {
  const profile = await db.innovationProfile.findUnique({ where: { userId }, select: { avatarMedia: { select: mediaSelect } } });
  return mediaDto(profile?.avatarMedia);
}
export async function lockMedia(client: Prisma.TransactionClient, ids: string[]) {
  for (const id of [...new Set(ids)].sort()) await client.$queryRaw`SELECT "id" FROM "MediaAsset" WHERE "id" = ${id} FOR UPDATE`;
}
export async function uploadMedia(userId: string, input: { kind: unknown; bytes: Uint8Array; mimeType: string; crop?: ImageCrop }, storage: ObjectStorage = createObjectStorage()) {
  const kind = mediaKindSchema.parse(input.kind);
  return withImageProcessingSlot(async () => {
    const id = randomUUID();
    const keys = Object.fromEntries(variants.map((variant) => [variant, `media/${id}/${variant}.webp`])) as Record<MediaVariant, string>;
    const pending = Object.fromEntries(variants.map((variant) => [variant, { key: keys[variant], width: 1, height: 1, sizeBytes: 1 }])) as MediaDerivatives;
    await db.$transaction(async (client) => {
      await lockNetworkUsers(client, [userId]);
      const now = new Date();
      const [recent, unattached] = await Promise.all([
        client.socialRateLimitEvent.count({ where: { userId, kind: "UPLOAD", createdAt: { gte: new Date(now.getTime() - 3600000) } } }),
        client.mediaAsset.count({ where: { ownerUserId: userId, status: { in: ["PENDING", "READY"] }, avatarOf: null, coverOf: null, postMedia: null } }),
      ]);
      if (recent >= 30 || unattached >= 20) throw new MediaError("MEDIA_UPLOAD_LIMIT", 429, "Você atingiu o limite de envios. Remova imagens não utilizadas ou tente novamente mais tarde.");
      await client.socialRateLimitEvent.deleteMany({ where: { userId, kind: "UPLOAD", createdAt: { lt: new Date(now.getTime() - 86400000) } } });
      await client.socialRateLimitEvent.create({ data: { userId, kind: "UPLOAD" } });
      await client.mediaAsset.create({ data: { id, ownerUserId: userId, kind, storageKey: keys.large, width: 1, height: 1, sizeBytes: 1, derivatives: pending } });
    });
    try {
      const output = await processImage(input.bytes, kind, input.mimeType, input.crop);
      const derivatives = {} as MediaDerivatives;
      for (const variant of variants) {
        const image = output[variant];
        await storage.put(keys[variant], image.bytes);
        derivatives[variant] = { key: keys[variant], width: image.width, height: image.height, sizeBytes: image.bytes.byteLength };
      }
      const asset = await db.$transaction(async (client) => {
        await lockNetworkUsers(client, [userId]); await lockMedia(client, [id]);
        const current = await client.mediaAsset.findUnique({ where: { id }, select: { status: true } });
        if (current?.status !== "PENDING") throw unavailableMedia();
        return client.mediaAsset.update({ where: { id }, data: { status: "READY", derivatives,
          width: output.large.width, height: output.large.height, sizeBytes: variants.reduce((sum, variant) => sum + output[variant].bytes.byteLength, 0) } });
      });
      return mediaDto(asset)!;
    } catch (error) {
      await db.mediaAsset.updateMany({ where: { id, status: "PENDING" }, data: { status: "DELETED", deletedAt: new Date() } });
      await deletePhysicalMedia(id, storage).catch(() => undefined);
      if (error instanceof MediaError) throw error;
      throw unavailableStorage();
    }
  });
}

export async function setProfileMedia(userId: string, value: unknown) {
  const { kind, mediaId } = profileMediaSchema.parse(value);
  return db.$transaction(async (client) => {
    await lockNetworkUsers(client, [userId]);
    await client.innovationProfile.upsert({ where: { userId }, create: { userId }, update: {} });
    await client.$queryRaw`SELECT "id" FROM "InnovationProfile" WHERE "userId" = ${userId} FOR UPDATE`;
    const profile = await client.innovationProfile.findUniqueOrThrow({ where: { userId }, select: { avatarMediaId: true, coverMediaId: true } });
    const oldId = kind === "PROFILE_AVATAR" ? profile.avatarMediaId : profile.coverMediaId;
    await lockMedia(client, [mediaId, oldId].filter((id): id is string => Boolean(id)));
    if (mediaId) {
      const asset = await client.mediaAsset.findFirst({ where: { id: mediaId, ownerUserId: userId, kind, status: "READY", deletedAt: null }, select: { id: true } });
      if (!asset) throw unavailableMedia();
    }
    await client.innovationProfile.update({ where: { userId }, data: kind === "PROFILE_AVATAR" ? { avatarMediaId: mediaId } : { coverMediaId: mediaId } });
    if (oldId && oldId !== mediaId) await client.mediaAsset.update({ where: { id: oldId }, data: { status: "DELETED", deletedAt: new Date() } });
    return { saved: true };
  });
}

export async function deleteUnattachedMedia(userId: string, rawId: string) {
  const id = mediaIdentifierSchema.parse(rawId);
  await db.$transaction(async (client) => {
    await lockNetworkUsers(client, [userId]); await lockMedia(client, [id]);
    const asset = await client.mediaAsset.findFirst({ where: { id, ownerUserId: userId }, select: { status: true, avatarOf: { select: { id: true } }, coverOf: { select: { id: true } }, postMedia: { select: { postId: true } } } });
    if (!asset) throw unavailableMedia();
    if (asset.status === "PENDING") throw new MediaError("MEDIA_PENDING", 409, "Aguarde a conclusão do envio antes de remover a imagem.");
    if (asset.avatarOf || asset.coverOf || asset.postMedia) throw new MediaError("MEDIA_ATTACHED", 409, "Remova a imagem do perfil ou da publicação antes de excluí-la.");
    if (asset.status !== "DELETED") await client.mediaAsset.update({ where: { id }, data: { status: "DELETED", deletedAt: new Date() } });
  });
}

export async function authorizeMedia(id: string, viewerUserId?: string | null): Promise<MediaAsset> {
  if (!mediaIdentifierSchema.safeParse(id).success) throw unavailableMedia();
  const asset = await db.mediaAsset.findFirst({ where: { id, status: "READY", deletedAt: null }, include: {
    avatarOf: { select: { userId: true, profileVisibility: true, publishedAt: true, directoryEnabled: true } },
    coverOf: { select: { userId: true, profileVisibility: true, publishedAt: true, directoryEnabled: true } },
    postMedia: { select: { postId: true } },
  } });
  if (!asset) throw unavailableMedia();
  if (asset.postMedia) {
    if (!await db.socialPost.findFirst({ where: { AND: [{ id: asset.postMedia.postId }, visiblePostWhere(viewerUserId)] }, select: { id: true } })) throw unavailableMedia();
    return asset;
  }
  const profile = asset.avatarOf ?? asset.coverOf;
  if (profile) {
    if (viewerUserId === profile.userId) return asset;
    if (viewerUserId && await hasUserBlock(db, viewerUserId, profile.userId)) throw unavailableMedia();
    if (profile.profileVisibility === "PUBLIC" && !profile.publishedAt && !(viewerUserId && profile.directoryEnabled)) throw unavailableMedia();
    if (!await canViewProfileSection({ scope: profile.profileVisibility, profileUserId: profile.userId, viewerUserId })) throw unavailableMedia();
    return asset;
  }
  if (asset.ownerUserId !== viewerUserId) throw unavailableMedia();
  return asset;
}

export async function readMedia(id: string, viewerUserId: string | null | undefined, variant: MediaVariant = "medium", storage?: ObjectStorage) {
  const asset = await authorizeMedia(id, viewerUserId);
  const derivative = parseDerivatives(asset.derivatives)?.[variant];
  if (!derivative) throw unavailableMedia();
  try { const bytes = await (storage ?? createObjectStorage()).get(derivative.key); if (!bytes) throw unavailableMedia(); return bytes; }
  catch (error) { if (error instanceof MediaError) throw error; throw unavailableStorage(); }
}
