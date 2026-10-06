import { Prisma } from "@prisma/client";
import { z } from "zod";
import { withAnalyticsSnapshot } from "@/lib/analytics/transaction";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import { assertAnalyticsAccess } from "@/lib/analytics/access";
import { getAnalyticsSourceDigest, getPortfolioAnalytics, getCohortAnalytics } from "@/lib/analytics/read-model";
import type { AnalyticsAccess, AnalyticsFilters } from "@/lib/analytics/types";
import { MAX_EXPORT_ROWS, serializeCsv, type CsvCell } from "@/lib/analytics/csv";
import { analyticsCallWhere, analyticsCohortWhere, resolveAnalyticsScope } from "@/lib/analytics/scope";
import { isObservationEligibleForWave } from "@/lib/monitoring/coverage";
import { calendarToday, deriveObligationState } from "@/lib/execution/state";
import { digestSources } from "@/lib/analytics/source-digest";

export const analyticsExportSchema = z.object({
  type: z.enum(["COHORT_OBSERVATIONS", "COHORT_AGGREGATES", "PROGRAM_SUMMARY", "EXECUTION_SUMMARY", "APPLICATIONS_SUMMARY", "PORTFOLIO_SUMMARY"]),
  programId: z.string().min(1).max(128).optional(), callId: z.string().min(1).max(128).optional(), cohortId: z.string().min(1).max(128).optional(), metricId: z.string().min(1).max(128).optional(), year: z.number().int().min(1900).max(2200).optional(),
}).strict().superRefine((input, context) => {
  if (input.type.startsWith("COHORT_") && !input.cohortId) context.addIssue({ code: "custom", path: ["cohortId"], message: "Escolha uma coorte." });
  if (input.type === "PROGRAM_SUMMARY" && !input.programId) context.addIssue({ code: "custom", path: ["programId"], message: "Escolha um programa." });
  if (!input.type.startsWith("COHORT_") && input.cohortId) context.addIssue({ code: "custom", path: ["cohortId"], message: "Use a exportação de coorte para este recorte." });
});
export type AnalyticsExportInput = z.input<typeof analyticsExportSchema>;
type Table = { columns: string[]; rows: CsvCell[][]; ventureNames?: { id: string; name: string }[] };
const exportFilters = (input: AnalyticsExportInput): AnalyticsFilters => ({ programId: input.programId, callId: input.callId, cohortId: input.cohortId, metricId: input.metricId, year: input.year });

function metricRows(cohort: Awaited<ReturnType<typeof getCohortAnalytics>>, metricId?: string): Table {
  const columns = ["cohort", "program", "wave", "offset_months", "reference_at", "metric_key", "metric_label", "value_type", "unit", "primary_aggregation", "valid_n", "missing_n", "expected_n", "submitted_n", "sum", "mean", "median", "minimum", "maximum", "category", "category_n"];
  const rows: CsvCell[][] = [];
  for (const wave of cohort.waves) for (const metric of wave.metrics) {
    if (metricId && metric.metricId !== metricId) continue;
    const prefix: CsvCell[] = [cohort.name, cohort.programName, wave.name, wave.offsetMonths, wave.referenceAt, metric.key, metric.label, metric.valueType, metric.unit, metric.primaryAggregation, metric.validCount, metric.missingCount, wave.coverage.expected, wave.coverage.submitted, metric.sum, metric.mean, metric.median, metric.minimum, metric.maximum];
    if (metric.distribution.length) for (const category of metric.distribution) rows.push([...prefix, category.value, category.count]);
    else rows.push([...prefix, null, null]);
    if (rows.length > MAX_EXPORT_ROWS) throw new DomainConflictError("ANALYTICS_EXPORT_ROW_LIMIT");
  }
  return { columns, rows };
}

