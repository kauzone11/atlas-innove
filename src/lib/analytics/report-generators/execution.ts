import { getExecutionAnalytics } from "@/lib/analytics/read-model";
import type { AnalyticsReportPayload } from "@/lib/analytics/report-schemas";
import type { ReportGeneratorContext } from "@/lib/analytics/report-generators/shared";

export async function generateExecutionSummary(context: ReportGeneratorContext): Promise<Extract<AnalyticsReportPayload, { type: "EXECUTION_SUMMARY" }>> {
  const summary = await getExecutionAnalytics(context.access, context.filters, context.client);
  return { ...context.base, type: "EXECUTION_SUMMARY", ...summary };
}
