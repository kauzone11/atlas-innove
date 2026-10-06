import { Prisma } from "@prisma/client";

type DecimalValue = Prisma.Decimal | string | number;
export type ScoringCriterion = { id: string; weight: DecimalValue; maxScore: DecimalValue };
export type ScoringEvaluation = { status: string; scores: { criterionId: string; score: DecimalValue }[] };

export function normalizedEvaluationScore(criteria: ScoringCriterion[], scores: ScoringEvaluation["scores"]): Prisma.Decimal | null {
  if (!criteria.length || scores.length !== criteria.length) return null;
  const values = new Map(scores.map((entry) => [entry.criterionId, new Prisma.Decimal(entry.score)]));
  if (values.size !== criteria.length) return null;
  let totalWeight = new Prisma.Decimal(0);
  let total = new Prisma.Decimal(0);
  for (const criterion of criteria) {
    const score = values.get(criterion.id);
    const max = new Prisma.Decimal(criterion.maxScore);
    const weight = new Prisma.Decimal(criterion.weight);
    if (!score || max.lte(0) || weight.lte(0) || score.lt(0) || score.gt(max)) return null;
    totalWeight = totalWeight.add(weight);
    total = total.add(score.div(max).mul(weight));
  }
  return total.div(totalWeight).mul(100);
}

export function aggregateApplicationScore(criteria: ScoringCriterion[], evaluations: ScoringEvaluation[]): { score: Prisma.Decimal | null; evaluationCount: number } {
  const submitted = evaluations.filter((evaluation) => evaluation.status === "SUBMITTED").map((evaluation) => normalizedEvaluationScore(criteria, evaluation.scores)).filter((score): score is Prisma.Decimal => score !== null);
  return { score: submitted.length ? submitted.reduce((sum, score) => sum.add(score), new Prisma.Decimal(0)).div(submitted.length) : null, evaluationCount: submitted.length };
}

export function rankApplications<T extends { id: string; score: number | null; exactScore?: string | null; projectNameSnapshot: string }>(applications: T[]): (T & { position: number | null; tied: boolean })[] {
  const compareScore = (a: T, b: T) => a.score === null && b.score === null ? 0 : a.score === null ? 1 : b.score === null ? -1 : new Prisma.Decimal(b.exactScore ?? b.score).comparedTo(new Prisma.Decimal(a.exactScore ?? a.score));
  const equalScore = (a: T, b?: T) => Boolean(b && a.score !== null && b.score !== null && compareScore(a, b) === 0);
  const sorted = [...applications].sort((a, b) => compareScore(a, b) || a.projectNameSnapshot.localeCompare(b.projectNameSnapshot, "pt-BR") || a.id.localeCompare(b.id));
  let position = 0;
  return sorted.map((application, index) => {
    if (application.score !== null && !equalScore(application, sorted[index - 1])) position = index + 1;
    return { ...application, position: application.score === null ? null : position, tied: equalScore(application, sorted[index - 1]) || equalScore(application, sorted[index + 1]) };
  });
}
