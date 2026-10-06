import { isEnrollmentEligibleAt } from "@/lib/observations/validation";

type WaveReference = { scheduledFor: Date | null; opensAt: Date | null; createdAt: Date };
type CoverageObservation = { status: string; ventureEnrollment: { enrolledAt: Date; withdrawnAt: Date | null } };

export type CoverageDto = { expected: number; submitted: number; pending: number; inProgress: number; missed: number; ineligibleUnanswered: number; percentage: number | null };

export function isObservationEligibleForWave(observation: CoverageObservation, wave: WaveReference): boolean {
  return isEnrollmentEligibleAt(observation.ventureEnrollment, wave.scheduledFor ?? wave.opensAt ?? wave.createdAt, Boolean(wave.scheduledFor));
}

export function isObservationPendingForWave(observation: CoverageObservation, wave: WaveReference): boolean {
  return ["PENDING", "IN_PROGRESS"].includes(observation.status) && isObservationEligibleForWave(observation, wave);
}

export function coverageFrom(observations: CoverageObservation[], wave: WaveReference): CoverageDto {
  const counts = { expected: observations.length, submitted: 0, pending: 0, inProgress: 0, missed: 0, ineligibleUnanswered: 0 };
  for (const observation of observations) {
    if (observation.status === "SUBMITTED") counts.submitted += 1;
    else if (!isObservationEligibleForWave(observation, wave)) counts.ineligibleUnanswered += 1;
    else if (observation.status === "PENDING") counts.pending += 1;
    else if (observation.status === "IN_PROGRESS") counts.inProgress += 1;
    else if (observation.status === "MISSED") counts.missed += 1;
  }
  return { ...counts, percentage: counts.expected ? counts.submitted * 100 / counts.expected : null };
}
