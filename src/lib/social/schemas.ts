import { z } from "zod";
import { postMediaInputSchema } from "@/lib/media/schemas";

export const socialIdentifierSchema = z.string().trim().min(1).max(128);
export const postVisibilitySchema = z.enum(["PUBLIC", "PLATFORM", "CONNECTIONS"]);
export const postCommentPolicySchema = z.enum(["EVERYONE", "CONNECTIONS_ONLY", "OFF"]);
export const reactionTypeSchema = z.enum(["LIKE", "CELEBRATE", "SUPPORT", "LOVE", "INSIGHTFUL", "FUNNY"]);
const postBody = z.string().trim().max(3000, "Use até 3.000 caracteres.").nullable().optional().transform((value) => value || null);
export const socialExternalUrlSchema = z.string().trim().max(2000).nullable().optional().transform((value) => value || null).refine((value) => {
  if (!value) return true;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && !/[\s\\]/.test(value); } catch { return false; }
}, "Use um endereço HTTPS válido, sem credenciais.");
export const createPostSchema = z.object({
  body: postBody, externalUrl: socialExternalUrlSchema,
  media: postMediaInputSchema.default([]),
  visibility: postVisibilitySchema.default("PLATFORM"), commentPolicy: postCommentPolicySchema.default("EVERYONE"), allowReposts: z.boolean().default(true),
}).strict().refine((input) => Boolean(input.body || input.externalUrl || input.media.length), "Escreva uma publicação, adicione um link ou uma imagem.");
export const updatePostSchema = z.object({ body: postBody.optional(), externalUrl: socialExternalUrlSchema.optional(), media: postMediaInputSchema.optional() }).strict().refine((input) => input.body !== undefined || input.externalUrl !== undefined || input.media !== undefined, "Modifique o texto, link ou imagens da publicação.");
export const repostSchema = z.object({
  body: postBody, visibility: postVisibilitySchema.optional(), commentPolicy: postCommentPolicySchema.default("EVERYONE"), allowReposts: z.boolean().default(true),
}).strict();
export const commentBodySchema = z.string().trim().min(1, "Escreva um comentário.").max(1500, "Use até 1.500 caracteres.");
export const createCommentSchema = z.object({ body: commentBodySchema, parentCommentId: socialIdentifierSchema.nullable().optional() }).strict();
export const updateCommentSchema = z.object({ body: commentBodySchema }).strict();
export const followSettingsSchema = z.object({ followPolicy: z.enum(["EVERYONE", "CONNECTIONS_ONLY"]), primaryProfileAction: z.enum(["CONNECT", "FOLLOW"]) }).strict();
export const socialReportSchema = z.object({
  postId: socialIdentifierSchema.optional(), commentId: socialIdentifierSchema.optional(),
  reason: z.enum(["SPAM", "HARASSMENT", "IMPERSONATION", "INAPPROPRIATE_CONTENT", "OTHER"]),
  details: z.string().trim().max(2000).nullable().optional().transform((value) => value || null),
}).strict().refine((value) => Boolean(value.postId || value.commentId), "Escolha uma publicação ou comentário.");
