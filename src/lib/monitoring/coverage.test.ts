import assert from "node:assert/strict";
import test from "node:test";

import { coverageFrom, isObservationPendingForWave } from "@/lib/monitoring/coverage";
import { formatIndicatorValue } from "@/lib/monitoring/format";

const referenceAt = new Date("2026-06-01T00:00:00Z");
const wave = { scheduledFor: referenceAt, opensAt: new Date("2026-05-15T00:00:00Z"), createdAt: new Date("2026-05-01T00:00:00Z") };

test("currency output preserves the protocol unit without converting it to BRL", () => {
  const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(0);
  assert.equal(formatIndicatorValue(0, "CURRENCY", "R$"), reais);
  assert.equal(formatIndicatorValue(0, "CURRENCY", null), reais);
  assert.equal(formatIndicatorValue(1234.5, "CURRENCY", "USD"), "1.234,50 USD");
  assert.equal(formatIndicatorValue(1234.5, "CURRENCY", "BRL/mês"), "1.234,50 BRL/mês");
  assert.equal(formatIndicatorValue(null, "CURRENCY", "USD"), "—");
});

test("later withdrawal preserves pending observations at the historical wave reference", () => {
  const observations = ["PENDING", "IN_PROGRESS", "SUBMITTED"].map((status) => ({ status, ventureEnrollment: { enrolledAt: new Date("2026-01-01T00:00:00Z"), withdrawnAt: new Date("2026-07-01T00:00:00Z") } }));
  assert.deepEqual(coverageFrom(observations, wave), { expected: 3, submitted: 1, pending: 1, inProgress: 1, missed: 0, ineligibleUnanswered: 0, percentage: 100 / 3 });
  assert.equal(isObservationPendingForWave(observations[0], wave), true);
  assert.equal(isObservationPendingForWave(observations[1], wave), true);
  assert.equal(isObservationPendingForWave(observations[2], wave), false);
});

test("ineligible unanswered observations retain their denominator without becoming actionable", () => {
  const beforeReference = { status: "PENDING", ventureEnrollment: { enrolledAt: new Date("2026-01-01T00:00:00Z"), withdrawnAt: new Date("2026-05-31T23:59:59Z") } };
  const afterReference = { status: "IN_PROGRESS", ventureEnrollment: { enrolledAt: new Date("2026-06-02T00:00:00Z"), withdrawnAt: null } };
  const submitted = { ...beforeReference, status: "SUBMITTED" };
  assert.deepEqual(coverageFrom([beforeReference, afterReference, submitted], wave), { expected: 3, submitted: 1, pending: 0, inProgress: 0, missed: 0, ineligibleUnanswered: 2, percentage: 100 / 3 });
  assert.equal(isObservationPendingForWave(beforeReference, wave), false);
  assert.equal(isObservationPendingForWave(afterReference, wave), false);
});

test("scheduled dates use calendar eligibility while opening and creation references use exact time", () => {
  const observation = { status: "PENDING", ventureEnrollment: { enrolledAt: new Date("2026-06-01T15:00:00Z"), withdrawnAt: null } };
  assert.equal(isObservationPendingForWave(observation, wave), true);
  assert.equal(isObservationPendingForWave(observation, { ...wave, scheduledFor: null, opensAt: referenceAt }), false);
  assert.equal(isObservationPendingForWave(observation, { scheduledFor: null, opensAt: null, createdAt: referenceAt }), false);
  assert.equal(coverageFrom([], wave).percentage, null);
});