async function observationTable(client: Prisma.TransactionClient, access: AnalyticsAccess, input: AnalyticsExportInput): Promise<Table> {
  const cohort = await client.cohort.findFirst({ where: { organizationId: access.organizationId, id: input.cohortId }, select: { name: true, trackingProtocolVersion: { select: { indicators: { where: { organizationId: access.organizationId, ...(input.metricId ? { metricDefinitionId: input.metricId } : {}) }, select: { id: true, key: true, label: true, valueType: true, unit: true, metricDefinition: { select: { key: true, label: true } } }, orderBy: { position: "asc" }, take: 501 } } } } });
  if (!cohort) throw new ResourceNotFoundError("COHORT_NOT_FOUND");
  const indicators = cohort.trackingProtocolVersion?.indicators ?? [];
  if (indicators.length > 500) throw new DomainConflictError("ANALYTICS_EXPORT_ROW_LIMIT");
  const records = await client.ventureObservation.findMany({
    where: { organizationId: access.organizationId, cohortId: input.cohortId, status: "SUBMITTED" },
    select: { id: true, status: true, submittedAt: true, followUpWave: { select: { name: true, offsetMonths: true, scheduledFor: true, opensAt: true, createdAt: true } }, ventureEnrollment: { select: { enrolledAt: true, withdrawnAt: true, venture: { select: { id: true, name: true } } } } },
    orderBy: { id: "asc" }, take: MAX_EXPORT_ROWS + 1,
  });
  if (records.length > MAX_EXPORT_ROWS) throw new DomainConflictError("ANALYTICS_EXPORT_ROW_LIMIT");
  const eligible = records.filter((record) => isObservationEligibleForWave(record, record.followUpWave));
  if (eligible.length * indicators.length > MAX_EXPORT_ROWS) throw new DomainConflictError("ANALYTICS_EXPORT_ROW_LIMIT");
  const values = new Map<string, { integerValue: number | null; decimalValue: Prisma.Decimal | null; textValue: string | null }>();
  // Load only eligible cells after enforcing the long-format row bound, including missing cells.
  for (let offset = 0; offset < eligible.length && indicators.length; offset += 1000) {
    const sourceValues = await client.observationValue.findMany({ where: { organizationId: access.organizationId, observationId: { in: eligible.slice(offset, offset + 1000).map((record) => record.id) }, indicatorDefinitionId: { in: indicators.map((indicator) => indicator.id) } }, select: { observationId: true, indicatorDefinitionId: true, integerValue: true, decimalValue: true, textValue: true }, take: MAX_EXPORT_ROWS + 1 });
    for (const value of sourceValues) values.set(`${value.observationId}:${value.indicatorDefinitionId}`, value);
    if (values.size > MAX_EXPORT_ROWS) throw new DomainConflictError("ANALYTICS_EXPORT_ROW_LIMIT");
  }
  return {
    ventureNames: indicators.length ? [...new Map(eligible.map((record) => [record.ventureEnrollment.venture.id, record.ventureEnrollment.venture])).values()].sort((left, right) => left.id.localeCompare(right.id)) : [],
    columns: ["venture", "cohort", "wave", "offset_months", "indicator_key", "metric_key", "metric_label", "metric_mapped", "value", "value_type", "unit", "observation_status", "submitted_at"],
    rows: eligible.flatMap((record) => indicators.map((indicator): CsvCell[] => {
      const value = values.get(`${record.id}:${indicator.id}`);
      return [record.ventureEnrollment.venture.name, cohort.name, record.followUpWave.name, record.followUpWave.offsetMonths, indicator.key, indicator.metricDefinition?.key ?? indicator.key, indicator.metricDefinition?.label ?? indicator.label, indicator.metricDefinition ? "true" : "false", indicator.valueType === "CURRENCY" ? value?.decimalValue?.toFixed(2) ?? null : indicator.valueType === "INTEGER" ? value?.integerValue ?? null : value?.textValue ?? null, indicator.valueType, indicator.unit, record.status, record.submittedAt?.toISOString() ?? null];
    })),
  };
}

async function applicationsTable(client: Prisma.TransactionClient, access: AnalyticsAccess, input: AnalyticsExportInput): Promise<Table> {
  const scope = await resolveAnalyticsScope(client, access.organizationId, exportFilters(input));
  const records = await client.application.findMany({
    where: { organizationId: access.organizationId, fundingCall: analyticsCallWhere(access.organizationId, scope) },
    select: { projectNameSnapshot: true, status: true, decision: true, submittedAt: true, withdrawnAt: true, decidedAt: true, fundingCall: { select: { title: true, callNumber: true, fundingProgram: { select: { name: true } } } } },
    orderBy: { id: "asc" }, take: MAX_EXPORT_ROWS + 1,
  });
  if (records.length > MAX_EXPORT_ROWS) throw new DomainConflictError("ANALYTICS_EXPORT_ROW_LIMIT");
  return { columns: ["program", "call", "call_number", "project", "application_status", "decision", "submitted_at", "withdrawn_at", "decided_at"], rows: records.map((record) => [record.fundingCall.fundingProgram.name, record.fundingCall.title, record.fundingCall.callNumber, record.projectNameSnapshot, record.status, record.decision, record.submittedAt?.toISOString() ?? null, record.withdrawnAt?.toISOString() ?? null, record.decidedAt?.toISOString() ?? null]) };
}

