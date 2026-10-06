import assert from "node:assert/strict";
import test from "node:test";
import { evaluateOpportunityRelevance } from "@/lib/opportunities/relevance";
import { deadlineLabel, opportunityWindow } from "@/lib/opportunities/presentation";
import { discoveryMetadataSchema } from "@/lib/opportunities/schemas";

test("relevance is deterministic and explains normalized themes, live project context and explicit state", () => {
  const input = { profile: { state: "SE", topics: [{ type: "INTEREST" as const, label: "Inteligência Artificial" }] }, project: { thematicAreas: ["Saúde"] }, opportunity: { thematicAreas: ["inteligencia artificial", "saude"], eligibleStates: ["SE"], audienceTags: ["startup"] } };
  const result = evaluateOpportunityRelevance(input);
  assert.deepEqual(result, evaluateOpportunityRelevance(input));
  assert.equal(result.level, "HIGH");
  assert.deepEqual(result.signals, ["INTEREST", "PROJECT_TOPIC", "STATE"]);
  assert.ok(result.reasons.some((reason) => reason.includes("Inteligência Artificial")));
  assert.ok(result.reasons.some((reason) => reason.includes("Saúde")));
  assert.ok(result.reasons.some((reason) => reason.includes("SE")));
  assert.ok(!JSON.stringify(result).includes("startup"));
  assert.ok(!JSON.stringify(result).includes("%"));
  assert.ok(!JSON.stringify(result).includes("elegível"));
});
test("partial and absent metadata cannot invent audience or negative eligibility claims", () => {
  const result = evaluateOpportunityRelevance({ opportunity: { thematicAreas: [], eligibleStates: ["SP"], audienceTags: ["estudante"] } });
  assert.equal(result.level, "INSUFFICIENT"); assert.deepEqual(result.signals, []);
  const skill = evaluateOpportunityRelevance({ profile: { state: "SE", topics: [{ type: "SKILL", label: "Software" }] }, opportunity: { thematicAreas: ["software"], eligibleStates: ["SP"] } });
  assert.equal(skill.level, "COMPATIBLE"); assert.deepEqual(skill.signals, ["SKILL"]);
  assert.ok(!skill.reasons.some((reason) => reason.includes("SP") || reason.includes("não é elegível")));
});
test("date-only deadlines include their entire UTC day and review is never open", () => {
  const today = "2026-10-06T00:00:00.000Z";
  assert.equal(opportunityWindow("OPEN", null, today, new Date("2026-10-06T23:59:59Z")), "OPEN");
  assert.equal(deadlineLabel("OPEN", null, today, new Date("2026-10-06T23:59:59Z")), "Encerra hoje");
  assert.equal(opportunityWindow("OPEN", null, today, new Date("2026-10-07T00:00:00Z")), "CLOSED");
  assert.equal(opportunityWindow("IN_REVIEW", null, null), "CLOSED");
  assert.equal(opportunityWindow("OPEN", "2026-10-10T00:00:00Z", null, new Date(today)), "UPCOMING");
});
test("publication needs confirmation and metadata rejects duplicate normalized topics and unsafe state", () => {
  const input = { publicListingEnabled: true, thematicAreas: ["Saúde"], audienceTags: [], eligibleStates: ["SE"] };
  assert.equal(discoveryMetadataSchema.safeParse(input).success, false);
  assert.equal(discoveryMetadataSchema.safeParse({ ...input, publicationConfirmed: true }).success, true);
  assert.equal(discoveryMetadataSchema.safeParse({ ...input, publicationConfirmed: true, thematicAreas: ["Saúde", "saude"] }).success, false);
  assert.equal(discoveryMetadataSchema.safeParse({ ...input, publicationConfirmed: true, eligibleStates: ["XX"] }).success, false);
});
