export type MetricSemantics = {
  valueType: "INTEGER" | "CURRENCY" | "ENUM";
  unit?: string | null;
  allowedValues?: readonly string[] | null;
};

export function areMetricSemanticsCompatible(indicator: MetricSemantics, metric: MetricSemantics): boolean {
  if (indicator.valueType !== metric.valueType || (indicator.unit || null) !== (metric.unit || null)) return false;
  if (indicator.valueType !== "ENUM") return true;
  const left = indicator.allowedValues ?? [];
  const right = metric.allowedValues ?? [];
  return left.length > 0 && left.length === right.length && left.every((option, position) => option === right[position]);
}

export function canChangeMetricMapping(currentId: string | null, nextId: string | null, hasObservations: boolean): boolean {
  return !hasObservations || currentId === nextId;
}
