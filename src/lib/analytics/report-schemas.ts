import { z } from "zod";

const id = z.string().min(1).max(128);
const text = z.string().max(500);
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const decimal = z.string().max(100).regex(/^-?\d+(?:\.\d+)?$/);
const numeric = z.union([z.number().finite(), decimal]).nullable();
const timestamp = z.string().datetime();
const scopeFilterSchema = z.object({ programId: id.nullable(), callId: id.nullable(), cohortId: id.nullable(), year: z.number().int().nullable(), metricId: id.nullable() }).strict();

export const metricAggregateSchema = z.object({
  metricId: id, key: text, label: text, valueType: z.enum(["INTEGER", "CURRENCY", "ENUM"]), unit: text.nullable(),
  primaryAggregation: z.enum(["TOTAL", "MEAN", "MEDIAN", "DISTRIBUTION"]), validCount: count, missingCount: count,
  sum: numeric, mean: numeric, median: numeric, minimum: numeric, maximum: numeric,
  distribution: z.array(z.object({ value: text, count }).strict()).max(100),
}).strict().superRefine((metric, context) => {
  if (metric.valueType === "CURRENCY" && [metric.sum, metric.mean, metric.median, metric.minimum, metric.maximum].some((value) => typeof value === "number")) {
    context.addIssue({ code: "custom", message: "Currency aggregates require lossless decimal strings." });
  }
});

export const coverageSchema = z.object({ expected: count, submitted: count, pending: count, inProgress: count, missed: count, notEligible: count, withdrawn: count, percentage: z.number().finite().min(0).max(100).nullable() }).strict();
export const waveAnalyticsSchema = z.object({ id, name: text, offsetMonths: z.number().int().nullable(), sequence: z.number().int(), status: text, referenceAt: timestamp, coverage: coverageSchema, metrics: z.array(metricAggregateSchema).max(100) }).strict();
export const pairedMetricSchema = z.object({ metricId: id, label: text, valueType: z.enum(["INTEGER", "CURRENCY"]), unit: text.nullable(), baselineWaveId: id, followUpWaveId: id, pairedCount: count, baselineAggregate: metricAggregateSchema, followUpAggregate: metricAggregateSchema, meanAbsoluteChange: numeric, medianAbsoluteChange: numeric }).strict().superRefine((paired, context) => {
  if (paired.valueType === "CURRENCY" && [paired.meanAbsoluteChange, paired.medianAbsoluteChange].some((value) => typeof value === "number")) context.addIssue({ code: "custom", message: "Currency changes require lossless decimal strings." });
  if (paired.baselineAggregate.valueType !== paired.valueType || paired.followUpAggregate.valueType !== paired.valueType || paired.baselineAggregate.metricId !== paired.metricId || paired.followUpAggregate.metricId !== paired.metricId) context.addIssue({ code: "custom", message: "Paired measurements must share metric identity and value type." });
});
export const cohortAnalyticsSchema = z.object({
  id, name: text, programId: id, programName: text, callId: id.nullable(), protocol: z.object({ id, name: text, version: count }).strict().nullable(), enrollmentCount: count,
  waves: z.array(waveAnalyticsSchema).max(500), paired: z.array(pairedMetricSchema).max(500),
  quality: z.object({ unmappedIndicators: count, missingOffsets: count, ambiguousOffsets: z.array(z.number().int()).max(500) }).strict(),
}).strict();
export const callsSummarySchema = z.object({ total: count, applicationsObserved: count, submitted: count.nullable(), withdrawn: count.nullable(), evaluated: count.nullable(), selected: count.nullable() }).strict();
export const executionSummarySchema = z.object({
  awards: count, byStatus: z.array(z.object({ status: text, count }).strict()).max(20),
  financial: z.object({ approved: decimal.nullable(), planned: decimal.nullable(), paid: decimal.nullable(), approvedCount: count, plannedCount: count, paidCount: count }).strict(),
  requiredObligations: count, approvedObligations: count, overdueObligations: count, pendingReviews: count,
}).strict();
export const portfolioAnalyticsSchema = z.object({
  scope: scopeFilterSchema,
  programs: z.array(z.object({ id, name: text, status: text, calls: count, cohorts: count, trackedVentures: count, activeAwards: count }).strict()).max(100),
  calls: callsSummarySchema, execution: executionSummarySchema, cohorts: z.array(cohortAnalyticsSchema).max(100), monitoring: z.object({ expected: count, submitted: count }).strict(), trackedVentures: count,
  milestones: z.array(z.object({ type: text, count }).strict()).max(100),
}).strict();
export const programAnalyticsSchema = portfolioAnalyticsSchema.extend({ program: z.object({ id, name: text, status: text, description: z.string().max(10000).nullable() }).strict() }).strict();
export const dataQualitySchema = z.object({ scope: scopeFilterSchema, cohorts: z.array(cohortAnalyticsSchema).max(100), unmappedIndicators: count, missingOffsets: count, ambiguousTimepoints: count, eligibleWithoutSubmission: count, submittedWithoutMetricValue: count, withdrawn: count }).strict();

