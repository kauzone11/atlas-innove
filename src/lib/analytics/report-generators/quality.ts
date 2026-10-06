import { getDataQuality } from "@/lib/analytics/read-model";
import type { AnalyticsReportPayload } from "@/lib/analytics/report-schemas";
import type { ReportGeneratorContext } from "@/lib/analytics/report-generators/shared";

export async function generateDataQualityReport(context: ReportGeneratorContext): Promise<Extract<AnalyticsReportPayload, { type: "DATA_QUALITY" }>> {
  const quality = await getDataQuality(context.access, context.filters, context.client);
  return { ...context.base, type: "DATA_QUALITY", quality };
}
