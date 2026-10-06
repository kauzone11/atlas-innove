import { normalizeTag } from "@/lib/identity/normalization";

export type RelevanceContext = { skills: string[]; interests: string[]; state?: string | null; projectTopics?: string[] };
export type NetworkRelevance = { tier: "HIGH" | "RELATED" | "GENERAL"; label: string; reasons: string[] };
type PersonContext = { skills: string[]; interests: string[]; state?: string | null; collaborationStatus: "OPEN" | "SELECTIVE" | "NOT_AVAILABLE" };
type ProjectContext = { thematicAreas: string[]; collaborationOpen: boolean };

function overlap(labels: string[], context: string[]): string[] {
  const keys = new Set(context.map(normalizeTag).filter(Boolean));
  return labels.filter((label) => keys.has(normalizeTag(label))).slice(0, 2);
}
function result(reasons: string[], signals: number): NetworkRelevance {
  const tier = signals >= 2 ? "HIGH" : signals ? "RELATED" : "GENERAL";
  return { tier, label: tier === "HIGH" ? "Boa afinidade" : tier === "RELATED" ? "Alguns temas em comum" : "Descoberta geral", reasons: reasons.slice(0, 3) };
}
export function explainPeopleRelevance(context: RelevanceContext, candidate: PersonContext): NetworkRelevance {
  const reasons: string[] = [];
  let signals = 0;
  const skills = overlap(candidate.skills, [...context.interests, ...(context.projectTopics ?? [])]);
  if (skills.length) { signals++; reasons.push(`Competência relacionada aos seus interesses${context.projectTopics?.length ? " ou ao projeto escolhido" : ""}: ${skills.join(", ")}.`); }
  const interests = overlap(candidate.interests, context.interests);
  if (interests.length) { signals++; reasons.push(`Interesse em comum: ${interests.join(", ")}.`); }
  const projectInterests = overlap(candidate.interests, context.projectTopics ?? []);
  if (projectInterests.length && !interests.length) { signals++; reasons.push(`Tema relacionado ao projeto escolhido: ${projectInterests.join(", ")}.`); }
  if (candidate.state && context.state && normalizeTag(candidate.state) === normalizeTag(context.state)) {
    signals++; reasons.push(`Atuação no mesmo estado: ${candidate.state}.`);
  }
  return result(reasons, signals);
}
export function explainProjectRelevance(context: RelevanceContext, candidate: ProjectContext): NetworkRelevance {
  const reasons: string[] = [];
  let signals = 0;
  const skills = overlap(candidate.thematicAreas, context.skills);
  if (skills.length) { signals++; reasons.push(`Tema relacionado às suas competências: ${skills.join(", ")}.`); }
  const interests = overlap(candidate.thematicAreas, context.interests);
  if (interests.length) { signals++; reasons.push(`Tema relacionado aos seus interesses: ${interests.join(", ")}.`); }
  if (signals && candidate.collaborationOpen) { signals++; reasons.push("Projeto aberto a novas colaborações."); }
  return result(reasons, signals);
}
export function compareRelevance(left: NetworkRelevance, right: NetworkRelevance): number {
  const order = { HIGH: 0, RELATED: 1, GENERAL: 2 };
  return order[left.tier] - order[right.tier];
}
