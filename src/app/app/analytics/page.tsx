import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getAnalyticsAccess, queryValue, readAnalytics, type AnalyticsSearchParams } from "@/components/analytics/access";
import { AnalyticsNavigation } from "@/components/analytics/navigation";
import { AnalyticsFeedback } from "@/components/analytics/presentation";
import { PortfolioView } from "@/components/analytics/views";
import { ScopeFilters, ExportButton } from "@/components/analytics/filters";
import { getAnalyticsChoices, getPortfolioAnalytics } from "@/lib/analytics/read-model";
import type { AnalyticsFilters } from "@/lib/analytics/types";

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<AnalyticsSearchParams> }) {
  const { access, canAnalyze, context } = await getAnalyticsAccess();
  const parameters = await searchParams;
  const filters: AnalyticsFilters = { programId: queryValue(parameters, "programId") || undefined, callId: queryValue(parameters, "callId") || undefined, cohortId: queryValue(parameters, "cohortId") || undefined, metricId: queryValue(parameters, "metricId") || undefined, year: queryValue(parameters, "year") ? Number(queryValue(parameters, "year")) : undefined };
  const [choices, result] = await Promise.all([getAnalyticsChoices(access), readAnalytics(() => getPortfolioAnalytics(access, filters))]);
  const reportQuery = new URLSearchParams({ type: "PORTFOLIO_EXECUTIVE", ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)])) });
  return <div className="min-w-0 space-y-6"><PageHeader title="Análises do portfólio" description={`${context.organization.name} · Evidências da seleção, execução e acompanhamento.`} action={canAnalyze && result.data ? <Link href={`/app/analytics/reports?${reportQuery}`} className="button-primary">Preparar relatório deste recorte</Link> : undefined} /><AnalyticsNavigation current="/app/analytics" canConfigure={canAnalyze} /><AnalyticsFeedback error={queryValue(parameters, "error") || result.error} /><ScopeFilters choices={choices} filters={filters} action="/app/analytics" />{result.data ? <PortfolioView data={result.data} canAnalyze={canAnalyze} /> : null}{canAnalyze && result.data ? <div className="flex flex-wrap gap-2"><ExportButton organizationId={access.organizationId} type={filters.cohortId ? "COHORT_AGGREGATES" : "PORTFOLIO_SUMMARY"} {...filters} label={filters.cohortId ? "Exportar resumo da coorte" : "Exportar resumo do portfólio"} /><Link href="/app/analytics/compare" className="button-secondary">Comparar coortes</Link></div> : null}</div>;
}
