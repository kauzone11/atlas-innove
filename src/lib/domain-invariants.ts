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
  if (status === "ARCHIVED") {
    throw new DomainConflictError("COHORT_ARCHIVED_FOR_WAVE");
  }
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
