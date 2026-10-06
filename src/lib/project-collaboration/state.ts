import { calendarToday } from "@/lib/execution/state";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";
export type ResourceType = "DOCUMENT" | "REPOSITORY" | "DESIGN" | "RESEARCH" | "DATA" | "OTHER";

export const taskStatusLabels: Record<TaskStatus, string> = { TODO: "Pendente", IN_PROGRESS: "Em andamento", DONE: "Concluída", CANCELLED: "Cancelada" };
export const taskPriorityLabels: Record<TaskPriority, string> = { LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta" };
export const resourceTypeLabels: Record<ResourceType, string> = { DOCUMENT: "Documento", REPOSITORY: "Repositório", DESIGN: "Design", RESEARCH: "Pesquisa", DATA: "Dados", OTHER: "Outro" };

export function taskIsTerminal(status: TaskStatus) { return status === "DONE" || status === "CANCELLED"; }
export function canTransitionTask(from: TaskStatus, to: TaskStatus) { return !taskIsTerminal(from) && from !== to; }
export const projectCalendarToday = calendarToday;
export function isTaskOverdue(task: { status: TaskStatus; dueAt: string | null }, today = projectCalendarToday()) {
  return !taskIsTerminal(task.status) && Boolean(task.dueAt && task.dueAt.slice(0, 10) < today);
}
