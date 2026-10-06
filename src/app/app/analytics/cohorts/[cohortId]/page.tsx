import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs, PageHeader } from "@/components/ui";
import { getAnalyticsAccess, queryValue, type AnalyticsSearchParams } from "@/components/analytics/access";
import { AnalyticsNavigation } from "@/components/analytics/navigation";
import { CohortView } from "@/components/analytics/views";
import { ExportButton } from "@/components/analytics/filters";
import { getCohortAnalytics, getPairedCohortAnalysis } from "@/lib/analytics/read-model";
import { ResourceNotFoundError } from "@/lib/errors";

export default async function CohortAnalyticsPage({ params, searchParams }: { params: Promise<{ cohortId: string }>; searchParams: Promise<AnalyticsSearchParams> }) {
  const { access, canAnalyze, canManage } = await getAnalyticsAccess();
  const { cohortId } = await params;
  let data = await getCohortAnalytics(access, cohortId).catch((error: unknown) => { if (error instanceof ResourceNotFoundError) notFound(); throw error; });
  if (!data) notFound();
  const parameters = await searchParams;
  const fromWaveId = queryValue(parameters, "fromWaveId");
  const toWaveId = queryValue(parameters, "toWaveId");
  const pairRequested = Boolean(fromWaveId || toWaveId);
  const validPair = fromWaveId && toWaveId && fromWaveId !== toWaveId && data.waves.some((wave) => wave.id === fromWaveId) && data.waves.some((wave) => wave.id === toWaveId);
  if (validPair) data = await getPairedCohortAnalysis(access, cohortId, fromWaveId, toWaveId);
  else if (pairRequested) data = { ...data, paired: [] };
  return <div className="min-w-0 space-y-6"><PageHeader title={data.name} description={`${data.programName} · Resultados observados ao longo do acompanhamento.`} breadcrumbs={<Breadcrumbs items={[{ label: "Análises", href: "/app/analytics" }, { label: data.programName, href: `/app/analytics/programs/${data.programId}` }, { label: data.name }]} />} action={<Link href={`/app/programs/${data.programId}/cohorts/${cohortId}`} className="button-secondary">Abrir coorte</Link>} /><AnalyticsNavigation current="/app/analytics" canConfigure={canAnalyze} />{data.waves.length >= 2 ? <form action={`/app/analytics/cohorts/${cohortId}`} method="get" className="analytics-filters"><h2 className="text-sm font-semibold">Momentos da comparação pareada</h2><div className="analytics-filter-fields mt-3"><label>Primeiro momento<select className="field-control" name="fromWaveId" defaultValue={fromWaveId} required><option value="">Selecione uma onda</option>{data.waves.map((wave) => <option key={wave.id} value={wave.id}>{wave.name}{wave.offsetMonths === null ? "" : ` · ${wave.offsetMonths} meses`}</option>)}</select></label><label>Segundo momento<select className="field-control" name="toWaveId" defaultValue={toWaveId} required><option value="">Selecione uma onda</option>{data.waves.map((wave) => <option key={wave.id} value={wave.id}>{wave.name}{wave.offsetMonths === null ? "" : ` · ${wave.offsetMonths} meses`}</option>)}</select></label><div className="flex flex-wrap items-end gap-2"><button type="submit" className="button-primary">Comparar estes momentos</button><Link href={`/app/analytics/cohorts/${cohortId}`} className="button-secondary">Usar baseline</Link></div></div><p className="mt-3 text-xs text-slate">Sem seleção explícita, a comparação utiliza a baseline e os demais momentos da coorte.</p></form> : null}{pairRequested && !validPair ? <p role="alert" className="analytics-note text-warning">Selecione duas ondas distintas desta coorte. Nenhuma comparação pareada foi calculada para a seleção inválida.</p> : null}<CohortView data={data} canAnalyze={canAnalyze} canManage={canManage} />{canAnalyze ? <div className="flex flex-wrap gap-2"><Link href={`/app/analytics/reports?${new URLSearchParams({ type: "COHORT_LONGITUDINAL", cohortId })}`} className="button-primary">{validPair ? "Preparar relatório com baseline" : "Preparar relatório longitudinal"}</Link><ExportButton organizationId={access.organizationId} type="COHORT_AGGREGATES" cohortId={cohortId} label="Exportar resumo da coorte" /><ExportButton organizationId={access.organizationId} type="COHORT_OBSERVATIONS" cohortId={cohortId} label="Exportar observações" /></div> : null}</div>;
}
