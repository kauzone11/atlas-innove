import { createHash } from "node:crypto";
import { analyticsReportPayloadSchema, publicReportPayloadSchema, type AnalyticsReportPayload, type PublicReportPayload } from "@/lib/analytics/report-schemas";

type Section = PublicReportPayload["sections"][number];
type Cohort = Extract<AnalyticsReportPayload, { type: "COHORT_LONGITUDINAL" }>["cohort"];
type Execution = Extract<AnalyticsReportPayload, { type: "EXECUTION_SUMMARY" }>["execution"];
type Calls = Extract<AnalyticsReportPayload, { type: "EXECUTION_SUMMARY" }>["calls"];
const isSmall = (count: number | null, minimum: number) => count !== null && count > 0 && count < minimum;
const hasSmallComplement = (counts: (number | null)[], minimum: number) => counts.some((count) => count !== null && counts.some((other) => other !== null && isSmall(Math.abs(count - other), minimum)));

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
}

export function publicPayloadDigest(payload: PublicReportPayload): string {
  return createHash("sha256").update(canonicalJson(publicReportPayloadSchema.parse(payload))).digest("hex");
}

function callSections(calls: Calls, minimum: number): Section[] {
  const counts = [calls.applicationsObserved, calls.submitted, calls.withdrawn, calls.evaluated, calls.selected];
  const applicationCounts = [calls.submitted, calls.withdrawn, calls.evaluated, calls.selected];
  const unselected = calls.submitted !== null && calls.withdrawn !== null && calls.selected !== null ? calls.submitted - calls.withdrawn - calls.selected : null;
  const suppressed = counts.some((count) => isSmall(count, minimum)) || hasSmallComplement(applicationCounts, minimum) || isSmall(unselected, minimum);
  return [{ title: "Seleção registrada", valueType: null, columns: ["Editais com candidaturas observadas", "Submetidas", "Retiradas", "Avaliadas", "Selecionadas"], rows: suppressed ? [] : [counts], suppressed }];
}

function executionSections(execution: Execution, minimum: number): Section[] {
  const counts = [execution.awards, execution.requiredObligations, execution.approvedObligations, execution.overdueObligations, execution.pendingReviews, ...execution.byStatus.map((entry) => entry.count)];
  const obligationCounts = [execution.requiredObligations, execution.approvedObligations, execution.overdueObligations, execution.pendingReviews];
  const otherObligations = execution.requiredObligations - execution.approvedObligations - execution.overdueObligations - execution.pendingReviews;
  const suppressed = counts.some((count) => isSmall(count, minimum)) || hasSmallComplement(obligationCounts, minimum) || isSmall(otherObligations, minimum);
  const financial = execution.financial;
  const financialCounts = [financial.approvedCount, financial.plannedCount, financial.paidCount];
  const financialSuppressed = financialCounts.some((count) => isSmall(count, minimum)) || financialCounts.some((count) => financialCounts.some((other) => isSmall(Math.abs(count - other), minimum)));
  const statusLabels: Record<string, string> = { PREPARING: "Em preparação", ACTIVE: "Ativo", SUSPENDED: "Suspenso", COMPLETED: "Concluído", TERMINATED: "Encerrado", CANCELLED: "Cancelado" };
  return [
    { title: "Execução institucional", valueType: null, columns: ["Apoios", "Obrigações obrigatórias", "Aprovadas", "Em atraso", "Análises pendentes"], rows: suppressed ? [] : [[execution.awards, execution.requiredObligations, execution.approvedObligations, execution.overdueObligations, execution.pendingReviews]], suppressed },
    { title: "Situação dos apoios", valueType: null, columns: ["Situação", "n"], rows: suppressed ? [] : execution.byStatus.map((entry) => [statusLabels[entry.status] ?? "Outra situação", entry.count]), suppressed },
    { title: "Apoio financeiro agregado", valueType: "CURRENCY", columns: ["Valor aprovado", "n projetos com valor aprovado", "Valor planejado", "n projetos com valor planejado", "Valor pago", "n projetos com valor pago", "Moeda"], rows: financialSuppressed ? [] : [[financial.approved, financial.approvedCount, financial.planned, financial.plannedCount, financial.paid, financial.paidCount, "BRL"]], suppressed: financialSuppressed },
  ];
}