async function executionTable(client: Prisma.TransactionClient, access: AnalyticsAccess, input: AnalyticsExportInput): Promise<Table> {
  const scope = await resolveAnalyticsScope(client, access.organizationId, exportFilters(input));
  const awardWhere: Prisma.AwardWhereInput = { organizationId: access.organizationId, fundingCall: analyticsCallWhere(access.organizationId, scope) };
  const childCounts = await Promise.all([
    client.awardObligation.count({ where: { organizationId: access.organizationId, award: awardWhere } }),
    client.awardSubmission.count({ where: { organizationId: access.organizationId, status: "SUBMITTED", obligation: { award: awardWhere } } }),
    client.awardDisbursement.count({ where: { organizationId: access.organizationId, award: awardWhere } }),
  ]);
  if (childCounts.some((count) => count > MAX_EXPORT_ROWS)) throw new DomainConflictError("ANALYTICS_EXPORT_ROW_LIMIT");
  const records = await client.award.findMany({
    where: awardWhere,
    select: { status: true, approvedAmount: true, startsAt: true, endsAt: true, application: { select: { projectNameSnapshot: true } }, fundingCall: { select: { title: true, fundingProgram: { select: { name: true } } } }, obligations: { where: { organizationId: access.organizationId }, select: { required: true, waivedAt: true, dueAt: true, submissions: { where: { organizationId: access.organizationId, status: "SUBMITTED" }, select: { status: true, reviewStatus: true }, orderBy: { version: "desc" } } } }, disbursements: { where: { organizationId: access.organizationId }, select: { amount: true, status: true } } },
    orderBy: { id: "asc" }, take: MAX_EXPORT_ROWS + 1,
  });
  if (records.length > MAX_EXPORT_ROWS) throw new DomainConflictError("ANALYTICS_EXPORT_ROW_LIMIT");
  const rows = records.map((record): CsvCell[] => {
    const obligations = record.obligations.map((obligation) => ({ ...obligation, state: deriveObligationState({ ...obligation, dueAt: obligation.dueAt?.toISOString().slice(0, 10) ?? null }, calendarToday()) }));
    const active = record.status === "ACTIVE" || record.status === "SUSPENDED";
    const paid = record.disbursements.filter((disbursement) => disbursement.status === "PAID");
    const planned = record.disbursements.filter((disbursement) => disbursement.status === "PLANNED");
    const total = (entries: typeof paid) => entries.length ? entries.reduce((sum, item) => sum.plus(item.amount), new Prisma.Decimal(0)).toFixed(2) : null;
    return [record.fundingCall.fundingProgram.name, record.fundingCall.title, record.application.projectNameSnapshot, record.status, record.approvedAmount?.toFixed(2) ?? null, "BRL", record.startsAt?.toISOString().slice(0, 10) ?? null, record.endsAt?.toISOString().slice(0, 10) ?? null, obligations.filter((obligation) => obligation.required).length, obligations.filter((obligation) => obligation.state === "APPROVED").length, active ? obligations.filter((obligation) => obligation.state === "OVERDUE").length : 0, active ? obligations.filter((obligation) => obligation.state === "SUBMITTED").length : 0, total(planned), planned.length, total(paid), paid.length];
  });
  return { columns: ["program", "call", "project", "award_status", "approved_amount", "currency", "starts_at", "ends_at", "required_obligations", "approved_obligations", "overdue_obligations", "pending_reviews", "planned_amount", "planned_disbursements", "paid_amount", "paid_disbursements"], rows };
}

function portfolioTable(portfolio: Awaited<ReturnType<typeof getPortfolioAnalytics>>): Table {
  return { columns: ["program", "program_status", "calls", "cohorts", "tracked_ventures", "active_awards"], rows: portfolio.programs.map((program) => [program.name, program.status, program.calls, program.cohorts, program.trackedVentures, program.activeAwards]) };
}

