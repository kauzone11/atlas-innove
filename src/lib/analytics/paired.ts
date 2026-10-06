import { aggregateMetric, ExactDecimal } from "@/lib/analytics/aggregates";
import type { MetricInput, PairedMetric } from "@/lib/analytics/types";

export type PairedValue = { enrollmentId: string; value: number | string | null };

export function pairedMetric(metric: MetricInput, baselineWaveId: string, followUpWaveId: string, baseline: PairedValue[], followUp: PairedValue[]): PairedMetric | null {
  if (metric.valueType === "ENUM") return null;
  const validMap = (rows: PairedValue[]) => {
    const map = new Map<string, number | string>();
    const counts = new Map<string, number>();
    for (const row of rows) {
      counts.set(row.enrollmentId, (counts.get(row.enrollmentId) ?? 0) + 1);
      if (row.value !== null) map.set(row.enrollmentId, row.value);
    }
    for (const [id, count] of counts) if (count !== 1) map.delete(id);
    return map;
  };
  const first = validMap(baseline); const second = validMap(followUp);
  const ids = [...first.keys()].filter((id) => second.has(id)).sort();
  const before = ids.map((id) => first.get(id)!); const after = ids.map((id) => second.get(id)!);
  const changes = ids.map((id) => {
    const change = new ExactDecimal(second.get(id)!).sub(first.get(id)!);
    return metric.valueType === "CURRENCY" ? change.toString() : change.toNumber();
  });
  const changeAggregate = aggregateMetric(metric, changes);
  return {
    metricId: metric.id, label: metric.label, valueType: metric.valueType, unit: metric.unit,
    baselineWaveId, followUpWaveId, pairedCount: ids.length,
    baselineAggregate: aggregateMetric(metric, before), followUpAggregate: aggregateMetric(metric, after),
    meanAbsoluteChange: changeAggregate.mean, medianAbsoluteChange: changeAggregate.median,
  };
}
