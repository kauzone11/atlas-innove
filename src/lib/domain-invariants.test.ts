import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCohortCanReceiveEnrollment,
  assertCohortCanReceiveWave,
  assertCallStatusTransition,
  assertCohortStatusTransition,
  assertProgramStatusTransition,
  assertCohortFundingCallScope,
  assertCohortProtocolVersionScope,
  assertEnrollmentIsUnique,
  assertObservationIsUnique,
  assertProgramCanReceiveCohort,
  assertSameCohort,
  assertSameOrganization,
  assertWaveStatusTransition,
} from "@/lib/domain-invariants";
import { assertActiveOrganizationAccess } from "@/lib/auth/authorization";

test("domain relationships cannot cross organization boundaries", () => {
  assert.doesNotThrow(() => assertSameOrganization("org-a", "org-a", "org-a"));
  assert.throws(() => assertSameOrganization("org-a", "org-b"), { code: "TENANT_SCOPE_MISMATCH" });
});

test("cohorts can only reference a funding call from the same organization and program", () => {
  assert.doesNotThrow(() => assertCohortFundingCallScope("org-a", "program-a", "org-a", "program-a"));
  assert.throws(() => assertCohortFundingCallScope("org-a", "program-a", "org-b", "program-a"), { code: "TENANT_SCOPE_MISMATCH" });
  assert.throws(() => assertCohortFundingCallScope("org-a", "program-a", "org-a", "program-b"), { code: "FUNDING_CALL_PROGRAM_MISMATCH" });
});

test("a cohort keeps its applied protocol version inside the tenant boundary", () => {
  assert.doesNotThrow(() => assertCohortProtocolVersionScope("org-a", "org-a"));
  assert.throws(() => assertCohortProtocolVersionScope("org-a", "org-b"), { code: "TENANT_SCOPE_MISMATCH" });
});

test("a venture cannot be enrolled twice in the same cohort", () => {
  assert.doesNotThrow(() => assertEnrollmentIsUnique(null));
  assert.throws(() => assertEnrollmentIsUnique("enrollment-1"), { code: "VENTURE_ALREADY_ENROLLED" });
});

test("organization-owned reads and program/cohort relations stay tenant-scoped", () => {
  assert.throws(() => assertSameOrganization("org-a", "org-b"), { code: "TENANT_SCOPE_MISMATCH" });
  assert.doesNotThrow(() => assertSameOrganization("org-a", "org-a"));
});

test("analysts cannot perform structural mutations through the authorization boundary", () => {
  assert.throws(() => assertActiveOrganizationAccess({
    organizationStatus: "ACTIVE",
    membershipStatus: "ACTIVE",
    role: "ANALYST",
    minimumRole: "MANAGER",
  }), { code: "ROLE_FORBIDDEN" });
});

test("enrollment rules reject cross-tenant relationships, duplicates and closed cohorts", () => {
  assert.throws(() => assertSameOrganization("org-a", "org-b"), { code: "TENANT_SCOPE_MISMATCH" });
  assert.throws(() => assertEnrollmentIsUnique("enrollment-1"), { code: "VENTURE_ALREADY_ENROLLED" });
  assert.throws(() => assertCohortCanReceiveEnrollment("CLOSED"), { code: "COHORT_NOT_ELIGIBLE_FOR_ENROLLMENT" });
  assert.throws(() => assertCohortCanReceiveEnrollment("ARCHIVED"), { code: "COHORT_NOT_ELIGIBLE_FOR_ENROLLMENT" });
});

test("wave and observation relationships preserve organization and cohort scope", () => {
  assert.throws(() => assertSameOrganization("org-a", "org-b"), { code: "TENANT_SCOPE_MISMATCH" });
  assert.throws(() => assertSameCohort("cohort-a", "cohort-b"), { code: "COHORT_SCOPE_MISMATCH" });
  assert.throws(() => assertObservationIsUnique("observation-1"), { code: "OBSERVATION_ALREADY_EXISTS" });
});

test("wave lifecycle does not reopen closed waves", () => {
  assert.doesNotThrow(() => assertWaveStatusTransition("PLANNED", "OPEN"));
  assert.doesNotThrow(() => assertWaveStatusTransition("CLOSED", "ARCHIVED"));
  assert.throws(() => assertWaveStatusTransition("CLOSED", "OPEN"), { code: "WAVE_STATUS_TRANSITION_INVALID" });
});

test("program lifecycle only permits new cohorts while draft or active", () => {
  assert.doesNotThrow(() => assertProgramCanReceiveCohort("DRAFT"));
  assert.doesNotThrow(() => assertProgramCanReceiveCohort("ACTIVE"));
  assert.throws(() => assertProgramCanReceiveCohort("CLOSED"), { code: "PROGRAM_NOT_ELIGIBLE_FOR_COHORT" });
});

test("closed and archived cohorts preserve reads but cannot receive new waves", () => {
  for (const status of ["PLANNED", "ACTIVE"]) assert.doesNotThrow(() => assertCohortCanReceiveWave(status));
  for (const status of ["CLOSED", "ARCHIVED"]) assert.throws(() => assertCohortCanReceiveWave(status), { code: "COHORT_NOT_ELIGIBLE_FOR_WAVE" });
});

test("operational lifecycles cannot resurrect terminal historical records", () => {
  assert.doesNotThrow(() => assertProgramStatusTransition("ACTIVE", "CLOSED"));
  assert.doesNotThrow(() => assertCohortStatusTransition("PLANNED", "CLOSED"));
  assert.doesNotThrow(() => assertCallStatusTransition("IN_REVIEW", "RESULT_PUBLISHED"));
  assert.doesNotThrow(() => assertCallStatusTransition("RESULT_PUBLISHED", "CLOSED"));
  for (const next of ["DRAFT", "ACTIVE"]) assert.throws(() => assertProgramStatusTransition("CLOSED", next));
  for (const next of ["PLANNED", "ACTIVE"]) assert.throws(() => assertCohortStatusTransition("CLOSED", next));
  for (const next of ["DRAFT", "OPEN", "IN_REVIEW"]) assert.throws(() => assertCallStatusTransition("CLOSED", next));
  assert.throws(() => assertCallStatusTransition("ARCHIVED", "OPEN"));
  assert.throws(() => assertCohortStatusTransition("ARCHIVED", "ACTIVE"));
  assert.throws(() => assertProgramStatusTransition("ARCHIVED", "ACTIVE"));
});