function cohortSections(cohort: Cohort, minimum: number): Section[] {
  const result: Section[] = [];
  for (const wave of cohort.waves) {
    const context = `${cohort.name} · ${wave.name}${wave.offsetMonths === null ? " · mês de referência não definido" : ` · ${wave.offsetMonths} meses`}`;
    const coverageCounts = [wave.coverage.expected, wave.coverage.submitted, wave.coverage.pending, wave.coverage.inProgress, wave.coverage.missed, wave.coverage.notEligible, wave.coverage.withdrawn];
    const smallCohort = cohort.enrollmentCount < minimum;
    const coverageSuppressed = smallCohort || coverageCounts.some((count) => isSmall(count, minimum));
    result.push({ title: `${context} · cobertura`, valueType: null, columns: ["Esperadas", "Submetidas", "Pendentes", "Em andamento", "Não respondidas", "Não elegíveis", "Retiradas", "Cobertura (%)", "Data de referência"], rows: coverageSuppressed ? [] : [[...coverageCounts, wave.coverage.percentage, wave.referenceAt]], suppressed: coverageSuppressed });
    for (const metric of wave.metrics) {
      const suppressed = smallCohort || metric.validCount < minimum || isSmall(metric.missingCount, minimum) || metric.distribution.some((category) => isSmall(category.count, minimum));
      result.push({
        title: `${context} · ${metric.label}`,
        valueType: metric.valueType,
        columns: metric.valueType === "ENUM" ? ["Categoria", "n", "n válido", "Ausentes", "Unidade"] : ["n válido", "Ausentes", "Total", "Média", "Mediana", "Unidade"],
        rows: suppressed ? [] : metric.valueType === "ENUM" ? metric.distribution.map((category) => [category.value, category.count, metric.validCount, metric.missingCount, metric.unit]) : [[metric.validCount, metric.missingCount, metric.sum, metric.mean, metric.median, metric.unit]],
        suppressed,
      });
    }
  }
  for (const paired of cohort.paired) {
    const baseline = cohort.waves.find((wave) => wave.id === paired.baselineWaveId);
    const followUp = cohort.waves.find((wave) => wave.id === paired.followUpWaveId);
    const baselineSource = baseline?.metrics.find((metric) => metric.metricId === paired.metricId);
    const followUpSource = followUp?.metrics.find((metric) => metric.metricId === paired.metricId);
    const excludedCounts = [baselineSource, followUpSource].map((metric) => metric ? metric.validCount - paired.pairedCount : null);
    const suppressed = cohort.enrollmentCount < minimum || paired.pairedCount < minimum || excludedCounts.some((count) => count === null || count < 0 || isSmall(count, minimum)) || [paired.baselineAggregate.missingCount, paired.followUpAggregate.missingCount].some((count) => isSmall(count, minimum));
    result.push({ title: `${cohort.name} · variação pareada de ${paired.label}`, valueType: paired.valueType, columns: ["Onda inicial", "Onda final", "n pareado", "Média inicial", "Média final", "Variação média absoluta", "Variação mediana absoluta", "Unidade"], rows: suppressed ? [] : [[baseline?.name ?? "Onda inicial", followUp?.name ?? "Onda final", paired.pairedCount, paired.baselineAggregate.mean, paired.followUpAggregate.mean, paired.meanAbsoluteChange, paired.medianAbsoluteChange, paired.unit]], suppressed });
  }
  result.push({ title: `${cohort.name} · metodologia`, valueType: null, columns: ["Protocolo", "Versão", "Indicadores sem métrica", "Ondas sem mês de referência", "Meses ambíguos"], rows: [[cohort.protocol?.name ?? "Não definido", cohort.protocol?.version ?? null, cohort.quality.unmappedIndicators, cohort.quality.missingOffsets, cohort.quality.ambiguousOffsets.join(", ")]], suppressed: false });
  return result;
}

