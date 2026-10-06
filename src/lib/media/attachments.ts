import type { Prisma } from "@prisma/client";
import { MediaError, unavailableMedia } from "@/lib/media/errors";
import { lockMedia } from "@/lib/media/service";

export type PostMediaInput = { mediaId: string; altText: string | null };
export async function attachPostMedia(client: Prisma.TransactionClient, userId: string, postId: string, input: PostMediaInput[]) {
  if (input.length > 4 || new Set(input.map((item) => item.mediaId)).size !== input.length) throw new MediaError("MEDIA_POST_LIMIT", 400, "Adicione até quatro imagens diferentes.");
  const current = await client.socialPostMedia.findMany({ where: { postId }, select: { mediaId: true } });
  const ids = input.map((item) => item.mediaId);
  await lockMedia(client, [...ids, ...current.map((item) => item.mediaId)]);
  const assets = await client.mediaAsset.findMany({ where: { id: { in: ids }, ownerUserId: userId, kind: "POST_IMAGE", status: "READY", deletedAt: null }, select: { id: true, postMedia: { select: { postId: true } } } });
  if (assets.length !== ids.length || assets.some((asset) => asset.postMedia && asset.postMedia.postId !== postId)) throw unavailableMedia();
  await client.socialPostMedia.deleteMany({ where: { postId } });
  if (input.length) await client.socialPostMedia.createMany({ data: input.map((item, position) => ({ ...item, postId, position })) });
  const removed = current.filter((item) => !ids.includes(item.mediaId)).map((item) => item.mediaId);
  if (removed.length) await client.mediaAsset.updateMany({ where: { id: { in: removed }, ownerUserId: userId }, data: { status: "DELETED", deletedAt: new Date() } });
}
