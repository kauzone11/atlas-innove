import { z } from "zod";
import { postMediaInputSchema, mediaIdentifierSchema } from "@/lib/media/schemas";
import { socialExternalUrlSchema } from "@/lib/social/schemas";

const boundedText = (maximum: number) => z.string().trim().max(maximum).nullable().optional().transform((value) => value || null);

export const organizationProfileInputSchema = z.object({
  headline: boundedText(180),
  description: boundedText(5000),
  city: boundedText(100),
  state: boundedText(100),
  country: boundedText(100),
  websiteUrl: z.string().trim().max(2000).nullable().optional().transform((value) => value || null).refine((value) => {
    if (!value) return true;
    try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
  }, "Use um endereço HTTPS válido, sem credenciais."),
  focusAreas: z.array(z.string().trim().min(2).max(60)).max(12).default([]),
}).strict();

export const organizationProfileMediaSchema = z.object({
  kind: z.enum(["ORGANIZATION_LOGO", "ORGANIZATION_COVER"]),
  mediaId: mediaIdentifierSchema.nullable(),
}).strict();

export const organizationPublicationSchema = z.object({ published: z.boolean() }).strict();

const organizationPostFields = z.object({
  body: boundedText(3000),
  externalUrl: socialExternalUrlSchema,
  media: postMediaInputSchema.default([]),
  visibility: z.enum(["PUBLIC", "PLATFORM"]).default("PUBLIC"),
  commentPolicy: z.enum(["EVERYONE", "OFF"]).default("EVERYONE"),
  allowReposts: z.boolean().default(true),
  fundingProgramId: z.string().trim().min(1).max(128).nullable().optional().transform((value) => value || null),
}).strict();

export const organizationPostSchema = organizationPostFields.refine((input) => Boolean(input.body || input.externalUrl || input.media.length), "Escreva uma publicação, adicione um link ou uma imagem.");

export const organizationPostUpdateSchema = organizationPostFields.extend({
  revision: z.number().int().min(1),
}).refine((input) => Boolean(input.body || input.externalUrl || input.media.length), "Escreva uma publicação, adicione um link ou uma imagem.");

export const institutionDirectoryQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
}).strict();
