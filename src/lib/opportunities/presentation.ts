export const supportTypeLabels: Record<string, string> = { SUBVENTION: "Subvenção", SCHOLARSHIP: "Bolsa", CREDIT: "Crédito", RESIDENCY: "Residência", ACCELERATION: "Aceleração", PRIZE: "Prêmio", SERVICES: "Serviços", OTHER: "Outro apoio" };
export const territoryScopeLabels: Record<string, string> = { MUNICIPAL: "Municipal", STATE: "Estadual", REGIONAL: "Regional", NATIONAL: "Nacional", INTERNATIONAL: "Internacional", UNSPECIFIED: "Não informado" };
export const opportunityStatusLabels: Record<string, string> = { OPEN: "Aberta", UPCOMING: "Em breve", IN_REVIEW: "Em avaliação", CLOSED: "Encerrada", RESULT_PUBLISHED: "Resultado publicado", ARCHIVED: "Arquivada", DRAFT: "Rascunho" };
export const relevanceLabels = { HIGH: "Alta compatibilidade", COMPATIBLE: "Compatível", INSUFFICIENT: "Poucos dados para avaliar" };
export const brazilianStates = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

export function deadlineEnd(value: Date | string | null): Date | null {
  if (!value) return null;
  const end = new Date(value);
  return end.getUTCHours() === 0 && end.getUTCMinutes() === 0 && end.getUTCSeconds() === 0 && end.getUTCMilliseconds() === 0 ? new Date(end.getTime() + 86400000 - 1) : end;
}
export function opportunityWindow(status: string, startsAt: Date | string | null, endsAt: Date | string | null, now = new Date()): "OPEN" | "UPCOMING" | "CLOSED" | "OTHER" {
  if (["CLOSED", "ARCHIVED", "IN_REVIEW", "RESULT_PUBLISHED"].includes(status)) return "CLOSED";
  const end = deadlineEnd(endsAt);
  if (end && now > end) return "CLOSED";
  if (status === "UPCOMING" || (startsAt && now < new Date(startsAt))) return "UPCOMING";
  return status === "OPEN" ? "OPEN" : "OTHER";
}
export function deadlineLabel(status: string, startsAt: string | null, endsAt: string | null, now = new Date()): string {
  const window = opportunityWindow(status, startsAt, endsAt, now);
  if (window === "CLOSED") return "Encerrada";
  if (window === "UPCOMING") return "Em breve";
  if (window !== "OPEN") return opportunityStatusLabels[status] ?? "Consulte o edital";
  if (!endsAt) return "Aberta · prazo na fonte oficial";
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const date = new Date(endsAt);
  const days = Math.ceil((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - today) / 86400000);
  return days === 0 ? "Encerra hoje" : days > 0 ? `Encerra em ${days} ${days === 1 ? "dia" : "dias"}` : "Encerrada";
}
