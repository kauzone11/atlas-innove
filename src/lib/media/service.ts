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
import { hasAtLeastRole, AuthorizationError } from "@/lib/auth/authorization";
import type { MediaKind } from "@prisma/client";

const variants = ["small", "medium", "large"] as const;
export async function getOwnAvatarMedia(userId: string) {
  const profile = await db.innovationProfile.findUnique({ where: { userId }, select: { avatarMedia: { select: mediaSelect } } });
  return mediaDto(profile?.avatarMedia);
}
export async function lockMedia(client: Prisma.TransactionClient, ids: string[]) {
  for (const id of [...new Set(ids)].sort()) await client.$queryRaw`SELECT "id" FROM "MediaAsset" WHERE "id" = ${id} FOR UPDATE`;
}
async function requireOrganizationUploadRole(client: Prisma.TransactionClient, userId: string, organizationId: string, kind: MediaKind) {
  await client.$queryRaw`SELECT "id" FROM "OrganizationMembership" WHERE "organizationId" = ${organizationId} AND "userId" = ${userId} AND "status" = 'ACTIVE' FOR SHARE`;
  const membership = await client.organizationMembership.findFirst({ where: { organizationId, userId, status: "ACTIVE", organization: { status: "ACTIVE" } }, select: { role: true } });
  const required = kind === "ORGANIZATION_LOGO" || kind === "ORGANIZATION_COVER" ? "ADMIN" : "MANAGER";
  if (!membership || !hasAtLeastRole(membership.role, required)) throw new AuthorizationError("ROLE_FORBIDDEN");
}

