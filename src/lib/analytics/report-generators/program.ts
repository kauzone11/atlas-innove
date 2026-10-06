import { getPortfolioAnalytics } from "@/lib/analytics/read-model";
import { ResourceNotFoundError } from "@/lib/errors";
import type { AnalyticsReportPayload } from "@/lib/analytics/report-schemas";
import type { ReportGeneratorContext } from "@/lib/analytics/report-generators/shared";

export async function generateProgramSummary(context: ReportGeneratorContext): Promise<Extract<AnalyticsReportPayload, { type: "PROGRAM_SUMMARY" }>> {
  const metadata = await context.client.fundingProgram.findFirst({ where: { organizationId: context.access.organizationId, id: context.filters.programId }, select: { id: true, name: true, status: true, description: true } });
  if (!metadata) throw new ResourceNotFoundError("FUNDING_PROGRAM_NOT_FOUND");
  const program = { ...await getPortfolioAnalytics(context.access, context.filters, context.client), program: metadata };
  return { ...context.base, type: "PROGRAM_SUMMARY", program };
}
