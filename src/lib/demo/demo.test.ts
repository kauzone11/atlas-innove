import assert from "node:assert/strict";
import test from "node:test";

import { demoVentureFixtures } from "@/demo/fixtures";
import { calculateDemoCoverage, configuredDemoOrganizationSlug, isEnrollmentEligibleForWave, splitDemoLineSegments, sumDemoIntegers, sumDemoMoney } from "@/lib/demo/invariants";

test("demo aggregation keeps missing monetary observations out of the total", () => {
  assert.equal(sumDemoMoney([null, undefined, "1200.00", null]), "1200.00");
});

test("demo aggregation skips missing integer observations instead of treating them as zero", () => {
  assert.equal(sumDemoIntegers([3, null, undefined, 4]), 7);
});

test("demo coverage uses an explicit denominator and never treats overflow as extra coverage", () => {
  assert.equal(calculateDemoCoverage(9, 8), 89);
  assert.equal(calculateDemoCoverage(9, 12), 100);
  assert.equal(calculateDemoCoverage(0, 0), 0);
});

test("public demo organization is configured by one server-side slug", () => {
  assert.equal(configuredDemoOrganizationSlug(" atlas-innove-demo "), "atlas-innove-demo");
  assert.equal(configuredDemoOrganizationSlug(""), null);
  assert.equal(configuredDemoOrganizationSlug("other-tenant"), "other-tenant");
});

test("fictitious demo fixtures are deterministic and missed waves have no values", () => {
  assert.equal(demoVentureFixtures.length, 10);
  assert.equal(demoVentureFixtures.some((venture) => venture.observations.some((observation) => observation.status === "MISSED" && observation.values)), false);
  assert.equal(demoVentureFixtures.some((venture) => venture.status === "WITHDRAWN"), true);
});

test("historical coverage includes a venture before withdrawal and excludes it afterwards", () => {
  const enrollment = { enrolledAt: "2023-02-14", withdrawnAt: "2024-11-18" };
  assert.equal(isEnrollmentEligibleForWave(enrollment, "2024-02-14"), true);
  assert.equal(isEnrollmentEligibleForWave(enrollment, "2025-02-14"), false);
});

test("longitudinal line segments preserve gaps for missing observations", () => {
  assert.deepEqual(splitDemoLineSegments([10, 20, null, 40, null]), [[10, 20], [40]]);
});
