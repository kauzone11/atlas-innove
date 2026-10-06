import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getAnalyticsAccess, queryValue, readAnalytics, type AnalyticsSearchParams } from "@/components/analytics/access";
import { AnalyticsNavigation } from "@/components/analytics/navigation";
import { AnalyticsFeedback } from "@/components/analytics/presentation";
import { QualityView } from "@/components/analytics/views";
import { ScopeFilters } from "@/components/analytics/filters";
import { getAnalyticsChoices, getDataQuality } from "@/lib/analytics/read-model";
import type { AnalyticsFilters } from "@/lib/analytics/types";

export default async function AnalyticsQualityPage({ searchParams }: { searchParams: Promise<AnalyticsSearchParams> }) {
  const { access, canAnalyze, canManage } = await getAnalyticsAccess();
  const parameters = await searchParams;
  const filters: AnalyticsFilters = { programId: queryValue(parameters, "programId") || undefined, callId: queryValue(parameters, "callId") || undefined, cohortId: queryValue(parameters, "cohortId") || undefined, metricId: queryValue(parameters, "metricId") || undefined, year: queryValue(parameters, "year") ? Number(queryValue(parameters, "year")) : undefined };
  const [choices, result] = await Promise.all([getAnalyticsChoices(access), readAnalytics(() => getDataQuality(access, filters))]);
  const reportQuery = new URLSearchParams({ type: "DATA_QUALITY", ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)])) });
  return <div className="min-w-0 space-y-6"><PageHeader title="Qualidade dos dados" description="Cobertura, completude dos valores e condições de comparabilidade." action={canManage ? <Link href="/app/analytics/metrics" className="button-secondary">Configurar métricas</Link> : undefined} /><AnalyticsNavigation current="/app/analytics/quality" canConfigure={canAnalyze} /><AnalyticsFeedback error={queryValue(parameters, "error") || result.error} /><ScopeFilters choices={choices} filters={filters} action="/app/analytics/quality" />{result.data ? <QualityView data={result.data} /> : null}{canAnalyze && result.data ? <Link href={`/app/analytics/reports?${reportQuery}`} className="button-primary">Preparar relatório de qualidade deste recorte</Link> : null}</div>;
}
