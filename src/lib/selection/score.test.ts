import assert from "node:assert/strict";
import test from "node:test";
import { aggregateApplicationScore, normalizedEvaluationScore, rankApplications } from "@/lib/selection/score";

const criteria = [{ id: "feasibility", maxScore: "10", weight: "3" }, { id: "innovation", maxScore: "5", weight: "1" }];
const highScores = [{ criterionId: "feasibility", score: "8" }, { criterionId: "innovation", score: "5" }];

test("normalized weighted scoring uses criterion maxima and Decimal arithmetic", () => {
  assert.equal(normalizedEvaluationScore(criteria, highScores)?.toString(), "85");
  assert.equal(normalizedEvaluationScore(criteria, [{ criterionId: "feasibility", score: "0" }, { criterionId: "innovation", score: "0" }])?.toString(), "0");
  assert.equal(normalizedEvaluationScore(criteria, [{ criterionId: "feasibility", score: "10" }, { criterionId: "innovation", score: "5" }])?.toString(), "100");
  const decimalScore = normalizedEvaluationScore([{ id: "a", maxScore: "0.3", weight: "0.1" }, { id: "b", maxScore: "0.7", weight: "0.2" }], [{ criterionId: "a", score: "0.3" }, { criterionId: "b", score: "0.7" }]);
  assert.equal(decimalScore?.toString(), "100");
});

test("missing, duplicate, foreign and out-of-range criterion values have no complete score", () => {
  assert.equal(normalizedEvaluationScore(criteria, []), null);
  assert.equal(normalizedEvaluationScore(criteria, [{ criterionId: "feasibility", score: "1" }, { criterionId: "feasibility", score: "2" }]), null);
  assert.equal(normalizedEvaluationScore(criteria, [{ criterionId: "other", score: "1" }, highScores[1]]), null);
  assert.equal(normalizedEvaluationScore(criteria, [{ criterionId: "feasibility", score: "11" }, highScores[1]]), null);
  assert.equal(normalizedEvaluationScore(criteria, [{ criterionId: "feasibility", score: "-1" }, highScores[1]]), null);
});

test("application average includes submitted evaluations only and missing is not zero", () => {
  assert.deepEqual(aggregateApplicationScore(criteria, [{ status: "DRAFT", scores: highScores }]), { score: null, evaluationCount: 0 });
  const result = aggregateApplicationScore(criteria, [{ status: "SUBMITTED", scores: highScores }, { status: "DRAFT", scores: [{ criterionId: "feasibility", score: "0" }, { criterionId: "innovation", score: "0" }] }, { status: "SUBMITTED", scores: [{ criterionId: "feasibility", score: "10" }, { criterionId: "innovation", score: "5" }] }]);
  assert.equal(result.score?.toString(), "92.5");
  assert.equal(result.evaluationCount, 2);
});

test("ranking derives tied positions deterministically and preserves explicit decisions", () => {
  const applications = [
    { id: "none-b", projectNameSnapshot: "Sem avaliação B", score: null, decision: "PENDING" },
    { id: "second", projectNameSnapshot: "Projeto B", score: 90, decision: "NOT_SELECTED" },
    { id: "first", projectNameSnapshot: "Projeto A", score: 90, decision: "WAITLIST" },
    { id: "third", projectNameSnapshot: "Projeto C", score: 75, decision: "SELECTED" },
    { id: "none-a", projectNameSnapshot: "Sem avaliação A", score: null, decision: "PENDING" },
  ];
  const ranked = rankApplications(applications);
  assert.deepEqual(ranked.map((application) => [application.id, application.position, application.tied]), [["first", 1, true], ["second", 1, true], ["third", 3, false], ["none-a", null, false], ["none-b", null, false]]);
  assert.equal(ranked[2].decision, "SELECTED");
  assert.deepEqual(rankApplications(applications.reverse()), ranked);
});

test("ranking compares exact Decimal scores before display rounding", () => {
  const ranked = rankApplications([{ id: "a", projectNameSnapshot: "Alphabetically first", score: 90, exactScore: "90.00000001" }, { id: "b", projectNameSnapshot: "Alphabetically second", score: 90, exactScore: "90.00000002" }]);
  assert.deepEqual(ranked.map((application) => [application.id, application.position, application.tied]), [["b", 1, false], ["a", 2, false]]);
});
