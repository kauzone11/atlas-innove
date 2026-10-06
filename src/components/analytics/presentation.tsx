import type { ReactNode } from "react";
import Link from "next/link";
import { Info } from "lucide-react";

import { Panel, PanelHeader } from "@/components/ui";
import { formatIndicatorValue, formatMonitoringDate } from "@/lib/monitoring/format";

export const aggregationLabels = { TOTAL: "Total", MEAN: "Média", MEDIAN: "Mediana", DISTRIBUTION: "Distribuição" } as const;
export const reportTypeLabels = {
  PORTFOLIO_EXECUTIVE: "Visão executiva do portfólio",
  PROGRAM_SUMMARY: "Síntese do programa",
  COHORT_LONGITUDINAL: "Evolução longitudinal da coorte",
  DATA_QUALITY: "Qualidade dos dados",
  EXECUTION_SUMMARY: "Síntese da execução",
} as const;

export function reportScopeLabel(scope: { organizationName: string; programName: string | null; cohortName: string | null; callName?: string | null; year?: number | null }) {
  return [scope.programName ?? scope.organizationName, scope.callName, scope.cohortName, scope.year ? `Ano do edital: ${scope.year}` : null].filter(Boolean).join(" · ");
}

export function publicScopeLabel(scope: { program: string | null; cohort: string | null; call?: string | null; year?: number | null }) {
  return [scope.program, scope.call, scope.cohort, scope.year ? `Ano do edital: ${scope.year}` : null].filter(Boolean).join(" · ") || "Portfólio institucional";
}

export function formatAnalyticsDateTime(value: string | null): string {
  return value ? `${new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Fortaleza" }).format(new Date(value))} (Fortaleza)` : "Sem data definida";
}

type Coverage = { expected: number; submitted: number; pending: number; inProgress: number; missed: number; notEligible?: number; withdrawn?: number; percentage?: number | null };
type Aggregate = {
  label: string; valueType: string; unit: string | null; primaryAggregation: keyof typeof aggregationLabels;
  validCount: number; missingCount: number; sum: number | string | null; mean: number | string | null;
  median: number | string | null; distribution: { value: string; count: number }[];
};

export function primaryValue(aggregate: Aggregate) {
  if (!aggregate.validCount) return "Sem valores válidos";
  if (aggregate.primaryAggregation === "DISTRIBUTION") return aggregate.distribution.filter((item) => item.count > 0).map((item) => `${item.value}: ${item.count}`).join(" · ");
  const value = aggregate.primaryAggregation === "TOTAL" ? aggregate.sum : aggregate.primaryAggregation === "MEDIAN" ? aggregate.median : aggregate.mean;
  return formatIndicatorValue(value, aggregate.valueType, aggregate.unit);
}

export function ScopeNote({ children }: { children?: ReactNode }) {
  return <aside className="analytics-note"><Info size={16} className="shrink-0" aria-hidden="true" /><p>{children ?? "Os resultados descrevem evidências registradas e não demonstram atribuição causal ao programa. Apenas observações enviadas contribuem para os resultados."}</p></aside>;
}

export function AnalyticsEmpty({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="analytics-empty"><h3>{title}</h3><p>{description}</p>{action ? <div className="mt-4">{action}</div> : null}</div>;
}

export function SummaryStrip({ items }: { items: { label: string; value: ReactNode; detail?: string }[] }) {
  return <dl className="analytics-summary">{items.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd>{item.detail ? <p>{item.detail}</p> : null}</div>)}</dl>;
}

export function CoverageSummary({ coverage }: { coverage: Coverage }) {
  return <div className="analytics-coverage"><p className="text-sm"><strong className="tabular-nums">{coverage.submitted} de {coverage.expected}</strong> observações esperadas enviadas</p>{coverage.expected ? <div className="analytics-coverage-track" aria-hidden="true"><span style={{ width: `${Math.min(100, coverage.submitted / coverage.expected * 100)}%` }} /></div> : null}<p className="text-xs leading-5 text-slate">{coverage.pending} pendentes · {coverage.inProgress} em andamento · {coverage.missed} não respondidas{coverage.notEligible ? ` · ${coverage.notEligible} fora do universo elegível` : ""}{coverage.withdrawn ? ` · ${coverage.withdrawn} desligamentos registrados` : ""}</p></div>;
}

