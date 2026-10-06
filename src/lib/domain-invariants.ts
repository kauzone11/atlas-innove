import { AuthorizationError } from "@/lib/auth/authorization";
import { DomainConflictError } from "@/lib/errors";

export function assertSameOrganization(...organizationIds: string[]): void {
  if (!organizationIds.length || organizationIds.some((id) => !id || id !== organizationIds[0])) {
    throw new AuthorizationError("TENANT_SCOPE_MISMATCH");
  }
}

export function assertSameCohort(...cohortIds: string[]): void {
  if (!cohortIds.length || cohortIds.some((id) => !id || id !== cohortIds[0])) {
    throw new DomainConflictError("COHORT_SCOPE_MISMATCH");
  }
}

export function assertCohortFundingCallScope(
  cohortOrganizationId: string,
  cohortFundingProgramId: string,
  callOrganizationId: string,
  callFundingProgramId: string,
): void {
  assertSameOrganization(cohortOrganizationId, callOrganizationId);
  if (!cohortFundingProgramId || cohortFundingProgramId !== callFundingProgramId) {
    throw new DomainConflictError("FUNDING_CALL_PROGRAM_MISMATCH");
  }
}

export function assertCohortProtocolVersionScope(cohortOrganizationId: string, versionOrganizationId: string): void {
  assertSameOrganization(cohortOrganizationId, versionOrganizationId);
}

export function assertProgramCanReceiveCohort(status: string): void {
  if (status !== "DRAFT" && status !== "ACTIVE") {
    throw new DomainConflictError("PROGRAM_NOT_ELIGIBLE_FOR_COHORT");
  }
}

export function assertCohortCanReceiveEnrollment(status: string): void {
  if (status !== "PLANNED" && status !== "ACTIVE") {
    throw new DomainConflictError("COHORT_NOT_ELIGIBLE_FOR_ENROLLMENT");
  }
}

export function assertCohortCanReceiveWave(status: string): void {
  if (status !== "PLANNED" && status !== "ACTIVE") {
    throw new DomainConflictError("COHORT_NOT_ELIGIBLE_FOR_WAVE");
  }
}

const programTransitions: Record<string, string[]> = {
  DRAFT: ["ACTIVE", "CLOSED", "ARCHIVED"], ACTIVE: ["CLOSED", "ARCHIVED"], CLOSED: ["ARCHIVED"], ARCHIVED: [],
};
const cohortTransitions: Record<string, string[]> = {
  PLANNED: ["ACTIVE", "CLOSED", "ARCHIVED"], ACTIVE: ["CLOSED", "ARCHIVED"], CLOSED: ["ARCHIVED"], ARCHIVED: [],
};
const callTransitions: Record<string, string[]> = {
  DRAFT: ["OPEN", "CLOSED", "ARCHIVED"], OPEN: ["IN_REVIEW", "CLOSED", "ARCHIVED"],
  IN_REVIEW: ["RESULT_PUBLISHED", "CLOSED", "ARCHIVED"], RESULT_PUBLISHED: ["CLOSED", "ARCHIVED"], CLOSED: ["ARCHIVED"], ARCHIVED: [],
};

function assertLifecycleTransition(transitions: Record<string, string[]>, current: string, next: string, code: string) {
  if (current !== next && !transitions[current]?.includes(next)) throw new DomainConflictError(code);
}

export function assertProgramStatusTransition(current: string, next: string) {
  assertLifecycleTransition(programTransitions, current, next, "PROGRAM_STATUS_TRANSITION_INVALID");
}
export function assertCohortStatusTransition(current: string, next: string) {
  assertLifecycleTransition(cohortTransitions, current, next, "COHORT_STATUS_TRANSITION_INVALID");
}
export function assertCallStatusTransition(current: string, next: string) {
  assertLifecycleTransition(callTransitions, current, next, "CALL_STATUS_TRANSITION_INVALID");
}

export function assertEnrollmentIsUnique(existingEnrollmentId: string | null): void {
  if (existingEnrollmentId) {
    throw new AuthorizationError("VENTURE_ALREADY_ENROLLED");
  }
}

export function assertObservationIsUnique(existingObservationId: string | null): void {
  if (existingObservationId) {
    throw new DomainConflictError("OBSERVATION_ALREADY_EXISTS");
  }
}

const allowedWaveTransitions: Record<string, string[]> = {
  PLANNED: ["OPEN", "ARCHIVED"],
  OPEN: ["CLOSED"],
  CLOSED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function assertWaveStatusTransition(current: string, next: string): void {
  if (!allowedWaveTransitions[current]?.includes(next)) {
    throw new DomainConflictError("WAVE_STATUS_TRANSITION_INVALID");
  }
}

const allowedObservationTransitions: Record<string, string[]> = {
  PENDING: ["IN_PROGRESS", "MISSED"],
  IN_PROGRESS: ["SUBMITTED", "MISSED"],
  SUBMITTED: [],
  MISSED: [],
};

export function assertObservationStatusTransition(current: string, next: string): void {
  if (!allowedObservationTransitions[current]?.includes(next)) {
    throw new DomainConflictError(
      next === "SUBMITTED" ? "OBSERVATION_SUBMISSION_NOT_AVAILABLE" : "OBSERVATION_STATUS_TRANSITION_INVALID",
    );
  }
}
