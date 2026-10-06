export const projectStatusLabels: Record<string, string> = { IDEA: "Ideia", ACTIVE: "Em desenvolvimento", PAUSED: "Pausado", COMPLETED: "Concluído", ARCHIVED: "Arquivado" };
export const applicationStatusLabels: Record<string, string> = { DRAFT: "Rascunho", SUBMITTED: "Enviada", IN_REVIEW: "Em avaliação", DECIDED: "Avaliação concluída", WITHDRAWN: "Retirada" };
export const applicationDecisionLabels: Record<string, string> = { PENDING: "Pendente", SELECTED: "Selecionado", WAITLIST: "Lista de espera", NOT_SELECTED: "Não selecionado", DISQUALIFIED: "Desclassificado" };
export function formatParticipantTimestamp(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Fortaleza" }).format(new Date(value)); }
