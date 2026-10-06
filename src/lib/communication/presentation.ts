export const safetyReasonLabels = { SPAM: "Spam ou contato repetitivo", HARASSMENT: "Assédio", IMPERSONATION: "Falsa identidade", INAPPROPRIATE_CONTENT: "Conteúdo inadequado", OTHER: "Outro motivo" } as const;
export const safetyStatusLabels = { OPEN: "Pendentes", REVIEWED: "Analisadas", DISMISSED: "Arquivadas sem ação", ACTIONED: "Ação registrada" } as const;
export function communicationDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Fortaleza" }).format(new Date(value));
}
export function communicationTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Fortaleza" }).format(new Date(value));
}
