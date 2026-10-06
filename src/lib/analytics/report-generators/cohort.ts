import { getCohortAnalytics } from "@/lib/analytics/read-model";
import type { AnalyticsReportPayload } from "@/lib/analytics/report-schemas";
import type { ReportGeneratorContext } from "@/lib/analytics/report-generators/shared";

export async function generateCohortLongitudinal(context: ReportGeneratorContext): Promise<Extract<AnalyticsReportPayload, { type: "COHORT_LONGITUDINAL" }>> {
  const original = await getCohortAnalytics(context.access, context.input.cohortId!, context.client);
  const cohort = context.input.metricId ? { ...original, waves: original.waves.map((wave) => ({ ...wave, metrics: wave.metrics.filter((metric) => metric.metricId === context.input.metricId) })), paired: original.paired.filter((metric) => metric.metricId === context.input.metricId) } : original;
  return { ...context.base, type: "COHORT_LONGITUDINAL", cohort };
}
