import { AnalyticsSection, AnalyticsTable, ScopeNote, formatIndicatorValue } from "@/components/analytics/presentation";
import { PortfolioView, CohortView, QualityView, ExecutionView, ApplicationsView } from "@/components/analytics/views";
import type { AnalyticsReportPayload, PublicReportPayload } from "@/lib/analytics/report-schemas";

export function ReportContent({ payload }: { payload: AnalyticsReportPayload }) {
  return <div className="space-y-6">{payload.type === "PORTFOLIO_EXECUTIVE" ? <PortfolioView data={payload.portfolio} report /> : payload.type === "PROGRAM_SUMMARY" ? <PortfolioView data={payload.program} report /> : payload.type === "COHORT_LONGITUDINAL" ? <CohortView data={payload.cohort} report /> : payload.type === "DATA_QUALITY" ? <QualityView data={payload.quality} /> : <div className="space-y-6"><ApplicationsView calls={payload.calls} /><ExecutionView execution={payload.execution} /></div>}<Methodology methodology={payload.methodology} /></div>;
}

export function Methodology({ methodology }: { methodology: AnalyticsReportPayload["methodology"] }) {
  return <section className="analytics-methodology"><h2 className="text-base font-semibold">Contexto metodológico</h2><dl className="mt-4 space-y-4"><div><dt className="text-sm font-medium">Interpretação</dt><dd className="mt-1 text-sm leading-6 text-slate">{methodology.interpretation}</dd></div><div><dt className="text-sm font-medium">Universo e elegibilidade</dt><dd className="mt-1 text-sm leading-6 text-slate">{methodology.eligibility}</dd></div><div><dt className="text-sm font-medium">Comparabilidade</dt><dd className="mt-1 text-sm leading-6 text-slate">{methodology.comparability}</dd></div></dl></section>;
}

const publicAwardLabels: Record<string, string> = { PREPARING: "Em preparação", ACTIVE: "Ativo", SUSPENDED: "Suspenso", COMPLETED: "Concluído", TERMINATED: "Encerrado", CANCELLED: "Cancelado" };
const numericalColumns = new Set(["Total", "Média", "Mediana", "Média inicial", "Média final", "Variação média absoluta", "Variação mediana absoluta", "Valor aprovado", "Valor planejado", "Valor pago"]);

function publicCell(value: string | number | null, column: string, columns: string[], row: (string | number | null)[], valueType: "INTEGER" | "CURRENCY" | "ENUM" | null) {
  if (value === null) return "Não observado";
  if (column === "Situação" && typeof value === "string") return publicAwardLabels[value] ?? value;
  if (column === "Data de referência" && typeof value === "string") return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
  const unit = row[columns.indexOf("Unidade")] ?? row[columns.indexOf("Moeda")];
  if (valueType && numericalColumns.has(column) && (typeof value === "number" || /^-?\d+(?:\.\d+)?$/.test(value))) return formatIndicatorValue(value, valueType, unit === "BRL" ? "R$" : typeof unit === "string" ? unit : null);
  return value;
}

export function PublicReportContent({ payload }: { payload: PublicReportPayload }) {
  return <div className="space-y-6"><ScopeNote>Os resultados descrevem evidências registradas e não demonstram atribuição causal. Grupos pequenos podem ser suprimidos para proteger informações individuais.</ScopeNote>{payload.sections.map((section, index) => <AnalyticsSection key={index} title={section.title}>{section.suppressed ? <p className="analytics-footer-note">Dado suprimido por proteção de grupos pequenos.</p> : section.rows.length ? <AnalyticsTable caption={section.title} headings={section.columns} rows={section.rows.map((row) => row.map((value, cellIndex) => publicCell(value, section.columns[cellIndex], section.columns, row, section.valueType)))} /> : <p className="analytics-footer-note">Não há valores observados neste recorte.</p>}</AnalyticsSection>)}<Methodology methodology={payload.methodology} /></div>;
}
