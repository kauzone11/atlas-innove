import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { assertCallStatusTransition } from "@/lib/domain-invariants";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import { createFundingCallSchema, updateFundingCallSchema, type CreateFundingCallDocumentInput, type CreateFundingCallInput, type UpdateFundingCallInput } from "@/lib/funding-calls/schemas";

const callSelect = {
  id: true, organizationId: true, fundingProgramId: true, title: true, shortTitle: true, callNumber: true,
  objective: true, status: true, publishedAt: true, applicationStartsAt: true, applicationEndsAt: true,
  applicationsEnabled: true, evaluationStartedAt: true, resultsPublishedAt: true,
  totalBudget: true, maximumSupport: true, targetProjects: true, executionMonths: true, sourceUrl: true,
  sourceCheckedAt: true, createdAt: true, updatedAt: true,
  fundingProgram: { select: { id: true, name: true } },
  documents: { select: { id: true, type: true, title: true, externalUrl: true, publishedAt: true }, orderBy: { createdAt: "asc" } },
  _count: { select: { cohorts: true } },
} as const satisfies Prisma.FundingCallSelect;

type CallRecord = Prisma.FundingCallGetPayload<{ select: typeof callSelect }>;
export type FundingCallDto = {
  id: string; organizationId: string; fundingProgramId: string; fundingProgram: { id: string; name: string };
  title: string; shortTitle: string | null; callNumber: string; objective: string | null; status: string;
  applicationsEnabled: boolean; evaluationStartedAt: string | null; resultsPublishedAt: string | null;
  publishedAt: string | null; applicationStartsAt: string | null; applicationEndsAt: string | null;
  totalBudget: string | null; maximumSupport: string | null; targetProjects: number | null; executionMonths: number | null;
  sourceUrl: string | null; sourceCheckedAt: string | null; createdAt: string; updatedAt: string; cohortCount: number;
  documents: Array<{ id: string; type: string; title: string; externalUrl: string; publishedAt: string | null }>;
};

function serializeCall(record: CallRecord): FundingCallDto {
  return {
    id: record.id, organizationId: record.organizationId, fundingProgramId: record.fundingProgramId,
    fundingProgram: record.fundingProgram, title: record.title, shortTitle: record.shortTitle, callNumber: record.callNumber,
    objective: record.objective, status: record.status, publishedAt: record.publishedAt?.toISOString() ?? null,
    applicationsEnabled: record.applicationsEnabled, evaluationStartedAt: record.evaluationStartedAt?.toISOString() ?? null, resultsPublishedAt: record.resultsPublishedAt?.toISOString() ?? null,
    applicationStartsAt: record.applicationStartsAt?.toISOString() ?? null, applicationEndsAt: record.applicationEndsAt?.toISOString() ?? null,
    totalBudget: record.totalBudget?.toFixed(2) ?? null, maximumSupport: record.maximumSupport?.toFixed(2) ?? null,
    targetProjects: record.targetProjects, executionMonths: record.executionMonths, sourceUrl: record.sourceUrl,
    sourceCheckedAt: record.sourceCheckedAt?.toISOString() ?? null, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(),
    cohortCount: record._count.cohorts,
    documents: record.documents.map((document) => ({ ...document, publishedAt: document.publishedAt?.toISOString() ?? null })),
  };
}

export async function listProgramFundingCalls(organizationId: string, fundingProgramId: string): Promise<FundingCallDto[]> {
  const program = await db.fundingProgram.findFirst({ where: { organizationId, id: fundingProgramId }, select: { id: true } });
  if (!program) throw new ResourceNotFoundError("FUNDING_PROGRAM_NOT_FOUND");
  const records = await db.fundingCall.findMany({ where: { organizationId, fundingProgramId }, select: callSelect, orderBy: [{ createdAt: "desc" }, { title: "asc" }] });
  return records.map(serializeCall);
}

export async function getFundingCall(organizationId: string, fundingProgramId: string, callId: string): Promise<FundingCallDto | null> {
  const record = await db.fundingCall.findFirst({ where: { organizationId, fundingProgramId, id: callId }, select: callSelect });
  return record ? serializeCall(record) : null;
}

