import assert from "node:assert/strict";
import test from "node:test";

import { DomainConflictError } from "@/lib/errors";
import { isEnrollmentEligibleAt, validateObservationValues } from "@/lib/observations/validation";
import type { IndicatorDefinitionDto } from "@/lib/tracking-protocols/service";

const indicators: IndicatorDefinitionDto[] = [
  { id: "integer", key: "team_size", label: "Team", valueType: "INTEGER", unit: null, position: 0, allowedValues: null },
  { id: "currency", key: "revenue", label: "Revenue", valueType: "CURRENCY", unit: "R$", position: 1, allowedValues: null },
  { id: "enum", key: "stage", label: "Stage", valueType: "ENUM", unit: null, position: 2, allowedValues: ["Prototype", "Market"] },
];

function rejectsCode(inputs: Parameters<typeof validateObservationValues>[1], code: string) {
  assert.throws(() => validateObservationValues(indicators, inputs), (error) => error instanceof DomainConflictError && error.code === code);
}

test("missing observation inputs remain absent while observed zero is retained", () => {
  const values = validateObservationValues(indicators, [{ indicatorDefinitionId: "integer", value: 0 }, { indicatorDefinitionId: "currency", value: "0.00" }, { indicatorDefinitionId: "enum", value: "  " }]);
  assert.deepEqual(values, [
    { indicatorDefinitionId: "integer", integerValue: 0, decimalValue: null, textValue: null },
    { indicatorDefinitionId: "currency", integerValue: null, decimalValue: "0.00", textValue: null },
  ]);
  assert.deepEqual(validateObservationValues(indicators, [{ indicatorDefinitionId: "integer", value: null }]), []);
});

test("an observation rejects unknown and duplicate indicators even when their values are missing", () => {
  rejectsCode([{ indicatorDefinitionId: "other-version", value: null }], "OBSERVATION_INDICATOR_VERSION_MISMATCH");
  rejectsCode([{ indicatorDefinitionId: "integer", value: "" }, { indicatorDefinitionId: "integer", value: 3 }], "OBSERVATION_INDICATOR_DUPLICATE");
});

test("observation numeric precision and enum membership fail closed", () => {
  for (const value of ["-1", "1.2", "2147483648", "one"]) rejectsCode([{ indicatorDefinitionId: "integer", value }], "OBSERVATION_INTEGER_INVALID");
  for (const value of ["-1", "0.001", "1000000000000.00", "1,50", "1e3"]) rejectsCode([{ indicatorDefinitionId: "currency", value }], "OBSERVATION_CURRENCY_INVALID");
  rejectsCode([{ indicatorDefinitionId: "enum", value: "market" }], "OBSERVATION_ENUM_INVALID");
  assert.equal(validateObservationValues(indicators, [{ indicatorDefinitionId: "enum", value: "Market" }])[0].textValue, "Market");
});

test("historical eligibility uses enrollment dates and retains participation before withdrawal", () => {
  const enrollment = { enrolledAt: new Date("2026-01-10T15:00:00Z"), withdrawnAt: new Date("2026-07-10T12:00:00Z") };
  assert.equal(isEnrollmentEligibleAt(enrollment, new Date("2026-01-10T00:00:00Z"), true), true);
  assert.equal(isEnrollmentEligibleAt(enrollment, new Date("2026-01-10T00:00:00Z")), false);
  assert.equal(isEnrollmentEligibleAt(enrollment, new Date("2026-01-09T23:59:59Z"), true), false);
  assert.equal(isEnrollmentEligibleAt(enrollment, new Date("2026-07-01T00:00:00Z"), true), true);
  assert.equal(isEnrollmentEligibleAt(enrollment, new Date("2026-07-10T12:00:00Z")), false);
});
