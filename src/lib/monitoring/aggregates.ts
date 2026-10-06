import { ExactDecimal, aggregateMetric } from "@/lib/analytics/aggregates";
import type { Prisma } from "@prisma/client";

export type IndicatorInput = {
  id: string;
  key: string;
  label: string;
  valueType: "INTEGER" | "CURRENCY" | "ENUM";
  unit: string | null;
  allowedValues: string[];
};

export type ValueInput = {
  indicatorDefinitionId: string;
  integerValue: number | null;
  decimalValue: Prisma.Decimal | string | number | null;
  textValue: string | null;
};

export type ObservationInput = { status: string; values: ValueInput[] };

export type IndicatorAggregate = IndicatorInput & {
  validCount: number;
  missingCount: number;
  sum: number | string | null;
  mean: number | string | null;
  distribution: { value: string; count: number }[];
};

export function observedValue(indicator: IndicatorInput, value: ValueInput | undefined): number | string | null {
  if (!value) return null;
  if (indicator.valueType === "INTEGER") {
    return value.decimalValue === null && value.textValue === null && value.integerValue !== null
      && Number.isSafeInteger(value.integerValue) && value.integerValue >= 0 && value.integerValue <= 2147483647 ? value.integerValue : null;
  }
  if (indicator.valueType === "CURRENCY") {
    if (value.integerValue !== null || value.textValue !== null || value.decimalValue === null) return null;
    try {
      const decimal = new ExactDecimal(value.decimalValue);
      return decimal.isFinite() && decimal.greaterThanOrEqualTo(0) && decimal.lessThanOrEqualTo("999999999999.99") && decimal.decimalPlaces() <= 2 ? decimal.toString() : null;
    } catch { return null; }
  }
  return value.integerValue === null && value.decimalValue === null && value.textValue !== null
    && indicator.allowedValues.includes(value.textValue) ? value.textValue : null;
}

export function aggregateIndicators(indicators: IndicatorInput[], observations: ObservationInput[]): IndicatorAggregate[] {
  const submitted = observations.filter((observation) => observation.status === "SUBMITTED");
  return indicators.map((indicator) => {
    const values = submitted.flatMap<number | string>((observation) => {
      const matching = observation.values.filter((value) => value.indicatorDefinitionId === indicator.id);
      const value = matching.length === 1 ? observedValue(indicator, matching[0]) : null;
      return value === null ? [] : [value];
    });
    const aggregate = aggregateMetric({ ...indicator, primaryAggregation: indicator.valueType === "ENUM" ? "DISTRIBUTION" : "TOTAL" }, values, submitted.length);
    return {
      ...indicator,
      validCount: values.length,
      missingCount: submitted.length - values.length,
      sum: aggregate.sum,
      mean: aggregate.mean,
      distribution: aggregate.distribution,
    };
  });
}

export type WaveAttention = "OVERDUE" | "OPEN" | "UPCOMING" | "CLOSED" | "ARCHIVED";

export function waveAttention(wave: { status: string; scheduledFor: string | null; opensAt: string | null; closesAt: string | null }, pending: number, now: Date): WaveAttention {
  if (wave.status === "ARCHIVED") return "ARCHIVED";
  if (wave.status === "CLOSED") return "CLOSED";
  const due = wave.closesAt ?? (wave.status === "PLANNED" ? wave.opensAt ?? wave.scheduledFor : null);
  if (due && new Date(due).getTime() < now.getTime() && (wave.status === "PLANNED" || pending > 0)) return "OVERDUE";
  return wave.status === "OPEN" ? "OPEN" : "UPCOMING";
}
