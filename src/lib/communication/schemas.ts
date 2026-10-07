import { z } from "zod";

const identifier = z.string().min(1).max(128);
export const messageBodySchema = z.string().trim().min(1, "Escreva uma mensagem.").max(4000, "Use até 4.000 caracteres.");
export const createConversationSchema = z.object({ otherUserId: identifier }).strict();
export const sendMessageSchema = z.object({ body: messageBodySchema }).strict();
export const markConversationReadSchema = z.object({ lastMessageId: identifier }).strict();
export const createDiscussionSchema = z.object({ title: z.string().trim().min(2, "Informe o assunto.").max(180), body: messageBodySchema }).strict();
export const discussionStatusSchema = z.object({ status: z.enum(["OPEN", "CLOSED"]) }).strict();
export const discussionSubscriptionSchema = z.object({ subscribed: z.boolean() }).strict();
export const safetyReportSchema = z.object({
  reportedUserId: identifier.optional(),
  conversationId: identifier.optional(),
  messageId: identifier.optional(),
  postId: identifier.optional(),
  commentId: identifier.optional(),
  reason: z.enum(["SPAM", "HARASSMENT", "IMPERSONATION", "INAPPROPRIATE_CONTENT", "OTHER"]),
  details: z.string().trim().max(2000).optional().transform((value) => value || null),
}).strict().refine((value) => !value.messageId || Boolean(value.conversationId), "Informe a conversa desta mensagem.")
  .refine((value) => !(value.conversationId && (value.postId || value.commentId)), "Escolha um único contexto para a denúncia.")
  .refine((value) => Boolean(value.postId || value.commentId || value.reportedUserId), "Escolha a pessoa ou o conteúdo que deseja denunciar.");
export const reviewSafetyReportSchema = z.object({ status: z.enum(["REVIEWED", "DISMISSED", "ACTIONED"]) }).strict();

export function boundedPage(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(1, Math.min(10000, Math.floor(number))) : 1;
}
