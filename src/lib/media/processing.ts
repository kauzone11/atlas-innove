import sharp from "sharp";
import type { MediaKind } from "@prisma/client";
import { MediaError } from "@/lib/media/errors";
import { cropSchema, type ImageCrop } from "@/lib/media/schemas";
import type { MediaVariant } from "@/lib/media/types";

export const MEDIA_SIZE_LIMITS = { PROFILE_AVATAR: 5 * 1024 * 1024, PROFILE_COVER: 8 * 1024 * 1024, POST_IMAGE: 10 * 1024 * 1024, ORGANIZATION_LOGO: 5 * 1024 * 1024, ORGANIZATION_COVER: 8 * 1024 * 1024 } as const;
const sizes = { PROFILE_AVATAR: [96, 192, 384], PROFILE_COVER: [640, 1280, 1920], POST_IMAGE: [480, 960, 1920], ORGANIZATION_LOGO: [96, 192, 384], ORGANIZATION_COVER: [640, 1280, 1920] } as const;
const variants = ["small", "medium", "large"] as const;
const invalid = () => new MediaError("MEDIA_INVALID_IMAGE", 400, "Escolha uma imagem JPEG, PNG ou WebP válida, sem animação.");
export function detectImageType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

function hasAnimationChunks(bytes: Uint8Array, type: string): boolean {
  const data = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (type === "image/png") {
    for (let offset = 8; offset + 12 <= data.length;) {
      const size = data.readUInt32BE(offset);
      if (data.toString("ascii", offset + 4, offset + 8) === "acTL") return true;
      if (size > data.length - offset - 12) break;
      offset += 12 + size;
    }
  }
  return type === "image/webp" && data.length >= 21 && data.toString("ascii", 12, 16) === "VP8X" && Boolean(data[20] & 2);
}

export async function processImage(bytes: Uint8Array, kind: MediaKind, suppliedMime: string, crop?: ImageCrop) {
  if (!bytes.byteLength || bytes.byteLength > MEDIA_SIZE_LIMITS[kind]) throw new MediaError("MEDIA_TOO_LARGE", 413, "A imagem ultrapassa o limite de tamanho permitido.");
  const detected = detectImageType(bytes);
  if (!detected || suppliedMime !== detected || hasAnimationChunks(bytes, detected)) throw invalid();
  if (crop) cropSchema.parse(crop);
  if (kind === "POST_IMAGE" && crop) throw new MediaError("MEDIA_CROP_UNAVAILABLE", 400, "As imagens de publicações preservam o enquadramento original.");
  try {
    const input = sharp(bytes, { limitInputPixels: 40_000_000, failOn: "warning", animated: true });
    const metadata = await input.metadata();
    if (!metadata.width || !metadata.height || metadata.width > 10000 || metadata.height > 10000 || metadata.width * metadata.height > 40_000_000 || (metadata.pages ?? 1) !== 1) throw invalid();
    // Raw decoded pixels discard EXIF, GPS, ICC and ancillary chunks before any stored derivative is produced.
    const oriented = await input.rotate().raw().toBuffer({ resolveWithObject: true });
    const width = oriented.info.width; const height = oriented.info.height;
    let rectangle = { left: 0, top: 0, width, height };
    if (crop) {
      rectangle = { left: Math.floor(crop.x * width), top: Math.floor(crop.y * height), width: Math.max(1, Math.floor(crop.width * width)), height: Math.max(1, Math.floor(crop.height * height)) };
      rectangle.width = Math.min(rectangle.width, width - rectangle.left); rectangle.height = Math.min(rectangle.height, height - rectangle.top);
      if (kind === "PROFILE_AVATAR" && Math.abs(rectangle.width - rectangle.height) > 2) throw new MediaError("MEDIA_AVATAR_CROP", 400, "Escolha um recorte quadrado para a foto de perfil.");
    } else if (kind === "PROFILE_AVATAR" || kind === "ORGANIZATION_LOGO") {
      const side = Math.min(width, height);
      rectangle = { left: Math.floor((width - side) / 2), top: Math.floor((height - side) / 2), width: side, height: side };
    }
    const result = {} as Record<MediaVariant, { bytes: Buffer; width: number; height: number }>;
    for (let index = 0; index < variants.length; index++) {
      const output = await sharp(oriented.data, { raw: { width, height, channels: oriented.info.channels } }).extract(rectangle)
        .resize({ width: sizes[kind][index], height: kind === "PROFILE_AVATAR" || kind === "ORGANIZATION_LOGO" ? sizes[kind][index] : undefined, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 84, effort: 4 }).toBuffer({ resolveWithObject: true });
      result[variants[index]] = { bytes: output.data, width: output.info.width, height: output.info.height };
    }
    return result;
  } catch (error) { if (error instanceof MediaError) throw error; throw invalid(); }
}

let processing = 0;
export async function withImageProcessingSlot<T>(action: () => Promise<T>): Promise<T> {
  if (processing >= 2) throw new MediaError("MEDIA_PROCESSING_BUSY", 429, "Há outras imagens sendo preparadas. Aguarde um momento e tente novamente.");
  processing++;
  try { return await action(); } finally { processing--; }
}
