import { normalizeTag } from "@/lib/identity/normalization";

type ProfileContext = { state?: string | null; topics?: Array<{ label: string; type: "SKILL" | "INTEREST"; normalizedKey?: string }> };
type OpportunityContext = { thematicAreas: string[]; eligibleStates: string[]; audienceTags?: string[] };
export type OpportunityRelevance = { level: "HIGH" | "COMPATIBLE" | "INSUFFICIENT"; signals: Array<"INTEREST" | "SKILL" | "PROJECT_TOPIC" | "STATE">; reasons: string[] };

export function evaluateOpportunityRelevance({ profile, project, opportunity }: { profile?: ProfileContext | null; project?: { thematicAreas: string[] } | null; opportunity: OpportunityContext }): OpportunityRelevance {
  const areas = new Map(opportunity.thematicAreas.map((label) => [normalizeTag(label), label]));
  const signals: OpportunityRelevance["signals"] = [];
  const reasons: string[] = [];
  for (const type of ["INTEREST", "SKILL"] as const) {
    const matches = (profile?.topics ?? []).filter((topic) => topic.type === type && areas.has(normalizeTag(topic.label)));
    if (matches.length) {
      signals.push(type);
      reasons.push(`${type === "INTEREST" ? "Relacionado aos interesses" : "Relacionado às competências"} do seu perfil: ${matches.map((topic) => topic.label).join(", ")}.`);
    }
  }
  const projectMatches = (project?.thematicAreas ?? []).filter((label) => areas.has(normalizeTag(label)));
  if (projectMatches.length) { signals.push("PROJECT_TOPIC"); reasons.push(`Área temática relacionada ao projeto: ${projectMatches.join(", ")}.`); }
  if (profile?.state && opportunity.eligibleStates.some((state) => state.toUpperCase() === profile.state?.toUpperCase())) {
    signals.push("STATE"); reasons.push(`O território informado inclui ${profile.state.toUpperCase()}.`);
  }
  // Audience and support type describe the call; neither proves a person's eligibility.
  return { level: signals.length >= 2 ? "HIGH" : signals.length ? "COMPATIBLE" : "INSUFFICIENT", signals, reasons: reasons.length ? reasons : ["Poucos dados em comum para avaliar. Verifique os critérios do edital."] };
}