export function buildPublicReportPayload(rawPayload: AnalyticsReportPayload, minimumCellSize: number): PublicReportPayload {
  const payload = analyticsReportPayloadSchema.parse(rawPayload);
  if (!Number.isInteger(minimumCellSize) || minimumCellSize < 3 || minimumCellSize > 20) throw new Error("ANALYTICS_PUBLIC_MINIMUM_INVALID");
  const sections: Section[] = [];
  switch (payload.type) {
    case "COHORT_LONGITUDINAL": sections.push(...cohortSections(payload.cohort, minimumCellSize)); break;
    case "EXECUTION_SUMMARY": sections.push(...callSections(payload.calls, minimumCellSize), ...executionSections(payload.execution, minimumCellSize)); break;
    case "DATA_QUALITY": {
      const quality = payload.quality;
      const cohortDetails = quality.cohorts.flatMap((cohort) => cohortSections(cohort, minimumCellSize));
      const suppressed = cohortDetails.some((section) => section.suppressed) || [quality.eligibleWithoutSubmission, quality.submittedWithoutMetricValue, quality.withdrawn].some((count) => isSmall(count, minimumCellSize));
      sections.push({ title: "Qualidade dos dados", valueType: null, columns: ["Indicadores sem métrica", "Ondas sem mês de referência", "Tempos ambíguos", "Elegíveis sem submissão", "Submetidas com valor ausente", "Retiradas"], rows: suppressed ? [] : [[quality.unmappedIndicators, quality.missingOffsets, quality.ambiguousTimepoints, quality.eligibleWithoutSubmission, quality.submittedWithoutMetricValue, quality.withdrawn]], suppressed });
      sections.push(...cohortDetails);
      break;
    }
    case "PORTFOLIO_EXECUTIVE":
    case "PROGRAM_SUMMARY": {
      const portfolio = payload.type === "PROGRAM_SUMMARY" ? payload.program : payload.portfolio;
      const cohortDetails = portfolio.cohorts.flatMap((cohort) => cohortSections(cohort, minimumCellSize));
      const monitoringSuppressed = cohortDetails.some((section) => section.suppressed && section.title.endsWith(" · cobertura")) || isSmall(portfolio.monitoring.expected, minimumCellSize) || isSmall(portfolio.monitoring.submitted, minimumCellSize) || isSmall(portfolio.monitoring.expected - portfolio.monitoring.submitted, minimumCellSize) || isSmall(portfolio.trackedVentures, minimumCellSize);
      sections.push({ title: "Acompanhamento do portfólio", valueType: null, columns: ["Programas", "Editais", "Empreendimentos acompanhados", "Observações esperadas", "Submetidas"], rows: monitoringSuppressed ? [] : [[portfolio.programs.length, portfolio.calls.total, portfolio.trackedVentures, portfolio.monitoring.expected, portfolio.monitoring.submitted]], suppressed: monitoringSuppressed });
      sections.push(...callSections(portfolio.calls, minimumCellSize), ...executionSections(portfolio.execution, minimumCellSize));
      sections.push(...cohortDetails);
      break;
    }
  }
  return publicReportPayloadSchema.parse({ analyticsSchemaVersion: 1, type: payload.type, title: payload.title, dataAsOf: payload.dataAsOf, scope: { institution: payload.scope.organizationName, program: payload.scope.programName, cohort: payload.scope.cohortName, call: payload.scope.callName, year: payload.scope.year }, methodology: payload.methodology, minimumCellSize, sections });
}
