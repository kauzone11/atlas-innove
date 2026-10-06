import assert from "node:assert/strict";
import test from "node:test";
import { compareRelevance, explainPeopleRelevance, explainProjectRelevance } from "@/lib/network/relevance";
import { peopleDiscoverySchema, projectDiscoverySchema } from "@/lib/network/discovery-schemas";
import { profileDiscoverySchema } from "@/lib/profiles/schemas";

test("network relevance explains only true normalized structured overlap", () => {
  const context = { skills: ["Análise de dados"], interests: ["Saúde digital"], state: "Ceará", projectTopics: ["Inteligência artificial"] };
  const person = explainPeopleRelevance(context, { skills: ["Inteligencia Artificial"], interests: ["saude digital"], state: "ceara", collaborationStatus: "OPEN" });
  assert.equal(person.tier, "HIGH"); assert.equal(person.reasons.length, 3);
  assert.ok(person.reasons.some((reason) => reason.includes("Inteligencia Artificial")));
  assert.ok(person.reasons.some((reason) => reason.includes("saude digital")));
  assert.ok(person.reasons.some((reason) => reason.includes("ceara")));
  const noSignal = explainPeopleRelevance({ skills: [], interests: [] }, { skills: ["Analysis"], interests: [], collaborationStatus: "OPEN" });
  assert.deepEqual(noSignal, { tier: "GENERAL", label: "Descoberta geral", reasons: [] });
  const project = explainProjectRelevance(context, { thematicAreas: ["Analise de dados", "Saúde Digital"], collaborationOpen: true });
  assert.equal(project.tier, "HIGH"); assert.equal(project.reasons.length, 3);
  assert.ok(compareRelevance(project, noSignal) < 0);
  assert.equal(JSON.stringify(project).includes("score"), false);
  assert.equal(JSON.stringify(project).includes("%"), false);
  assert.deepEqual(explainProjectRelevance({ skills: [], interests: [] }, { thematicAreas: ["Saúde"], collaborationOpen: true }), noSignal);
});

test("directory inputs reject hidden signals, unbounded searches and exposure controls", () => {
  assert.equal(peopleDiscoverySchema.safeParse({ q: "x".repeat(101) }).success, false);
  assert.equal(peopleDiscoverySchema.safeParse({ pageSize: 41 }).success, false);
  assert.equal(peopleDiscoverySchema.safeParse({ email: "private@example.test" }).success, false);
  assert.equal(peopleDiscoverySchema.safeParse({ age: 22 }).success, false);
  assert.equal(projectDiscoverySchema.safeParse({ status: "ARCHIVED" }).success, false);
  assert.equal(projectDiscoverySchema.safeParse({ page: -1 }).success, false);
  assert.equal(projectDiscoverySchema.safeParse({ visibility: "PRIVATE" }).success, false);
  assert.equal(profileDiscoverySchema.safeParse({ directoryEnabled: true, collaborationStatus: "OPEN", collaborationNote: "x".repeat(501) }).success, false);
  assert.deepEqual(profileDiscoverySchema.parse({ directoryEnabled: false, collaborationStatus: "SELECTIVE", collaborationNote: "  " }), { directoryEnabled: false, collaborationStatus: "SELECTIVE", collaborationNote: null });
});
