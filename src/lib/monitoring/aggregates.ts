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
  decimalValue: number | null;
  textValue: string | null;
};

export type ObservationInput = { status: string; values: ValueInput[] };

export type IndicatorAggregate = IndicatorInput & {
  validCount: number;
  missingCount: number;
  sum: number | null;
  mean: number | null;
  distribution: { value: string; count: number }[];
};

export function observedValue(indicator: IndicatorInput, value: ValueInput | undefined): number | string | null {
  if (!value) return null;
  if (indicator.valueType === "INTEGER") {
    return value.decimalValue === null && value.textValue === null && value.integerValue !== null
      && Number.isSafeInteger(value.integerValue) && value.integerValue >= 0 && value.integerValue <= 2147483647 ? value.integerValue : null;
  }
  if (indicator.valueType === "CURRENCY") {
    return value.integerValue === null && value.textValue === null && value.decimalValue !== null
      && Number.isFinite(value.decimalValue) && value.decimalValue >= 0 && value.decimalValue <= 999999999999.99
      && Number(value.decimalValue.toFixed(2)) === value.decimalValue ? value.decimalValue : null;
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
    const numeric = values.filter((value): value is number => typeof value === "number");
    const sum = numeric.length ? numeric.reduce((total, value) => total + value, 0) : null;
    return {
      ...indicator,
      validCount: values.length,
      missingCount: submitted.length - values.length,
      sum,
      mean: sum === null ? null : sum / numeric.length,
      distribution: indicator.valueType === "ENUM" ? indicator.allowedValues.map((value) => ({
        value, count: values.filter((current) => current === value).length,
      })) : [],
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
