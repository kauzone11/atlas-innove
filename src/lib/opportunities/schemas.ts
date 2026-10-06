import { z } from "zod";
import { tagListSchema } from "@/lib/identity/normalization";
import { brazilianStates } from "@/lib/opportunities/presentation";

export const discoveryMetadataSchema = z.object({
  publicListingEnabled: z.boolean().default(false),
  supportType: z.enum(["SUBVENTION", "SCHOLARSHIP", "CREDIT", "RESIDENCY", "ACCELERATION", "PRIZE", "SERVICES", "OTHER"]).default("OTHER"),
  territoryScope: z.enum(["MUNICIPAL", "STATE", "REGIONAL", "NATIONAL", "INTERNATIONAL", "UNSPECIFIED"]).default("UNSPECIFIED"),
  territoryLabel: z.string().trim().max(120).nullable().optional(),
  eligibleStates: z.array(z.string().trim().toUpperCase().refine((value) => brazilianStates.includes(value), "Informe uma UF brasileira válida.")).max(27).refine((values) => new Set(values).size === values.length, "Remova as UFs repetidas.").default([]),
  audienceTags: tagListSchema.default([]),
  thematicAreas: tagListSchema.default([]),
  publicationConfirmed: z.boolean().optional(),
}).refine((input) => !input.publicListingEnabled || input.publicationConfirmed, { path: ["publicationConfirmed"], message: "Confirme a publicação destas informações para qualquer pessoa." });
const nullableDate = z.coerce.date().nullable().optional();
export const externalOpportunitySchema = z.object({
  institution: z.string().trim().min(2).max(200), callNumber: z.string().trim().min(1).max(80), title: z.string().trim().min(2).max(200),
  objective: z.string().trim().min(2).max(4000), territory: z.string().trim().min(1).max(300), audience: z.string().trim().max(500).nullable().optional(),
  status: z.enum(["OPEN", "UPCOMING", "IN_REVIEW", "CLOSED", "RESULT_PUBLISHED", "ARCHIVED"]),
  publishedAt: nullableDate, applicationEndsAt: nullableDate,
  sourceUrl: z.string().trim().max(2048).url("Informe uma fonte oficial válida.").refine((value) => /^https?:\/\//i.test(value), "Use um endereço HTTP ou HTTPS."),
  sourceCheckedAt: z.coerce.date(),
}).and(discoveryMetadataSchema);
export type DiscoveryMetadataInput = z.infer<typeof discoveryMetadataSchema>;
export type ExternalOpportunityInput = z.infer<typeof externalOpportunitySchema>;
export type OpportunityFilters = { q?: string; source?: string; support?: string; territory?: string; state?: string; topic?: string; deadline?: string; status?: string; projectId?: string; saved?: boolean };
export function parseOpportunityFilters(params: Record<string, string | string[] | undefined>): OpportunityFilters {
  const text = (key: string) => typeof params[key] === "string" ? params[key].trim().slice(0, 200) : undefined;
  return { q: text("q") ?? text("search"), source: text("source"), support: text("support"), territory: text("territory"), state: text("state"), topic: text("topic"), deadline: text("deadline"), status: text("status"), projectId: text("projectId"), saved: text("saved") === "true" };
}
