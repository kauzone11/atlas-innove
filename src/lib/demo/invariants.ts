import { Prisma } from "@prisma/client";

export function configuredDemoOrganizationSlug(value = process.env.DEMO_ORGANIZATION_SLUG): string | null {
  const slug = value?.trim();
  return slug || null;
}

export function calculateDemoCoverage(expected: number, submitted: number): number {
  if (expected <= 0) return 0;
  return Math.round((Math.max(0, Math.min(submitted, expected)) / expected) * 100);
}

export function sumDemoMoney(values: ReadonlyArray<string | null | undefined>): string {
  return values.reduce((total, value) => (value == null ? total : total.plus(value)), new Prisma.Decimal(0)).toFixed(2);
}

export function sumDemoIntegers(values: ReadonlyArray<number | null | undefined>): number {
  return values.reduce<number>((total, value) => (typeof value === "number" ? total + value : total), 0);
}

export type DemoEnrollmentTimeline = {
  enrolledAt: Date | string;
  withdrawnAt?: Date | string | null;
};

export function isEnrollmentEligibleForWave(enrollment: DemoEnrollmentTimeline, waveDate: Date | string | null): boolean {
  if (!waveDate) return true;
  const scheduledAt = typeof waveDate === "string" ? new Date(waveDate) : waveDate;
  const enrolledAt = typeof enrollment.enrolledAt === "string" ? new Date(enrollment.enrolledAt) : enrollment.enrolledAt;
  const withdrawnAt = enrollment.withdrawnAt
    ? typeof enrollment.withdrawnAt === "string"
      ? new Date(enrollment.withdrawnAt)
      : enrollment.withdrawnAt
    : null;
  return enrolledAt <= scheduledAt && (!withdrawnAt || withdrawnAt > scheduledAt);
}

export function splitDemoLineSegments(values: ReadonlyArray<number | null>): number[][] {
  const segments: number[][] = [];
  let current: number[] = [];
  values.forEach((value) => {
    if (value === null || !Number.isFinite(value)) {
      if (current.length) segments.push(current);
      current = [];
      return;
    }
    current.push(value);
  });
  if (current.length) segments.push(current);
  return segments;
}
