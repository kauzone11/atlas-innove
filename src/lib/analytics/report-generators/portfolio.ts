import { getPortfolioAnalytics } from "@/lib/analytics/read-model";
import type { AnalyticsReportPayload } from "@/lib/analytics/report-schemas";
import type { ReportGeneratorContext } from "@/lib/analytics/report-generators/shared";
import { DomainConflictError } from "@/lib/errors";

export async function generatePortfolioExecutive(context: ReportGeneratorContext): Promise<Extract<AnalyticsReportPayload, { type: "PORTFOLIO_EXECUTIVE" }>> {
  const portfolio = await getPortfolioAnalytics(context.access, context.filters, context.client);
  const metricIds = new Set(portfolio.cohorts.flatMap((cohort) => cohort.waves.flatMap((wave) => wave.metrics.map((metric) => metric.metricId))));
  if (metricIds.size > 5) throw new DomainConflictError("ANALYTICS_EXECUTIVE_METRIC_LIMIT");
  return { ...context.base, type: "PORTFOLIO_EXECUTIVE", portfolio };
}
