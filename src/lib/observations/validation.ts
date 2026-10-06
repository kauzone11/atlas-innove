import { DomainConflictError } from "@/lib/errors";
import type { IndicatorDefinitionDto } from "@/lib/tracking-protocols/service";
import type { SaveObservationValuesInput } from "@/lib/observations/schemas";

export type ValidatedObservationValue = { indicatorDefinitionId: string; integerValue: number | null; decimalValue: string | null; textValue: string | null };

export function validateObservationValues(indicators: IndicatorDefinitionDto[], inputs: SaveObservationValuesInput["values"]): ValidatedObservationValue[] {
  const definitions = new Map(indicators.map((indicator) => [indicator.id, indicator]));
  const seen = new Set<string>();
  const result: ValidatedObservationValue[] = [];
  for (const input of inputs) {
    if (seen.has(input.indicatorDefinitionId)) throw new DomainConflictError("OBSERVATION_INDICATOR_DUPLICATE");
    seen.add(input.indicatorDefinitionId);
    const indicator = definitions.get(input.indicatorDefinitionId);
    if (!indicator) throw new DomainConflictError("OBSERVATION_INDICATOR_VERSION_MISMATCH");
    const value = input.value === null ? "" : String(input.value).trim();
    if (!value) continue;
    const normalized: ValidatedObservationValue = { indicatorDefinitionId: indicator.id, integerValue: null, decimalValue: null, textValue: null };
    if (indicator.valueType === "INTEGER") {
      if (!/^\d+$/.test(value) || Number(value) > 2147483647) throw new DomainConflictError("OBSERVATION_INTEGER_INVALID");
      normalized.integerValue = Number(value);
    } else if (indicator.valueType === "CURRENCY") {
      if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(value)) throw new DomainConflictError("OBSERVATION_CURRENCY_INVALID");
      normalized.decimalValue = value;
    } else {
      if (!indicator.allowedValues?.includes(value)) throw new DomainConflictError("OBSERVATION_ENUM_INVALID");
      normalized.textValue = value;
    }
    result.push(normalized);
  }
  return result;
}

export function isEnrollmentEligibleAt(enrollment: { enrolledAt: Date; withdrawnAt: Date | null }, referenceAt: Date, calendarReference = false): boolean {
  const enrolledAt = calendarReference ? Date.UTC(enrollment.enrolledAt.getUTCFullYear(), enrollment.enrolledAt.getUTCMonth(), enrollment.enrolledAt.getUTCDate()) : enrollment.enrolledAt.getTime();
  const comparisonAt = calendarReference ? Date.UTC(referenceAt.getUTCFullYear(), referenceAt.getUTCMonth(), referenceAt.getUTCDate()) : referenceAt.getTime();
  return enrolledAt <= comparisonAt && (!enrollment.withdrawnAt || enrollment.withdrawnAt > referenceAt);
}
