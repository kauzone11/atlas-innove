import { z } from "zod";

export const collaborationStatusSchema = z.enum(["OPEN", "SELECTIVE", "NOT_AVAILABLE"]);
export const collaborationNoteSchema = z.string().trim().max(500, "Use até 500 caracteres.").nullable().transform((value) => value || null);

const filters = {
  q: z.string().trim().max(100, "Use até 100 caracteres na busca.").optional(),
  topic: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(40).default(24),
};
export const peopleDiscoverySchema = z.object({
  ...filters,
  state: z.string().trim().max(120).optional(),
  collaborationStatus: collaborationStatusSchema.optional(),
  projectId: z.string().trim().min(1).max(128).optional(),
}).strict();
export const projectDiscoverySchema = z.object({
  ...filters,
  status: z.enum(["IDEA", "ACTIVE", "PAUSED", "COMPLETED"]).optional(),
  collaborationOpen: z.enum(["true", "false"]).optional(),
}).strict();
export type PeopleDiscoveryFilters = z.infer<typeof peopleDiscoverySchema>;
export type ProjectDiscoveryFilters = z.infer<typeof projectDiscoverySchema>;

function queryValues(input: Record<string, string | string[] | undefined>, keys: string[]) {
  return Object.fromEntries(keys.flatMap((key) => typeof input[key] === "string" && input[key] !== "" ? [[key, input[key]]] : []));
}
export function parsePeopleDiscoveryFilters(input: Record<string, string | string[] | undefined>): PeopleDiscoveryFilters {
  const values = queryValues(input, ["q", "topic", "state", "collaborationStatus", "projectId", "page"]);
  const parsed = peopleDiscoverySchema.safeParse(values);
  return parsed.success ? parsed.data : peopleDiscoverySchema.parse({});
}
export function parseProjectDiscoveryFilters(input: Record<string, string | string[] | undefined>): ProjectDiscoveryFilters {
  const values = queryValues(input, ["q", "topic", "status", "collaborationOpen", "page"]);
  const parsed = projectDiscoverySchema.safeParse(values);
  return parsed.success ? parsed.data : projectDiscoverySchema.parse({});
}