export async function createAnalyticsExport(access: AnalyticsAccess, rawInput: AnalyticsExportInput) {
  const input = analyticsExportSchema.parse(rawInput);
  return withAnalyticsSnapshot(async (client) => {
    await assertAnalyticsAccess(access, "ANALYST", client);
    const cohort = input.cohortId ? await client.cohort.findFirst({ where: { organizationId: access.organizationId, id: input.cohortId }, select: { fundingProgramId: true } }) : null;
    if (input.cohortId && !cohort) throw new ResourceNotFoundError("COHORT_NOT_FOUND");
    if (input.programId && cohort && input.programId !== cohort.fundingProgramId) throw new DomainConflictError("ANALYTICS_EXPORT_SCOPE_INVALID");
    const resolved = await resolveAnalyticsScope(client, access.organizationId, { programId: input.programId, cohortId: input.cohortId, callId: input.callId, year: input.year, metricId: input.metricId });
    if (input.cohortId && !await client.cohort.findFirst({ where: analyticsCohortWhere(access.organizationId, resolved), select: { id: true } })) throw new ResourceNotFoundError("COHORT_NOT_FOUND");
    const programId = resolved.programId ?? undefined;
    if (programId && !await client.fundingProgram.findFirst({ where: { organizationId: access.organizationId, id: programId }, select: { id: true } })) throw new ResourceNotFoundError("FUNDING_PROGRAM_NOT_FOUND");
    const filters: AnalyticsFilters = { programId, cohortId: input.cohortId, metricId: input.metricId, callId: input.callId, year: input.year };
    const dataAsOf = new Date();
    let table: Table;
    switch (input.type) {
      case "COHORT_OBSERVATIONS": table = await observationTable(client, access, input); break;
      case "COHORT_AGGREGATES": table = metricRows(await getCohortAnalytics(access, input.cohortId!, client), input.metricId); break;
      case "PROGRAM_SUMMARY": {
        const programInfo = await client.fundingProgram.findFirstOrThrow({ where: { organizationId: access.organizationId, id: programId! }, select: { name: true } });
        const program = { program: programInfo, ...await getPortfolioAnalytics(access, filters, client) };
        table = { columns: ["program", "calls", "applications_observed", "submitted_applications", "withdrawn_applications", "evaluated_applications", "selected_applications", "awards", "approved_amount", "planned_amount", "paid_amount", "currency", "tracked_ventures", "monitoring_expected", "monitoring_submitted"], rows: [[program.program.name, program.calls.total, program.calls.applicationsObserved, program.calls.submitted, program.calls.withdrawn, program.calls.evaluated, program.calls.selected, program.execution.awards, program.execution.financial.approved, program.execution.financial.planned, program.execution.financial.paid, "BRL", program.trackedVentures, program.monitoring.expected, program.monitoring.submitted]] };
        break;
      }
      case "EXECUTION_SUMMARY": table = await executionTable(client, access, input); break;
      case "APPLICATIONS_SUMMARY": table = await applicationsTable(client, access, input); break;
      case "PORTFOLIO_SUMMARY": table = portfolioTable(await getPortfolioAnalytics(access, filters, client)); break;
    }
    if (table.rows.length > MAX_EXPORT_ROWS) throw new DomainConflictError("ANALYTICS_EXPORT_ROW_LIMIT");
    const sourceKind = input.type.startsWith("COHORT_") ? "COHORT" : input.type === "EXECUTION_SUMMARY" ? "EXECUTION" : input.type === "APPLICATIONS_SUMMARY" ? "APPLICATIONS" : "PORTFOLIO";
    const baseDigest = await getAnalyticsSourceDigest(access, filters, client, sourceKind);
    const sourceDigest = input.type === "COHORT_OBSERVATIONS" ? digestSources({ baseDigest, ventures: table.ventureNames ?? [] }) : baseDigest;
    const metadataColumns = ["export_type", "scope_type", "scope_id", "program_id", "call_id", "call_year", "cohort_id", "metric_id", "data_as_of", "source_digest", "analytics_schema_version"];
    const scopeType = input.cohortId ? "COHORT" : programId ? "PROGRAM" : "PORTFOLIO";
    const scopeId = input.cohortId ?? programId ?? access.organizationId;
    const metadata: CsvCell[] = [input.type, scopeType, scopeId, programId ?? null, input.callId ?? null, input.year ?? null, input.cohortId ?? null, input.metricId ?? null, dataAsOf.toISOString(), sourceDigest, 1];
    const csv = serializeCsv([...table.columns, ...metadataColumns], table.rows.map((row) => [...row, ...metadata]));
    const audit = await client.dataExportAudit.create({ data: { organizationId: access.organizationId, exportedByUserId: access.userId, type: input.type, format: "CSV", scopeType, scopeId, fundingProgramId: programId ?? null, cohortId: input.cohortId ?? null, parameters: input as Prisma.InputJsonObject, rowCount: table.rows.length, dataAsOf, sourceDigest }, select: { id: true } });
    return { csv, filename: `atlas-innove-${input.type.toLowerCase().replaceAll("_", "-")}-${dataAsOf.toISOString().slice(0, 10)}.csv`, rowCount: table.rows.length, auditId: audit.id };
  });
}
