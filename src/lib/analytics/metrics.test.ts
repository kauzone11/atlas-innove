import assert from "node:assert/strict";
import test from "node:test";
import { areMetricSemanticsCompatible, canChangeMetricMapping } from "./metric-compatibility";
import { metricDefinitionSchema } from "./metric-schemas";

test("canonical mapping requires type, exact unit and ordered category semantics", () => {
  assert.equal(areMetricSemanticsCompatible({ valueType: "CURRENCY", unit: "BRL" }, { valueType: "INTEGER", unit: "BRL" }), false);
  assert.equal(areMetricSemanticsCompatible({ valueType: "CURRENCY", unit: "BRL" }, { valueType: "CURRENCY", unit: "USD" }), false);
  assert.equal(areMetricSemanticsCompatible({ valueType: "INTEGER" }, { valueType: "INTEGER", unit: null }), true);
  assert.equal(areMetricSemanticsCompatible({ valueType: "ENUM", allowedValues: ["Idea", "MVP"] }, { valueType: "ENUM", allowedValues: ["MVP", "Idea"] }), false);
  assert.equal(areMetricSemanticsCompatible({ valueType: "ENUM", allowedValues: ["Idea", "MVP"] }, { valueType: "ENUM", allowedValues: ["Idea", "MVP"] }), true);
  assert.equal(areMetricSemanticsCompatible({ valueType: "ENUM" }, { valueType: "ENUM" }), false);
});

test("observed mappings preserve historical identity", () => {
  assert.equal(canChangeMetricMapping("original", "new", true), false);
  assert.equal(canChangeMetricMapping("original", null, true), false);
  assert.equal(canChangeMetricMapping("original", "original", true), true);
  assert.equal(canChangeMetricMapping(null, "new", false), true);
});

test("metric aggregation is appropriate to value type and categories stay unique", () => {
  const base = { key: "stage", label: "Estágio", valueType: "ENUM", allowedValues: ["Idea", "MVP"], primaryAggregation: "DISTRIBUTION" };
  assert.equal(metricDefinitionSchema.safeParse(base).success, true);
  assert.equal(metricDefinitionSchema.safeParse({ ...base, primaryAggregation: "MEAN" }).success, false);
  assert.equal(metricDefinitionSchema.safeParse({ ...base, allowedValues: ["MVP", "MVP"] }).success, false);
  assert.equal(metricDefinitionSchema.safeParse({ key: "team", label: "Equipe", valueType: "INTEGER", primaryAggregation: "TOTAL" }).success, true);
  assert.equal(metricDefinitionSchema.safeParse({ key: "team", label: "Equipe", valueType: "INTEGER", primaryAggregation: "DISTRIBUTION" }).success, false);
});