export function MetricResult({ aggregate, evidenceHref, missingHref }: { aggregate: Aggregate; evidenceHref?: string; missingHref?: string }) {
  return <div className="analytics-metric-result"><div><h3 className="font-medium">{aggregate.label}</h3><p className="mt-1 text-xs text-slate">{aggregationLabels[aggregate.primaryAggregation]} dos valores válidos</p></div><div><p className="font-semibold tabular-nums">{primaryValue(aggregate)}</p><p className="mt-1 text-xs text-slate">n = {aggregate.validCount} valores válidos · {aggregate.missingCount} ausentes entre as observações enviadas</p>{aggregate.primaryAggregation === "DISTRIBUTION" && aggregate.validCount ? <p className="mt-1 text-xs text-slate">Cada categoria usa {aggregate.validCount} valores válidos como denominador.</p> : null}{evidenceHref || missingHref ? <div className="mt-2 flex flex-wrap gap-x-4">{evidenceHref ? <Link href={evidenceHref} className="analytics-link">Ver composição</Link> : null}{missingHref ? <Link href={missingHref} className="analytics-link">Consultar valores ausentes</Link> : null}</div> : null}</div></div>;
}

export function AnalyticsSection({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return <Panel className="analytics-section"><PanelHeader title={title} description={description} action={action} />{children}</Panel>;
}

export function AnalyticsTable({ caption, headings, rows }: { caption: string; headings: string[]; rows: ReactNode[][] }) {
  return <div className="analytics-table-wrap"><table className="analytics-table"><caption>{caption}</caption><thead><tr>{headings.map((heading) => <th scope="col" key={heading}>{heading}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} data-label={headings[cellIndex]}><div className="analytics-cell-value">{cell}</div></td>)}</tr>)}</tbody></table></div>;
}

export function Timepoint({ offsetMonths, name }: { offsetMonths: number | null; name: string }) {
  return <>{name}<span className="mt-1 block text-xs text-slate">{offsetMonths === null ? "Sem mês de referência comparável" : offsetMonths === 0 ? "0 meses · baseline" : `${offsetMonths} meses`}</span></>;
}

export function AnalyticsFeedback({ error, success }: { error?: string; success?: string }) {
  const errors: Record<string, string> = { executive: "Selecione uma métrica para manter a visão executiva concisa. Este tipo de relatório comporta até cinco métricas canônicas.", permission: "Seu vínculo permite consultar análises. Esta ação exige uma permissão adicional.", invalid: "Confira o tipo, o escopo e os parâmetros informados antes de continuar.", scope: "O escopo solicitado não está disponível nesta organização.", preview: "A prévia mudou. Revise a versão atual antes de confirmar a publicação.", failed: "Não foi possível concluir a ação. Confira os dados e tente novamente.", limit: "Este recorte excede o limite permitido. Selecione um escopo menor.", conflict: "Este endereço já está em uso. Informe outro endereço para a publicação." };
  const successes: Record<string, string> = { generated: "Relatório gerado. Este recorte da evidência está preservado.", archived: "Relatório arquivado. O histórico permanece preservado.", published: "Resultados publicados com o conteúdo apresentado na prévia.", unpublished: "Publicação retirada. O relatório interno permanece preservado.", settings: "Regra de proteção dos resultados públicos atualizada." };
  if (error) return <p role="alert" className="rounded-lg border border-line bg-warning-soft px-4 py-3 text-sm text-warning">{errors[error] ?? errors.failed}</p>;
  if (success) return <p role="status" className="rounded-lg border border-line bg-success-soft px-4 py-3 text-sm text-success">{successes[success] ?? "Ação concluída."}</p>;
  return null;
}

export { formatIndicatorValue, formatMonitoringDate };
