import { z } from "zod";
import { publicHandleSchema, tagListSchema } from "@/lib/identity/normalization";
import { collaborationNoteSchema, collaborationStatusSchema } from "@/lib/network/discovery-schemas";

export const visibilitySchema = z.enum(["PUBLIC", "PLATFORM", "TEAM", "PRIVATE"], { errorMap: () => ({ message: "Escolha uma opção de visibilidade válida." }) });
const optionalText = (max: number) => z.string().trim().max(max, `Use até ${max} caracteres.`).nullable().transform((value) => value || null);
export const profileIdentitySchema = z.object({
  handle: publicHandleSchema.nullable(),
  headline: optionalText(180), city: optionalText(120), state: optionalText(120), country: optionalText(120),
}).strict();
export const profileAboutSchema = z.object({ bio: optionalText(4000) }).strict();
export const profileTopicsSchema = z.object({ skills: tagListSchema, interests: tagListSchema }).strict();
export const profileDiscoverySchema = z.object({
  directoryEnabled: z.boolean(), collaborationStatus: collaborationStatusSchema, collaborationNote: collaborationNoteSchema,
}).strict();
export const profilePrivacySchema = z.object({
  profileVisibility: visibilitySchema, skillsVisibility: visibilitySchema, experienceVisibility: visibilitySchema,
  educationVisibility: visibilitySchema, linksVisibility: visibilitySchema, verifiedParticipationVisibility: visibilitySchema,
  projectsVisibility: visibilitySchema,
}).strict();

export const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.").refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value && value >= "1900-01-01" && value <= "2200-12-31";
}, "Informe uma data válida entre 1900 e 2200.");
const requiredText = (max: number) => z.string().trim().min(2, "Informe ao menos dois caracteres.").max(max);
export const profileExperienceSchema = z.object({
  organizationName: requiredText(160), title: requiredText(160), startsAt: dateOnlySchema,
  endsAt: dateOnlySchema.nullable(), current: z.boolean(), description: optionalText(2400),
  visibility: visibilitySchema.default("PRIVATE"),
}).strict().superRefine((input, context) => {
  if (input.current && input.endsAt) context.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "Uma experiência atual não pode ter data final." });
  if (input.endsAt && input.endsAt < input.startsAt) context.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "A data final deve ser igual ou posterior à inicial." });
});
export const profileEducationSchema = z.object({
  institution: requiredText(160), course: requiredText(160), degree: optionalText(120),
  startsAt: dateOnlySchema.nullable(), endsAt: dateOnlySchema.nullable(), description: optionalText(2400),
  visibility: visibilitySchema.default("PRIVATE"),
}).strict().refine((input) => !input.startsAt || !input.endsAt || input.endsAt >= input.startsAt, {
  path: ["endsAt"], message: "A data final deve ser igual ou posterior à inicial.",
});
export const safeProfileUrlSchema = z.string().trim().max(2000).url("Informe um endereço HTTPS válido.").refine((value) => {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}, "Use um endereço HTTPS, sem credenciais.");
export const profileLinkSchema = z.object({
  label: requiredText(120), url: safeProfileUrlSchema,
  type: z.enum(["WEBSITE", "LINKEDIN", "GITHUB", "ORCID", "PORTFOLIO", "OTHER"]),
  visibility: visibilitySchema.default("PRIVATE"),
}).strict();
export const profileUpdateSchema = z.discriminatedUnion("section", [
  z.object({ section: z.literal("identity"), data: profileIdentitySchema }).strict(),
  z.object({ section: z.literal("about"), data: profileAboutSchema }).strict(),
  z.object({ section: z.literal("topics"), data: profileTopicsSchema }).strict(),
  z.object({ section: z.literal("privacy"), data: profilePrivacySchema }).strict(),
  z.object({ section: z.literal("discovery"), data: profileDiscoverySchema }).strict(),
  z.object({ section: z.literal("publish"), confirmed: z.literal(true, { errorMap: () => ({ message: "Confirme a publicação do seu perfil." }) }) }).strict(),
  z.object({ section: z.literal("unpublish") }).strict(),
]);
export const profileRecordKindSchema = z.enum(["experience", "education", "links"]);
export type ProfileRecordKind = z.infer<typeof profileRecordKindSchema>;
