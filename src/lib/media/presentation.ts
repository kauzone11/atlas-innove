import type { Prisma } from "@prisma/client";
import { z } from "zod";
import type { MediaDto, MediaDerivatives } from "@/lib/media/types";

const derivativeSchema = z.object({ key: z.string().regex(/^media\/[A-Za-z0-9_-]+\/(small|medium|large)\.webp$/), width: z.number().int().positive().max(10000), height: z.number().int().positive().max(10000), sizeBytes: z.number().int().positive().max(12 * 1024 * 1024) });
const derivativesSchema = z.object({ small: derivativeSchema, medium: derivativeSchema, large: derivativeSchema }).strict();
export function parseDerivatives(value: unknown): MediaDerivatives | null { const result = derivativesSchema.safeParse(value); return result.success ? result.data : null; }
export const mediaSelect = { id: true, status: true, deletedAt: true, width: true, height: true, derivatives: true } satisfies Prisma.MediaAssetSelect;
export function mediaDto(asset: { id: string; status: string; deletedAt: Date | null; width: number; height: number; derivatives: unknown } | null | undefined): MediaDto | null {
  if (!asset || asset.status !== "READY" || asset.deletedAt) return null;
  const derivatives = parseDerivatives(asset.derivatives);
  if (!derivatives) return null;
  const base = `/api/media/${encodeURIComponent(asset.id)}`;
  const widths = new Map<number, string>();
  for (const variant of ["small", "medium", "large"] as const) widths.set(derivatives[variant].width, `${base}?variant=${variant} ${derivatives[variant].width}w`);
  return { id: asset.id, width: asset.width, height: asset.height, url: `${base}?variant=medium`, srcSet: [...widths.values()].join(", "), detailUrl: `${base}?variant=large` };
}
