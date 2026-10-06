import Link from "next/link";
import { Download } from "lucide-react";
import type { AnalyticsFilters } from "@/lib/analytics/types";

export type AnalyticsChoices = {
  programs: { id: string; name: string }[];
  calls: { id: string; title: string; programId: string }[];
  cohorts: { id: string; name: string; programId: string; callId: string | null }[];
  metrics: { id: string; label: string }[];
  offsetMonths: number[];
};

export function ScopeFields({ choices, filters, requireProgram = false, requireCohort = false, includeMetric = true }: { choices: AnalyticsChoices; filters: AnalyticsFilters; requireProgram?: boolean; requireCohort?: boolean; includeMetric?: boolean }) {
  return <>
    <label>Programa<select className="field-control" name="programId" defaultValue={filters.programId ?? ""} required={requireProgram}><option value="">{requireProgram ? "Selecione um programa" : "Todos os programas"}</option>{choices.programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select></label>
    <label>Edital<select className="field-control" name="callId" defaultValue={filters.callId ?? ""}><option value="">Todos os editais</option>{choices.calls.filter((call) => !filters.programId || call.programId === filters.programId).map((call) => <option key={call.id} value={call.id}>{call.title}</option>)}</select></label>
    <label>Coorte<select className="field-control" name="cohortId" defaultValue={filters.cohortId ?? ""} required={requireCohort}><option value="">{requireCohort ? "Selecione uma coorte" : "Todas as coortes"}</option>{choices.cohorts.filter((cohort) => (!filters.programId || cohort.programId === filters.programId) && (!filters.callId || cohort.callId === filters.callId)).map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}</select></label>
    {includeMetric ? <label>Métrica<select className="field-control" name="metricId" defaultValue={filters.metricId ?? ""}><option value="">Todas as métricas</option>{choices.metrics.map((metric) => <option key={metric.id} value={metric.id}>{metric.label}</option>)}</select></label> : filters.metricId ? <input type="hidden" name="metricId" value={filters.metricId} /> : null}
    <label>Ano do edital<input className="field-control" name="year" type="number" min="1900" max="2200" step="1" defaultValue={Number.isFinite(filters.year) ? filters.year : undefined} placeholder="Todos" /></label>
  </>;
}

export function ScopeFilters({ choices, filters, action }: { choices: AnalyticsChoices; filters: AnalyticsFilters; action: string }) {
  return <details className="analytics-filters" open><summary>Recorte da análise</summary><form action={action} method="get" className="analytics-filter-fields"><ScopeFields choices={choices} filters={filters} /><div className="flex flex-wrap items-end gap-2"><button className="button-primary" type="submit">Aplicar recorte</button><Link href={action} className="button-secondary">Limpar</Link></div></form><p className="mt-3 text-xs leading-5 text-slate">O ano utiliza datas estruturadas do edital. As ondas mantêm sua data de referência e não são filtradas pela data de criação da observação.</p></details>;
}

export function ExportButton({ organizationId, type, programId, callId, cohortId, year, metricId, label }: { organizationId: string; type: "COHORT_OBSERVATIONS" | "COHORT_AGGREGATES" | "PROGRAM_SUMMARY" | "EXECUTION_SUMMARY" | "APPLICATIONS_SUMMARY" | "PORTFOLIO_SUMMARY"; programId?: string; callId?: string; cohortId?: string; metricId?: string; year?: number; label: string }) {
  return <form action={`/api/organizations/${organizationId}/analytics/exports`} method="post"><input type="hidden" name="type" value={type} />{programId ? <input type="hidden" name="programId" value={programId} /> : null}{callId ? <input type="hidden" name="callId" value={callId} /> : null}{cohortId ? <input type="hidden" name="cohortId" value={cohortId} /> : null}{metricId ? <input type="hidden" name="metricId" value={metricId} /> : null}{year !== undefined ? <input type="hidden" name="year" value={year} /> : null}<button type="submit" className="button-secondary"><Download size={16} aria-hidden="true" />{label}</button></form>;
}
