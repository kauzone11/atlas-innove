import { z } from "zod";

const optionalText = z.string().trim().max(4000).nullable().optional().transform((value) => value || null);
export const taskStatusSchema = z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]);
export const taskPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export const resourceTypeSchema = z.enum(["DOCUMENT", "REPOSITORY", "DESIGN", "RESEARCH", "DATA", "OTHER"]);
export const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.").refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Informe uma data válida.");
export const privateResourceUrlSchema = z.string().trim().url("Informe um link HTTPS válido.").max(2000).refine((value) => {
  try { const url = new URL(value); return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password; }
  catch { return false; }
}, "Use um link HTTPS sem credenciais.");

export const createTaskSchema = z.object({
  title: z.string().trim().min(2, "Informe o título da tarefa.").max(180),
  description: optionalText,
  priority: taskPrioritySchema.default("MEDIUM"),
  assigneeUserId: z.string().min(1).max(128).nullable().optional(),
  dueAt: calendarDateSchema.nullable().optional(),
}).strict();
export const updateTaskSchema = createTaskSchema.partial().extend({
  expectedRevision: z.number().int().min(1),
  status: taskStatusSchema.optional(),
}).strict().refine((input) => Object.keys(input).some((key) => key !== "expectedRevision"), "Informe ao menos uma alteração.");
export const createResourceSchema = z.object({
  type: resourceTypeSchema.default("DOCUMENT"),
  label: z.string().trim().min(2, "Informe o nome do recurso.").max(180),
  url: privateResourceUrlSchema,
  description: optionalText,
}).strict();
export const updateResourceSchema = createResourceSchema.partial().extend({ expectedRevision: z.number().int().min(1) }).strict()
  .refine((input) => Object.keys(input).some((key) => key !== "expectedRevision"), "Informe ao menos uma alteração.");
export const removeResourceSchema = z.object({ expectedRevision: z.number().int().min(1) }).strict();
