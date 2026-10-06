import type { CallApplicationDto, CriterionDto, EvaluationDto } from "@/lib/selection/service";

export type SelectionApplication = CallApplicationDto;
export type SelectionCriterion = CriterionDto;
export type SelectionEvaluation = EvaluationDto;
export type SelectionRank = SelectionApplication & { position: number | null; tied: boolean };

export const applicationStatusLabels: Record<string, string> = { DRAFT: "Rascunho", SUBMITTED: "Enviada", IN_REVIEW: "Em avaliação", DECIDED: "Decidida", WITHDRAWN: "Retirada" };
export const decisionLabels: Record<string, string> = { PENDING: "Pendente", SELECTED: "Selecionado", WAITLIST: "Lista de espera", NOT_SELECTED: "Não selecionado", DISQUALIFIED: "Desclassificado" };

export function scoreLabel(value: number | null): string { return value === null ? "Não avaliada" : new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value); }
export function auditDateLabel(value: string | null): string { return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "Não enviada"; }
