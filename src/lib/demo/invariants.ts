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
  return values.reduce((total, value) => total.plus(value ?? 0), new Prisma.Decimal(0)).toFixed(2);
}

export function sumDemoIntegers(values: ReadonlyArray<number | null | undefined>): number {
  return values.reduce<number>((total, value) => (typeof value === "number" ? total + value : total), 0);
}
