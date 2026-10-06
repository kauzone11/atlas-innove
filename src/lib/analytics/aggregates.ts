import { Prisma } from "@prisma/client";
import { DomainConflictError } from "@/lib/errors";
import type { MetricAggregate, MetricInput, NumericValue } from "@/lib/analytics/types";

// Fifty digits preserve bounded monetary sums and deterministic division without binary floating point.
export const ExactDecimal = Prisma.Decimal.clone({ precision: 50, toExpNeg: -100, toExpPos: 100 });

export function aggregateMetric(metric: MetricInput, values: (number | string | null)[], submittedCount = values.length): MetricAggregate {
  const valid = values.filter((value): value is number | string => value !== null);
  const base: MetricAggregate = {
    metricId: metric.id, key: metric.key, label: metric.label, valueType: metric.valueType,
    unit: metric.unit, primaryAggregation: metric.primaryAggregation,
    validCount: valid.length, missingCount: submittedCount - valid.length,
    sum: null, mean: null, median: null, minimum: null, maximum: null, distribution: [],
  };
  if (submittedCount < valid.length) throw new DomainConflictError("ANALYTICS_DENOMINATOR_INVALID");
  if (metric.valueType === "ENUM") return { ...base, distribution: metric.allowedValues.map((value) => ({ value, count: valid.filter((current) => current === value).length })) };
  if (!valid.length) return base;
  const numeric = valid.map((value) => new ExactDecimal(value)).sort((a, b) => a.comparedTo(b));
  const sum = numeric.reduce((total, value) => total.add(value), new ExactDecimal(0));
  if (metric.valueType === "INTEGER" && !sum.isInteger()) throw new DomainConflictError("ANALYTICS_INTEGER_INVALID");
  if (metric.valueType === "INTEGER" && sum.abs().greaterThan(Number.MAX_SAFE_INTEGER)) throw new DomainConflictError("ANALYTICS_INTEGER_OVERFLOW");
  const middle = Math.floor(numeric.length / 2);
  const median = numeric.length % 2 ? numeric[middle] : numeric[middle - 1].add(numeric[middle]).div(2);
  const serialize = (value: Prisma.Decimal): NumericValue => metric.valueType === "CURRENCY" ? value.toString() : value.toNumber();
  return { ...base, sum: serialize(sum), mean: serialize(sum.div(numeric.length)), median: serialize(median), minimum: serialize(numeric[0]), maximum: serialize(numeric[numeric.length - 1]) };
}

export function primaryAggregate(aggregate: MetricAggregate): NumericValue {
  return ({ TOTAL: aggregate.sum, MEAN: aggregate.mean, MEDIAN: aggregate.median, DISTRIBUTION: null })[aggregate.primaryAggregation];
}
