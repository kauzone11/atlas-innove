import { z } from "zod";

export const mediaKindSchema = z.enum(["PROFILE_AVATAR", "PROFILE_COVER", "POST_IMAGE"]);
export const mediaIdentifierSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, "Esta imagem não está disponível.");
export const cropSchema = z.object({ x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(1), width: z.number().finite().gt(0).max(1), height: z.number().finite().gt(0).max(1) }).strict().refine((value) => value.x + value.width <= 1.000001 && value.y + value.height <= 1.000001, "Ajuste o recorte dentro da imagem.");
export type ImageCrop = z.infer<typeof cropSchema>;
export const profileMediaSchema = z.object({ kind: z.enum(["PROFILE_AVATAR", "PROFILE_COVER"]), mediaId: mediaIdentifierSchema.nullable() }).strict();
export const postMediaInputSchema = z.array(z.object({ mediaId: mediaIdentifierSchema, altText: z.string().trim().max(500, "Use até 500 caracteres na descrição da imagem.").nullable().optional().transform((value) => value || null) }).strict()).max(4, "Adicione até quatro imagens.").refine((items) => new Set(items.map((item) => item.mediaId)).size === items.length, "Cada imagem só pode aparecer uma vez.");
