export type { AnalyticsAccess } from "@/lib/analytics/access";
export type NumericValue = number | string | null;
export type MetricInput = {
  id: string; key: string; label: string; valueType: "INTEGER" | "CURRENCY" | "ENUM";
  unit: string | null; allowedValues: string[]; primaryAggregation: "TOTAL" | "MEAN" | "MEDIAN" | "DISTRIBUTION";
};
export type MetricAggregate = Omit<MetricInput, "id" | "allowedValues"> & {
  metricId: string; validCount: number; missingCount: number;
  sum: NumericValue; mean: NumericValue; median: NumericValue; minimum: NumericValue; maximum: NumericValue;
  distribution: { value: string; count: number }[];
};
export type AnalyticsCoverage = {
  expected: number; submitted: number; pending: number; inProgress: number; missed: number;
  notEligible: number; withdrawn: number; percentage: number | null;
};
export type WaveAnalytics = {
  id: string; name: string; offsetMonths: number | null; sequence: number; status: string; referenceAt: string;
  coverage: AnalyticsCoverage; metrics: MetricAggregate[];
};
export type PairedMetric = {
  metricId: string; label: string; valueType: "INTEGER" | "CURRENCY"; unit: string | null;
  baselineWaveId: string; followUpWaveId: string; pairedCount: number;
  baselineAggregate: MetricAggregate; followUpAggregate: MetricAggregate;
  meanAbsoluteChange: NumericValue; medianAbsoluteChange: NumericValue;
};
export type CohortAnalytics = {
  id: string; name: string; programId: string; programName: string; callId: string | null;
  protocol: { id: string; name: string; version: number } | null; enrollmentCount: number;
  waves: WaveAnalytics[]; paired: PairedMetric[];
  quality: { unmappedIndicators: number; missingOffsets: number; ambiguousOffsets: number[] };
};
export type AnalyticsFilters = { programId?: string; callId?: string; cohortId?: string; year?: number; metricId?: string };
export type AnalyticsScope = { programId: string | null; callId: string | null; cohortId: string | null; year: number | null; metricId: string | null };
export type ExecutionAnalytics = {
  awards: number; byStatus: { status: string; count: number }[];
  financial: { approved: string | null; planned: string | null; paid: string | null; approvedCount: number; plannedCount: number; paidCount: number };
  requiredObligations: number; approvedObligations: number; overdueObligations: number; pendingReviews: number;
};
export type PortfolioAnalytics = {
  scope: AnalyticsScope;
  programs: { id: string; name: string; status: string; calls: number; cohorts: number; trackedVentures: number; activeAwards: number }[];
  calls: { total: number; applicationsObserved: number; submitted: number | null; withdrawn: number | null; evaluated: number | null; selected: number | null };
  execution: ExecutionAnalytics; cohorts: CohortAnalytics[];
  monitoring: { expected: number; submitted: number }; trackedVentures: number; milestones: { type: string; count: number }[];
};
export type ProgramAnalytics = PortfolioAnalytics & { program: { id: string; name: string; status: string; description: string | null } };
export type DataQualityAnalytics = {
  scope: AnalyticsScope; cohorts: CohortAnalytics[]; unmappedIndicators: number; missingOffsets: number;
  ambiguousTimepoints: number; eligibleWithoutSubmission: number; submittedWithoutMetricValue: number; withdrawn: number;
};
