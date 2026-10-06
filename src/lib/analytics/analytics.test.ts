import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { aggregateMetric } from "@/lib/analytics/aggregates";
import { pairedMetric } from "@/lib/analytics/paired";
import { resolveComparableWave } from "@/lib/analytics/comparability";
import { aggregateIndicators } from "@/lib/monitoring/aggregates";
import { formatIndicatorValue } from "@/lib/monitoring/format";
import { digestSources } from "@/lib/analytics/source-digest";
import type { MetricInput } from "@/lib/analytics/types";

const metric: MetricInput = { id: "revenue", key: "revenue", label: "Monthly revenue", valueType: "CURRENCY", unit: "R$", allowedValues: [], primaryAggregation: "TOTAL" };

test("currency aggregates keep exact decimal sums and even medians at large magnitudes", () => {
  const small = aggregateMetric(metric, ["0.10", "0.20", "0.30", null]);
  assert.equal(small.sum, "0.6"); assert.equal(small.mean, "0.2"); assert.equal(small.median, "0.2");
  assert.equal(small.validCount, 3); assert.equal(small.missingCount, 1);
  const large = aggregateMetric(metric, ["999999999999.99", "999999999999.98"]);
  assert.equal(large.sum, "1999999999999.97"); assert.equal(large.median, "999999999999.985");
  assert.equal(formatIndicatorValue("1999999999999.97", "CURRENCY", "R$"), "R$\u00a01.999.999.999.999,97");
  assert.equal(aggregateMetric(metric, ["0.01", ...Array<string>(49999).fill("0")]).mean, "0.0000002");
});

test("monitoring only aggregates submitted, valid values and keeps zero distinct from absence", () => {
  const indicator = { ...metric, id: "indicator" };
  const value = (decimalValue: Prisma.Decimal | null) => ({ indicatorDefinitionId: indicator.id, integerValue: null, decimalValue, textValue: null });
  const [aggregate] = aggregateIndicators([indicator], [
    { status: "SUBMITTED", values: [value(new Prisma.Decimal("0.10"))] },
    { status: "SUBMITTED", values: [value(new Prisma.Decimal("0.20"))] },
    { status: "SUBMITTED", values: [value(new Prisma.Decimal(0))] },
    { status: "SUBMITTED", values: [] },
    { status: "IN_PROGRESS", values: [value(new Prisma.Decimal("99"))] },
    { status: "SUBMITTED", values: [value(new Prisma.Decimal("1.001"))] },
  ]);
  assert.equal(aggregate.sum, "0.3"); assert.equal(aggregate.mean, "0.1"); assert.equal(aggregate.validCount, 3); assert.equal(aggregate.missingCount, 2);
  assert.equal(aggregateMetric(metric, [null]).sum, null); assert.equal(aggregateMetric(metric, ["0"]).sum, "0");
});

test("integer analytics reject unsafe aggregate truth", () => {
  const integer = { ...metric, valueType: "INTEGER" as const };
  assert.equal(aggregateMetric(integer, [0, null, 3]).sum, 3);
  assert.throws(() => aggregateMetric(integer, [Number.MAX_SAFE_INTEGER, 1]), /ANALYTICS_INTEGER_OVERFLOW/);
});

test("paired changes include only identical enrollment IDs with valid values on both sides", () => {
  const result = pairedMetric(metric, "wave0", "wave6", [{ enrollmentId: "a", value: "0.1" }, { enrollmentId: "b", value: "0" }, { enrollmentId: "c", value: null }], [{ enrollmentId: "a", value: "0.3" }, { enrollmentId: "b", value: null }, { enrollmentId: "d", value: "9" }])!;
  assert.equal(result.pairedCount, 1); assert.equal(result.meanAbsoluteChange, "0.2"); assert.equal(result.medianAbsoluteChange, "0.2");
  assert.equal(result.baselineAggregate.sum, "0.1"); assert.equal(result.followUpAggregate.sum, "0.3");
  assert.equal(pairedMetric({ ...metric, valueType: "ENUM" }, "a", "b", [], []), null);
  assert.equal(pairedMetric(metric, "a", "b", [{ enrollmentId: "a", value: "1" }, { enrollmentId: "a", value: "2" }], [{ enrollmentId: "a", value: "4" }])?.pairedCount, 0);
});

test("pairwise decrease stays a negative decimal and zero baseline causes no relative-change division", () => {
  const result = pairedMetric(metric, "a", "b", [{ enrollmentId: "one", value: "0.3" }, { enrollmentId: "two", value: "0" }], [{ enrollmentId: "one", value: "0.1" }, { enrollmentId: "two", value: "0" }])!;
  assert.equal(result.meanAbsoluteChange, "-0.1"); assert.equal(result.medianAbsoluteChange, "-0.1");
});

test("wave comparison requires offsets and rejects ambiguity without choosing by name or sequence", () => {
  assert.equal(resolveComparableWave([{ offsetMonths: null, name: "6 months", sequence: 2 }], 6).status, "MISSING_OFFSET");
  assert.equal(resolveComparableWave([{ offsetMonths: 6 }, { offsetMonths: 6 }], 6).status, "AMBIGUOUS_OFFSET");
  const wave = { offsetMonths: 6, name: "Unrelated title", sequence: 15 };
  assert.equal(resolveComparableWave([wave], 6).wave, wave);
});

test("source hashing canonicalizes property order while preserving category order", () => {
  assert.equal(digestSources({ b: 2, a: { d: 4, c: 3 } }), digestSources({ a: { c: 3, d: 4 }, b: 2 }));
  assert.notEqual(digestSources({ categories: ["MVP", "SCALE"] }), digestSources({ categories: ["SCALE", "MVP"] }));
});
