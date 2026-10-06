import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import { assertAnalyticsAccess } from "@/lib/analytics/access";
import { getAnalyticsSourceDigest } from "@/lib/analytics/read-model";
import type { AnalyticsAccess, AnalyticsFilters } from "@/lib/analytics/types";
import { analyticsReportPayloadSchema, generateAnalyticsReportSchema, parseAnalyticsReportPayload, type AnalyticsReportPayload, type GenerateAnalyticsReportInput } from "@/lib/analytics/report-schemas";
import { generatePortfolioExecutive } from "@/lib/analytics/report-generators/portfolio";
import { generateProgramSummary } from "@/lib/analytics/report-generators/program";
import { generateCohortLongitudinal } from "@/lib/analytics/report-generators/cohort";
import { generateDataQualityReport } from "@/lib/analytics/report-generators/quality";
import { generateExecutionSummary } from "@/lib/analytics/report-generators/execution";
import { reportMethodology } from "@/lib/analytics/report-generators/shared";
import { analyticsCohortWhere, resolveAnalyticsScope } from "@/lib/analytics/scope";
export type { AnalyticsReportPayload, AnalyticsReportType, GenerateAnalyticsReportInput } from "@/lib/analytics/report-schemas";

export const MAX_REPORT_PAYLOAD_BYTES = 2_000_000;
export const reportSelect = {
  id: true, type: true, title: true, parameters: true, payload: true, analyticsSchemaVersion: true, sourceDigest: true,
  generatedAt: true, dataAsOf: true, archivedAt: true, supersedesId: true,
  generatedBy: { select: { id: true, profile: { select: { fullName: true } } } },
} satisfies Prisma.AnalyticsReportSnapshotSelect;
type ReportRecord = Prisma.AnalyticsReportSnapshotGetPayload<{ select: typeof reportSelect }>;
export type AnalyticsReportDto = ReturnType<typeof serializeReport>;

function serializeReport(record: ReportRecord) {
  return { ...record, parameters: generateAnalyticsReportSchema.parse(record.parameters), payload: parseAnalyticsReportPayload(record.type, record.analyticsSchemaVersion, record.payload), generatedAt: record.generatedAt.toISOString(), dataAsOf: record.dataAsOf.toISOString(), archivedAt: record.archivedAt?.toISOString() ?? null, generatedBy: { id: record.generatedBy.id, name: record.generatedBy.profile?.fullName ?? "Usuário institucional" } };
}

export function reportSourceKind(type: AnalyticsReportPayload["type"]) {
  return type === "COHORT_LONGITUDINAL" || type === "DATA_QUALITY" ? "COHORT" : type === "EXECUTION_SUMMARY" ? "EXECUTION" : "PORTFOLIO";
}

async function buildReport(client: Prisma.TransactionClient, access: AnalyticsAccess, rawInput: GenerateAnalyticsReportInput) {
  const input = generateAnalyticsReportSchema.parse(rawInput);
  await assertAnalyticsAccess(access, "ANALYST", client);
  const organization = await client.organization.findFirst({ where: { id: access.organizationId, status: "ACTIVE" }, select: { name: true } });
  if (!organization) throw new ResourceNotFoundError("ORGANIZATION_NOT_FOUND");
  const scope = await resolveAnalyticsScope(client, access.organizationId, { programId: input.programId, callId: input.callId, cohortId: input.cohortId, metricId: input.metricId, year: input.year });
  const cohort = input.cohortId ? await client.cohort.findFirst({ where: analyticsCohortWhere(access.organizationId, scope), select: { name: true, fundingProgramId: true } }) : null;
  if (input.cohortId && !cohort) throw new ResourceNotFoundError("COHORT_NOT_FOUND");
  if (cohort && input.programId && cohort.fundingProgramId !== input.programId) throw new DomainConflictError("ANALYTICS_REPORT_SCOPE_INVALID");
  const programId = scope.programId ?? undefined;
  const program = programId ? await client.fundingProgram.findFirst({ where: { organizationId: access.organizationId, id: programId }, select: { name: true } }) : null;
  if (programId && !program) throw new ResourceNotFoundError("FUNDING_PROGRAM_NOT_FOUND");
  const call = scope.callId ? await client.fundingCall.findFirst({ where: { organizationId: access.organizationId, id: scope.callId }, select: { title: true } }) : null;
  const filters: AnalyticsFilters = { programId, cohortId: input.cohortId, callId: input.callId, year: input.year, metricId: input.metricId };
  const dataAsOf = new Date();
  const context = {
    access, client, input, filters,
    base: { analyticsSchemaVersion: 1 as const, title: input.title, dataAsOf: dataAsOf.toISOString(), scope: { organizationName: organization.name, programId: programId ?? null, programName: program?.name ?? null, cohortId: input.cohortId ?? null, cohortName: cohort?.name ?? null, callId: scope.callId, callName: call?.title ?? null, year: input.year ?? null }, methodology: reportMethodology },
  };
  const generators = { PORTFOLIO_EXECUTIVE: generatePortfolioExecutive, PROGRAM_SUMMARY: generateProgramSummary, COHORT_LONGITUDINAL: generateCohortLongitudinal, DATA_QUALITY: generateDataQualityReport, EXECUTION_SUMMARY: generateExecutionSummary };
  const payload = analyticsReportPayloadSchema.parse(await generators[input.type](context));
  if (Buffer.byteLength(JSON.stringify(payload), "utf8") > MAX_REPORT_PAYLOAD_BYTES) throw new DomainConflictError("ANALYTICS_REPORT_SCOPE_TOO_LARGE");
  const sourceDigest = await getAnalyticsSourceDigest(access, filters, client, reportSourceKind(input.type));
  return { input, payload, sourceDigest, dataAsOf, programId };
}

