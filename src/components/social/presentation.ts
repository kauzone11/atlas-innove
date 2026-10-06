import type { PostCommentPolicy, PostVisibility, ReactionType } from "@prisma/client";

export const postVisibilityLabels: Record<PostVisibility, string> = { PUBLIC: "Público", PLATFORM: "Pessoas na plataforma", CONNECTIONS: "Conexões" };
export const commentPolicyLabels: Record<PostCommentPolicy, string> = { EVERYONE: "Todos que podem ver", CONNECTIONS_ONLY: "Somente conexões", OFF: "Comentários desativados" };
export const reactionLabels: Record<ReactionType, string> = { LIKE: "Curtir", CELEBRATE: "Parabéns", SUPPORT: "Apoio", LOVE: "Amei", INSIGHTFUL: "Genial", FUNNY: "Divertido" };
export function socialDate(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Fortaleza" }).format(new Date(value)); }