async function uploadOwnedMedia(userId: string, organizationId: string | null, input: { kind: unknown; bytes: Uint8Array; mimeType: string; crop?: ImageCrop }, storage: ObjectStorage) {
  const kind = mediaKindSchema.parse(input.kind);
  const organizationKind = kind === "ORGANIZATION_LOGO" || kind === "ORGANIZATION_COVER";
  if (organizationId ? (!organizationKind && kind !== "POST_IMAGE") : organizationKind) throw new AuthorizationError("MEDIA_OWNER_FORBIDDEN");
  return withImageProcessingSlot(async () => {
    const id = randomUUID();
    const keys = Object.fromEntries(variants.map((variant) => [variant, `media/${id}/${variant}.webp`])) as Record<MediaVariant, string>;
    const pending = Object.fromEntries(variants.map((variant) => [variant, { key: keys[variant], width: 1, height: 1, sizeBytes: 1 }])) as MediaDerivatives;
    await db.$transaction(async (client) => {
      await lockNetworkUsers(client, [userId]);
      if (organizationId) await requireOrganizationUploadRole(client, userId, organizationId, kind);
      const now = new Date();
      const [recent, unattached] = await Promise.all([
        client.socialRateLimitEvent.count({ where: { userId, kind: "UPLOAD", createdAt: { gte: new Date(now.getTime() - 3600000) } } }),
        client.mediaAsset.count({ where: { ...(organizationId ? { ownerOrganizationId: organizationId, ownerUserId: null } : { ownerUserId: userId, ownerOrganizationId: null }),
          status: { in: ["PENDING", "READY"] }, avatarOf: null, coverOf: null, organizationLogoOf: null, organizationCoverOf: null, postMedia: null } }),
      ]);
      if (recent >= 30 || unattached >= 20) throw new MediaError("MEDIA_UPLOAD_LIMIT", 429, "Você atingiu o limite de envios. Remova imagens não utilizadas ou tente novamente mais tarde.");
      await client.socialRateLimitEvent.deleteMany({ where: { userId, kind: "UPLOAD", createdAt: { lt: new Date(now.getTime() - 86400000) } } });
      await client.socialRateLimitEvent.create({ data: { userId, kind: "UPLOAD" } });
      await client.mediaAsset.create({ data: { id, ...(organizationId ? { ownerOrganizationId: organizationId } : { ownerUserId: userId }), kind, storageKey: keys.large, width: 1, height: 1, sizeBytes: 1, derivatives: pending } });
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
        if (organizationId) await requireOrganizationUploadRole(client, userId, organizationId, kind);
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

export async function uploadMedia(userId: string, input: { kind: unknown; bytes: Uint8Array; mimeType: string; crop?: ImageCrop }, storage: ObjectStorage = createObjectStorage()) {
  return uploadOwnedMedia(userId, null, input, storage);
}

export async function uploadOrganizationMedia(userId: string, organizationId: string, input: { kind: unknown; bytes: Uint8Array; mimeType: string; crop?: ImageCrop }, storage: ObjectStorage = createObjectStorage()) {
  return uploadOwnedMedia(userId, organizationId, input, storage);
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
      const asset = await client.mediaAsset.findFirst({ where: { id: mediaId, ownerUserId: userId, ownerOrganizationId: null, kind, status: "READY", deletedAt: null }, select: { id: true } });
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
    const asset = await client.mediaAsset.findFirst({ where: { id, ownerUserId: userId }, select: { status: true, avatarOf: { select: { id: true } }, coverOf: { select: { id: true } }, organizationLogoOf: { select: { id: true } }, organizationCoverOf: { select: { id: true } }, postMedia: { select: { postId: true } } } });
    if (!asset) throw unavailableMedia();
    if (asset.status === "PENDING") throw new MediaError("MEDIA_PENDING", 409, "Aguarde a conclusão do envio antes de remover a imagem.");
    if (asset.avatarOf || asset.coverOf || asset.organizationLogoOf || asset.organizationCoverOf || asset.postMedia) throw new MediaError("MEDIA_ATTACHED", 409, "Remova a imagem do perfil ou da publicação antes de excluí-la.");
    if (asset.status !== "DELETED") await client.mediaAsset.update({ where: { id }, data: { status: "DELETED", deletedAt: new Date() } });
  });
}

export async function deleteUnattachedOrganizationMedia(userId: string, organizationId: string, rawId: string) {
  const id = mediaIdentifierSchema.parse(rawId);
  await db.$transaction(async (client) => {
    await lockNetworkUsers(client, [userId]); await lockMedia(client, [id]);
    const asset = await client.mediaAsset.findFirst({ where: { id, ownerOrganizationId: organizationId, ownerUserId: null }, select: {
      kind: true, status: true, avatarOf: { select: { id: true } }, coverOf: { select: { id: true } }, organizationLogoOf: { select: { id: true } }, organizationCoverOf: { select: { id: true } }, postMedia: { select: { postId: true } },
    } });
    if (!asset) throw unavailableMedia();
    await requireOrganizationUploadRole(client, userId, organizationId, asset.kind);
    if (asset.status === "PENDING") throw new MediaError("MEDIA_PENDING", 409, "Aguarde a conclusão do envio antes de remover a imagem.");
    if (asset.avatarOf || asset.coverOf || asset.organizationLogoOf || asset.organizationCoverOf || asset.postMedia) throw new MediaError("MEDIA_ATTACHED", 409, "Remova a imagem do perfil ou da publicação antes de excluí-la.");
    if (asset.status !== "DELETED") await client.mediaAsset.update({ where: { id }, data: { status: "DELETED", deletedAt: new Date() } });
  });
}

export async function authorizeMedia(id: string, viewerUserId?: string | null): Promise<MediaAsset> {
  if (!mediaIdentifierSchema.safeParse(id).success) throw unavailableMedia();
  const asset = await db.mediaAsset.findFirst({ where: { id, status: "READY", deletedAt: null }, include: {
    avatarOf: { select: { userId: true, profileVisibility: true, publishedAt: true, directoryEnabled: true } },
    coverOf: { select: { userId: true, profileVisibility: true, publishedAt: true, directoryEnabled: true } },
    organizationLogoOf: { select: { organizationId: true, publishedAt: true, organization: { select: { status: true } } } },
    organizationCoverOf: { select: { organizationId: true, publishedAt: true, organization: { select: { status: true } } } },
    postMedia: { select: { postId: true, post: { select: { authorOrganizationId: true } } } },
  } });
  if (!asset) throw unavailableMedia();
  if (asset.postMedia) {
    if (await db.socialPost.findFirst({ where: { AND: [{ id: asset.postMedia.postId }, visiblePostWhere(viewerUserId)] }, select: { id: true } })) return asset;
    const organizationId = asset.postMedia.post.authorOrganizationId;
    if (viewerUserId && organizationId && await db.organizationMembership.findFirst({ where: { organizationId, userId: viewerUserId, status: "ACTIVE", organization: { status: "ACTIVE" } }, select: { id: true } })) return asset;
    throw unavailableMedia();
  }
  const organizationProfile = asset.organizationLogoOf ?? asset.organizationCoverOf;
  if (organizationProfile) {
    if (organizationProfile.organization.status !== "ACTIVE") throw unavailableMedia();
    if (organizationProfile.publishedAt) return asset;
    if (viewerUserId && await db.organizationMembership.findFirst({ where: { organizationId: organizationProfile.organizationId, userId: viewerUserId, status: "ACTIVE", organization: { status: "ACTIVE" } }, select: { id: true } })) return asset;
    throw unavailableMedia();
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