export async function createFundingCall(organizationId: string, fundingProgramId: string, rawInput: CreateFundingCallInput): Promise<FundingCallDto> {
  const input = createFundingCallSchema.parse(rawInput);
  if (input.applicationsEnabled && input.status === "RESULT_PUBLISHED") throw new DomainConflictError("CALL_PUBLICATION_REQUIRED");
  return db.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "FundingProgram" WHERE "organizationId" = ${organizationId} AND "id" = ${fundingProgramId} FOR UPDATE`;
    const program = await transaction.fundingProgram.findFirst({ where: { organizationId, id: fundingProgramId }, select: { status: true } });
    if (!program) throw new ResourceNotFoundError("FUNDING_PROGRAM_NOT_FOUND");
    if (!["DRAFT", "ACTIVE"].includes(program.status)) throw new DomainConflictError("PROGRAM_NOT_ELIGIBLE_FOR_CALL");
    const record = await transaction.fundingCall.create({ data: { ...input, organizationId, fundingProgramId, sourceUrl: input.sourceUrl ?? null, sourceCheckedAt: input.sourceUrl ? new Date() : null }, select: callSelect });
    return serializeCall(record);
  });
}

export async function updateFundingCall(organizationId: string, fundingProgramId: string, callId: string, rawInput: UpdateFundingCallInput): Promise<FundingCallDto> {
  const input = updateFundingCallSchema.parse(rawInput);
  return db.$transaction(async (transaction) => {
    await lockCall(transaction, organizationId, fundingProgramId, callId);
    const current = await transaction.fundingCall.findFirst({ where: { organizationId, fundingProgramId, id: callId }, select: { status: true, sourceUrl: true, applicationStartsAt: true, applicationEndsAt: true, applicationsEnabled: true, resultsPublishedAt: true } });
    if (!current) throw new ResourceNotFoundError("FUNDING_CALL_NOT_FOUND");
    if (current.status === "ARCHIVED") throw new DomainConflictError("FUNDING_CALL_ARCHIVED");
    if (input.status !== undefined) assertCallStatusTransition(current.status, input.status);
    if (input.status === "RESULT_PUBLISHED" && current.applicationsEnabled && !current.resultsPublishedAt) throw new DomainConflictError("CALL_PUBLICATION_REQUIRED");
    if (input.applicationsEnabled !== undefined && input.applicationsEnabled !== current.applicationsEnabled && ["IN_REVIEW", "RESULT_PUBLISHED", "CLOSED"].includes(current.status)) throw new DomainConflictError("CALL_APPLICATION_SETTINGS_FROZEN");
    const startsAt = input.applicationStartsAt !== undefined ? input.applicationStartsAt : current.applicationStartsAt;
    const endsAt = input.applicationEndsAt !== undefined ? input.applicationEndsAt : current.applicationEndsAt;
    if (startsAt && endsAt && endsAt < startsAt) throw new DomainConflictError("FUNDING_CALL_DATE_RANGE_INVALID");
    await transaction.fundingCall.updateMany({ where: { organizationId, fundingProgramId, id: callId }, data: { ...input, ...(input.sourceUrl !== undefined && input.sourceUrl !== current.sourceUrl ? { sourceCheckedAt: input.sourceUrl ? new Date() : null } : {}) } });
    const record = await transaction.fundingCall.findFirst({ where: { organizationId, fundingProgramId, id: callId }, select: callSelect });
    if (!record) throw new ResourceNotFoundError("FUNDING_CALL_NOT_FOUND");
    return serializeCall(record);
  });
}

export async function addFundingCallDocument(organizationId: string, fundingProgramId: string, callId: string, input: CreateFundingCallDocumentInput): Promise<FundingCallDto> {
  return db.$transaction(async (transaction) => {
    await lockCall(transaction, organizationId, fundingProgramId, callId);
    const current = await transaction.fundingCall.findFirst({ where: { organizationId, fundingProgramId, id: callId }, select: { status: true } });
    if (!current) throw new ResourceNotFoundError("FUNDING_CALL_NOT_FOUND");
    if (current.status === "ARCHIVED") throw new DomainConflictError("FUNDING_CALL_ARCHIVED");
    await transaction.fundingCallDocument.create({ data: { ...input, organizationId, fundingCallId: callId } });
    const record = await transaction.fundingCall.findFirst({ where: { organizationId, fundingProgramId, id: callId }, select: callSelect });
    if (!record) throw new ResourceNotFoundError("FUNDING_CALL_NOT_FOUND");
    return serializeCall(record);
  });
}

function lockCall(transaction: Prisma.TransactionClient, organizationId: string, fundingProgramId: string, callId: string) {
  return transaction.$queryRaw`SELECT "id" FROM "FundingCall" WHERE "organizationId" = ${organizationId} AND "fundingProgramId" = ${fundingProgramId} AND "id" = ${callId} FOR UPDATE`;
}