export async function previewAnalyticsReport(access: AnalyticsAccess, rawInput: GenerateAnalyticsReportInput): Promise<AnalyticsReportPayload> {
  return db.$transaction(async (client) => (await buildReport(client, access, rawInput)).payload, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 60000 });
}

export async function generateAnalyticsReport(access: AnalyticsAccess, rawInput: GenerateAnalyticsReportInput): Promise<AnalyticsReportDto> {
  return db.$transaction(async (client) => {
    const { input, payload, sourceDigest, dataAsOf, programId } = await buildReport(client, access, rawInput);
    if (input.supersedesId && !await client.analyticsReportSnapshot.findFirst({ where: { organizationId: access.organizationId, id: input.supersedesId, type: input.type, fundingProgramId: programId ?? null, cohortId: input.cohortId ?? null }, select: { id: true } })) throw new ResourceNotFoundError("ANALYTICS_REPORT_NOT_FOUND");
    const record = await client.analyticsReportSnapshot.create({ data: { organizationId: access.organizationId, fundingProgramId: programId ?? null, cohortId: input.cohortId ?? null, type: input.type, title: input.title, parameters: input as Prisma.InputJsonObject, payload: payload as unknown as Prisma.InputJsonObject, analyticsSchemaVersion: 1, sourceDigest, generatedByUserId: access.userId, dataAsOf, supersedesId: input.supersedesId ?? null }, select: reportSelect });
    return serializeReport(record);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 60000 });
}

export async function listAnalyticsReports(access: AnalyticsAccess): Promise<AnalyticsReportDto[]> {
  await assertAnalyticsAccess(access);
  const records = await db.analyticsReportSnapshot.findMany({ where: { organizationId: access.organizationId }, select: reportSelect, orderBy: [{ generatedAt: "desc" }, { id: "desc" }], take: 100 });
  return records.map(serializeReport);
}

export async function getAnalyticsReport(access: AnalyticsAccess, reportId: string): Promise<AnalyticsReportDto> {
  await assertAnalyticsAccess(access);
  const record = await db.analyticsReportSnapshot.findFirst({ where: { organizationId: access.organizationId, id: reportId }, select: reportSelect });
  if (!record) throw new ResourceNotFoundError("ANALYTICS_REPORT_NOT_FOUND");
  return serializeReport(record);
}

export async function getAnalyticsReportSourceStatus(access: AnalyticsAccess, reportId: string) {
  return db.$transaction(async (client) => {
    await assertAnalyticsAccess(access, undefined, client);
    const record = await client.analyticsReportSnapshot.findFirst({ where: { organizationId: access.organizationId, id: reportId }, select: { parameters: true, sourceDigest: true, type: true } });
    if (!record) throw new ResourceNotFoundError("ANALYTICS_REPORT_NOT_FOUND");
    const parameters = generateAnalyticsReportSchema.parse(record.parameters);
    try {
      const currentDigest = await getAnalyticsSourceDigest(access, { programId: parameters.programId, callId: parameters.callId, cohortId: parameters.cohortId, year: parameters.year, metricId: parameters.metricId }, client, reportSourceKind(record.type));
      return { available: true as const, stale: currentDigest !== record.sourceDigest, sourceDigest: record.sourceDigest, currentDigest };
    } catch (error) {
      if (!(error instanceof DomainConflictError) || error.code !== "ANALYTICS_SCOPE_TOO_LARGE") throw error;
      return { available: false as const, stale: null, sourceDigest: record.sourceDigest, currentDigest: null, reason: "SOURCE_SCOPE_TOO_LARGE" as const };
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 60000 });
}

export async function archiveAnalyticsReport(access: AnalyticsAccess, reportId: string) {
  await db.$transaction(async (client) => {
    await assertAnalyticsAccess(access, "MANAGER", client);
    const updated = await client.analyticsReportSnapshot.updateMany({ where: { organizationId: access.organizationId, id: reportId, archivedAt: null }, data: { archivedAt: new Date() } });
    if (!updated.count && !await client.analyticsReportSnapshot.findFirst({ where: { organizationId: access.organizationId, id: reportId }, select: { id: true } })) throw new ResourceNotFoundError("ANALYTICS_REPORT_NOT_FOUND");
  });
  return getAnalyticsReport(access, reportId);
}