export const reportTypeSchema = z.enum(["PORTFOLIO_EXECUTIVE", "PROGRAM_SUMMARY", "COHORT_LONGITUDINAL", "DATA_QUALITY", "EXECUTION_SUMMARY"]);
const reportBase = {
  analyticsSchemaVersion: z.literal(1), type: reportTypeSchema, title: z.string().min(1).max(160), dataAsOf: timestamp,
  scope: z.object({ organizationName: text, programId: id.nullable(), programName: text.nullable(), cohortId: id.nullable(), cohortName: text.nullable(), callId: id.nullable().default(null), callName: text.nullable().default(null), year: z.number().int().min(1900).max(2200).nullable().default(null) }).strict(),
  methodology: z.object({ interpretation: z.string().max(1000), eligibility: z.string().max(1000), comparability: z.string().max(1000) }).strict(),
};
export const analyticsReportPayloadSchema = z.discriminatedUnion("type", [
  z.object({ ...reportBase, type: z.literal("PORTFOLIO_EXECUTIVE"), portfolio: portfolioAnalyticsSchema }).strict(),
  z.object({ ...reportBase, type: z.literal("PROGRAM_SUMMARY"), program: programAnalyticsSchema }).strict(),
  z.object({ ...reportBase, type: z.literal("COHORT_LONGITUDINAL"), cohort: cohortAnalyticsSchema }).strict(),
  z.object({ ...reportBase, type: z.literal("DATA_QUALITY"), quality: dataQualitySchema }).strict(),
  z.object({ ...reportBase, type: z.literal("EXECUTION_SUMMARY"), execution: executionSummarySchema, calls: callsSummarySchema, programCount: count }).strict(),
]);
export type AnalyticsReportPayload = z.infer<typeof analyticsReportPayloadSchema>;
export type AnalyticsReportType = z.infer<typeof reportTypeSchema>;

export const generateAnalyticsReportSchema = z.object({
  type: reportTypeSchema, title: z.string().trim().min(3, "Informe um título.").max(160),
  programId: id.optional(), callId: id.optional(), cohortId: id.optional(), metricId: id.optional(), year: z.number().int().min(1900).max(2200).optional(), supersedesId: id.optional(),
}).strict().superRefine((input, context) => {
  if (input.type === "COHORT_LONGITUDINAL" && !input.cohortId) context.addIssue({ code: "custom", path: ["cohortId"], message: "Escolha uma coorte." });
  if (input.type === "PROGRAM_SUMMARY" && !input.programId) context.addIssue({ code: "custom", path: ["programId"], message: "Escolha um programa." });
});
export type GenerateAnalyticsReportInput = z.input<typeof generateAnalyticsReportSchema>;

export function parseAnalyticsReportPayload(type: string, version: number, rawPayload: unknown): AnalyticsReportPayload {
  if (version !== 1) throw new Error("ANALYTICS_REPORT_SCHEMA_UNSUPPORTED");
  const payload = analyticsReportPayloadSchema.parse(rawPayload);
  if (payload.type !== type || payload.analyticsSchemaVersion !== version) throw new Error("ANALYTICS_REPORT_SCHEMA_MISMATCH");
  return payload;
}

export const publicReportPayloadSchema = z.object({
  analyticsSchemaVersion: z.literal(1), type: reportTypeSchema, title: z.string().max(160), dataAsOf: timestamp,
  scope: z.object({ institution: text, program: text.nullable(), cohort: text.nullable(), call: text.nullable().default(null), year: z.number().int().nullable().default(null) }).strict(),
  methodology: z.object(reportBase.methodology.shape).strict(), minimumCellSize: z.number().int().min(3).max(20),
  sections: z.array(z.object({ title: z.string().max(300), valueType: z.enum(["INTEGER", "CURRENCY", "ENUM"]).nullable(), columns: z.array(z.string().max(100)).max(15), rows: z.array(z.array(z.union([z.string().max(1000), z.number().finite(), z.null()])).max(15)).max(1000), suppressed: z.boolean() }).strict()).max(500),
}).strict();
export type PublicReportPayload = z.infer<typeof publicReportPayloadSchema>;
