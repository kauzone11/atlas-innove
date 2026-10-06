import Link from "next/link";
import { notFound } from "next/navigation";
import { getAnalyticsAccess } from "@/components/analytics/access";
import { PrintButton } from "@/components/analytics/print-button";
import { ReportContent } from "@/components/analytics/report-content";
import { reportTypeLabels, reportScopeLabel, formatAnalyticsDateTime } from "@/components/analytics/presentation";
import { getAnalyticsReport } from "@/lib/analytics/reports";
import { ResourceNotFoundError } from "@/lib/errors";

export default async function PrintAnalyticsReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { access } = await getAnalyticsAccess();
  const { reportId } = await params;
  const report = await getAnalyticsReport(access, reportId).catch((error: unknown) => { if (error instanceof ResourceNotFoundError) notFound(); throw error; });
  return <div className="analytics-print"><div className="analytics-print-controls"><Link href={`/app/analytics/reports/${reportId}`} className="button-secondary">Voltar ao relatório</Link><PrintButton /></div><article><header className="analytics-print-header"><p className="text-sm font-semibold">Atlas Innove · {report.payload.scope.organizationName}</p><p className="mt-5 text-xs text-slate">{reportTypeLabels[report.type]}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{report.title}</h1><p className="mt-3 text-sm text-slate">{reportScopeLabel(report.payload.scope)}</p><dl className="mt-5 grid gap-3 text-xs sm:grid-cols-3"><div><dt className="text-slate">Gerado em</dt><dd>{formatAnalyticsDateTime(report.generatedAt)}</dd></div><div><dt className="text-slate">Dados disponíveis em</dt><dd>{formatAnalyticsDateTime(report.dataAsOf)}</dd></div><div><dt className="text-slate">Gerado por</dt><dd>{report.generatedBy.name}</dd></div></dl></header><ReportContent payload={report.payload} /><footer className="analytics-print-footer"><p>Relatório institucional preservado · Estrutura analítica {report.analyticsSchemaVersion}</p><p className="mt-2 break-all">Referência de origem: {report.sourceDigest}</p></footer></article></div>;
}
