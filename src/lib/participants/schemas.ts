import { z } from "zod";
import { publicHandleSchema, tagListSchema } from "@/lib/identity/normalization";
import { collaborationNoteSchema } from "@/lib/network/discovery-schemas";

export const participantRoleSchema = z.enum(["OWNER", "LEAD", "MEMBER"]);
export const projectStatusSchema = z.enum(["IDEA", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const projectUrl = z.preprocess((value) => value === "" ? null : value, z.string().trim().max(2048).url("Informe um endereço válido.").refine((value) => /^https:\/\//i.test(value), "Use um endereço HTTPS.").nullable().optional());

export const createTeamSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: optionalText(4000),
}).strict();

export const updateTeamSchema = createTeamSchema.partial().extend({ archived: z.literal(true).optional() }).strict()
  .refine((input) => Object.keys(input).length > 0, { message: "Informe ao menos uma alteração." });

export const teamInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254).nullable().optional(),
  role: z.enum(["LEAD", "MEMBER"]).default("MEMBER"),
}).strict();

export const acceptTeamInviteSchema = z.union([
  z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  z.object({ inviteId: z.string().min(1).max(128) }).strict(),
]);

export const updateParticipantMemberSchema = z.union([
  z.object({ role: participantRoleSchema }).strict(),
  z.object({ action: z.enum(["remove", "leave"]) }).strict(),
]);

export const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(160),
  summary: z.string().trim().min(10).max(2000),
  description: optionalText(12000),
  status: projectStatusSchema.default("IDEA"),
  primaryTeamId: z.string().min(1).max(128).nullable().optional(),
  thematicAreas: tagListSchema.optional(),
  websiteUrl: projectUrl,
  repositoryUrl: projectUrl,
  demoUrl: projectUrl,
}).strict();

export const updateProjectSchema = createProjectSchema.partial().strict()
  .refine((input) => Object.keys(input).length > 0, { message: "Informe ao menos uma alteração." });

export const projectPublicationSchema = z.object({
  visibility: z.enum(["PUBLIC", "PLATFORM", "TEAM", "PRIVATE"]),
  directoryEnabled: z.boolean().optional(),
  collaborationOpen: z.boolean().optional(),
  collaborationNote: collaborationNoteSchema.optional(),
  publicSlug: publicHandleSchema.optional(),
  confirmed: z.boolean().optional(),
}).strict().refine((input) => input.visibility !== "PUBLIC" || input.confirmed === true, { message: "Confirme a publicação das informações do projeto.", path: ["confirmed"] });

export type CreateTeamInput = z.input<typeof createTeamSchema>;
export type UpdateTeamInput = z.input<typeof updateTeamSchema>;
export type CreateProjectInput = z.input<typeof createProjectSchema>;
export type UpdateProjectInput = z.input<typeof updateProjectSchema>;
