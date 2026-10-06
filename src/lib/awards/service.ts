import { Prisma, type AwardStatus } from "@prisma/client";
import { assertActiveOrganizationAccess } from "@/lib/auth/authorization";
import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { projectAccessWhere, requireProjectAccess } from "@/lib/auth/participant-access";
import type { OrganizationRole } from "@/lib/domain";
import { db } from "@/lib/db";
import { notifyAwardManagers } from "@/lib/notifications/events";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import { calendarToday } from "@/lib/execution/state";
import { awardDetailSelect, awardSummarySelect, institutionAwardDetailSelect, institutionAwardSummarySelect, dateOnly, serializeAwardDetail, serializeAwardSummary, serializeSubmission, submissionSelect, type AwardDetailDto, type CallExecutionDto, type OrganizationExecutionDto } from "@/lib/awards/read-model";
import { createAwardDocumentSchema, createAwardSchema, createDisbursementSchema, createObligationSchema, rescheduleObligationSchema, reviewSubmissionSchema, saveSubmissionSchema, submitSubmissionSchema, transitionAwardSchema, updateAwardSchema, updateDisbursementSchema, updateObligationSchema, waiveObligationSchema, type CreateAwardInput, type CreateObligationInput, type ReviewSubmissionInput, type SaveSubmissionInput, type TransitionAwardInput, type UpdateAwardInput, type UpdateObligationInput } from "@/lib/awards/schemas";
export type { AwardDetailDto, AwardSummaryDto, CallExecutionDto, OrganizationExecutionDto } from "@/lib/awards/read-model";

export type OrganizationAccess = Awaited<ReturnType<typeof requireOrganizationAccess>>;
type Client = Prisma.TransactionClient;
const date = (value: string | null) => value ? new Date(`${value}T00:00:00Z`) : null;
const pageNumber = (value = 1) => Number.isFinite(value) ? Math.max(1, Math.min(10000, Math.floor(value))) : 1;
const PAGE_SIZE = 40;
const transitions: Record<AwardStatus, AwardStatus[]> = { PREPARING: ["ACTIVE", "CANCELLED"], ACTIVE: ["SUSPENDED", "COMPLETED", "TERMINATED"], SUSPENDED: ["ACTIVE", "COMPLETED", "TERMINATED"], COMPLETED: [], TERMINATED: [], CANCELLED: [] };

export async function requireAwardInstitutionRole(client: Client, access: OrganizationAccess, minimumRole?: OrganizationRole) {
  const organizationId = access.organization.id;
  const userId = access.auth.user.id;
  await client.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId} FOR SHARE`;
  await client.$queryRaw`SELECT "id" FROM "OrganizationMembership" WHERE "organizationId" = ${organizationId} AND "userId" = ${userId} FOR SHARE`;
  const membership = await client.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId, userId } }, select: { status: true, role: true, organization: { select: { status: true } } } });
  if (!membership) throw new ResourceNotFoundError("ORGANIZATION_NOT_FOUND");
  assertActiveOrganizationAccess({ membershipStatus: membership.status, organizationStatus: membership.organization.status, role: membership.role, minimumRole });
  return { organizationId, userId };
}
async function lockAward(client: Client, organizationId: string, awardId: string) {
  await client.$queryRaw`SELECT "id" FROM "Award" WHERE "organizationId" = ${organizationId} AND "id" = ${awardId} FOR UPDATE`;
  const award = await client.award.findFirst({ where: { organizationId, id: awardId } });
  if (!award) throw new ResourceNotFoundError("AWARD_NOT_FOUND");
  return award;
}
function requireMutableAward(status: AwardStatus) {
  if (!["PREPARING", "ACTIVE", "SUSPENDED"].includes(status)) throw new DomainConflictError("AWARD_TERMINAL");
}
function checkRevision(actual: number, expected: number) {
  if (actual !== expected) throw new DomainConflictError("EXECUTION_REVISION_CONFLICT");
}
async function lockObligation(client: Client, organizationId: string, awardId: string, obligationId: string) {
  await client.$queryRaw`SELECT "id" FROM "AwardObligation" WHERE "organizationId" = ${organizationId} AND "awardId" = ${awardId} AND "id" = ${obligationId} FOR UPDATE`;
  const obligation = await client.awardObligation.findFirst({ where: { organizationId, awardId, id: obligationId } });
  if (!obligation) throw new ResourceNotFoundError("AWARD_OBLIGATION_NOT_FOUND");
  return obligation;
}
function termData(input: ReturnType<typeof updateAwardSchema.parse> | ReturnType<typeof createAwardSchema.parse>) {
  return { agreementNumber: input.agreementNumber, approvedAmount: input.approvedAmount === null ? null : new Prisma.Decimal(input.approvedAmount), counterpartAmount: input.counterpartAmount === null ? null : new Prisma.Decimal(input.counterpartAmount), signedAt: date(input.signedAt), startsAt: date(input.startsAt), endsAt: date(input.endsAt) };
}
function obligationData(input: ReturnType<typeof createObligationSchema.parse>) {
  return { ...input, periodStartsAt: date(input.periodStartsAt), periodEndsAt: date(input.periodEndsAt), dueAt: date(input.dueAt) };
}

export async function createAward(access: OrganizationAccess, programId: string, callId: string, rawInput: CreateAwardInput) {
  const input = createAwardSchema.parse(rawInput);
  const id = await db.$transaction(async (client) => {
    const { organizationId, userId } = await requireAwardInstitutionRole(client, access, "MANAGER");
    await client.$queryRaw`SELECT "id" FROM "FundingCall" WHERE "organizationId" = ${organizationId} AND "fundingProgramId" = ${programId} AND "id" = ${callId} FOR UPDATE`;
    const call = await client.fundingCall.findFirst({ where: { organizationId, fundingProgramId: programId, id: callId }, select: { resultsPublishedAt: true } });
    if (!call) throw new ResourceNotFoundError("FUNDING_CALL_NOT_FOUND");
    if (!call.resultsPublishedAt) throw new DomainConflictError("AWARD_RESULTS_NOT_PUBLISHED");
    const application = await client.application.findFirst({ where: { organizationId, fundingCallId: callId, id: input.applicationId, status: "DECIDED", decision: "SELECTED", withdrawnAt: null }, select: { id: true } });
    if (!application) throw new DomainConflictError("AWARD_APPLICATION_NOT_ELIGIBLE");
    if (await client.award.findUnique({ where: { organizationId_applicationId: { organizationId, applicationId: application.id } }, select: { id: true } })) throw new DomainConflictError("AWARD_ALREADY_EXISTS");
    const award = await client.award.create({ data: { organizationId, fundingCallId: callId, applicationId: application.id, createdByUserId: userId, ...termData(input), statusHistory: { create: { toStatus: "PREPARING", awardRevision: 1, changedByUserId: userId } } } });
    return award.id;
  });
  return getInstitutionAward(access, id);
}
export async function getInstitutionAward(access: OrganizationAccess, awardId: string): Promise<AwardDetailDto> {
  const { organizationId } = await requireAwardInstitutionRole(db, access);
  const record = await db.award.findFirst({ where: { organizationId, id: awardId }, select: institutionAwardDetailSelect });
  if (!record) throw new ResourceNotFoundError("AWARD_NOT_FOUND");
  const internalNotes = await db.awardSubmission.findMany({ where: { organizationId, awardId, status: "SUBMITTED", reviewStatus: { not: "PENDING" } }, select: { id: true, internalNote: true }, orderBy: { submittedAt: "desc" }, take: 200 });
  return { ...serializeAwardDetail(record), internalNotes };
}
export async function updateAward(access: OrganizationAccess, awardId: string, rawInput: UpdateAwardInput) {
  const input = updateAwardSchema.parse(rawInput);
  await db.$transaction(async (client) => {
    const { organizationId } = await requireAwardInstitutionRole(client, access, "MANAGER");
    const award = await lockAward(client, organizationId, awardId); checkRevision(award.revision, input.revision);
    if (award.status !== "PREPARING") throw new DomainConflictError("AWARD_TERMS_FROZEN");
    await client.award.update({ where: { organizationId_id: { organizationId, id: awardId } }, data: { ...termData(input), revision: { increment: 1 } } });
  });
  return getInstitutionAward(access, awardId);
}
export async function transitionAward(access: OrganizationAccess, awardId: string, rawInput: TransitionAwardInput) {
  const input = transitionAwardSchema.parse(rawInput);
  await db.$transaction(async (client) => {
    const { organizationId, userId } = await requireAwardInstitutionRole(client, access, "MANAGER");
    const award = await lockAward(client, organizationId, awardId); checkRevision(award.revision, input.revision);
    if (!transitions[award.status].includes(input.status)) throw new DomainConflictError("AWARD_STATUS_TRANSITION_INVALID");
    if (input.status === "ACTIVE" && !award.startsAt) throw new DomainConflictError("AWARD_START_REQUIRED");
    if (input.status === "COMPLETED") {
      const unresolved = await client.awardObligation.count({ where: { organizationId, awardId, required: true, waivedAt: null, submissions: { none: { status: "SUBMITTED", reviewStatus: "APPROVED" } } } });
      if (unresolved) throw new DomainConflictError("AWARD_REQUIRED_OBLIGATIONS_UNRESOLVED");
    }
    const now = new Date();
    await client.award.update({ where: { organizationId_id: { organizationId, id: awardId } }, data: { status: input.status, revision: { increment: 1 }, activatedAt: input.status === "ACTIVE" ? award.activatedAt ?? now : award.activatedAt, completedAt: input.status === "COMPLETED" ? now : null, terminatedAt: input.status === "TERMINATED" ? now : null, statusHistory: { create: { fromStatus: award.status, toStatus: input.status, awardRevision: award.revision + 1, reason: input.reason, changedByUserId: userId } } } });
    if (["ACTIVE", "SUSPENDED", "COMPLETED", "TERMINATED"].includes(input.status)) await notifyAwardManagers(client, { organizationId, awardId, actorUserId: userId, kind: "AWARD_STATUS_CHANGED", dedupeKey: `award-status:${awardId}:${award.revision + 1}`, title: ({ ACTIVE: "A execução do apoio foi ativada.", SUSPENDED: "A execução do apoio foi suspensa.", COMPLETED: "A execução do apoio foi concluída.", TERMINATED: "A execução do apoio foi encerrada." } as Record<string, string>)[input.status] });
  });
  return getInstitutionAward(access, awardId);
}

export async function createObligation(access: OrganizationAccess, awardId: string, rawInput: CreateObligationInput) {
  const input = createObligationSchema.parse(rawInput);
  await db.$transaction(async (client) => {
    const { organizationId, userId } = await requireAwardInstitutionRole(client, access, "MANAGER");
    const award = await lockAward(client, organizationId, awardId); requireMutableAward(award.status);
    if (await client.awardObligation.count({ where: { organizationId, awardId } }) >= 200) throw new DomainConflictError("AWARD_OBLIGATION_LIMIT");
    await client.awardObligation.create({ data: { organizationId, awardId, createdByUserId: userId, ...obligationData(input) } });
  });
  return getInstitutionAward(access, awardId);
}
export async function updateObligation(access: OrganizationAccess, awardId: string, obligationId: string, rawInput: UpdateObligationInput) {
  const input = updateObligationSchema.parse(rawInput);
  await db.$transaction(async (client) => {
    const { organizationId } = await requireAwardInstitutionRole(client, access, "MANAGER");
    const award = await lockAward(client, organizationId, awardId); requireMutableAward(award.status);
    const obligation = await lockObligation(client, organizationId, awardId, obligationId); checkRevision(obligation.revision, input.revision);
    if (obligation.waivedAt || await client.awardSubmission.count({ where: { organizationId, awardId, obligationId, status: "SUBMITTED" } })) throw new DomainConflictError("AWARD_OBLIGATION_FROZEN");
    await client.awardObligation.update({ where: { organizationId_awardId_id: { organizationId, awardId, id: obligationId } }, data: { ...obligationData(input), revision: { increment: 1 } } });
  });
  return getInstitutionAward(access, awardId);
}
export async function rescheduleObligation(access: OrganizationAccess, awardId: string, obligationId: string, rawInput: Prisma.JsonObject) {
  const input = rescheduleObligationSchema.parse(rawInput);
  await db.$transaction(async (client) => {
    const { organizationId, userId } = await requireAwardInstitutionRole(client, access, "MANAGER");
    const award = await lockAward(client, organizationId, awardId); requireMutableAward(award.status);
    const obligation = await lockObligation(client, organizationId, awardId, obligationId); checkRevision(obligation.revision, input.revision);
    if (obligation.waivedAt || await client.awardSubmission.count({ where: { organizationId, awardId, obligationId, reviewStatus: "APPROVED" } })) throw new DomainConflictError("AWARD_OBLIGATION_RESOLVED");
    if (dateOnly(obligation.dueAt) === input.dueAt) throw new DomainConflictError("AWARD_DEADLINE_UNCHANGED");
    // The audit row is created before the update so the deadline guard can verify the exact change.
    await client.awardObligationDueDateHistory.create({ data: { organizationId, awardId, obligationId, oldDueAt: obligation.dueAt, newDueAt: date(input.dueAt), reason: input.reason, changedByUserId: userId } });
    await client.awardObligation.update({ where: { organizationId_awardId_id: { organizationId, awardId, id: obligationId } }, data: { dueAt: date(input.dueAt), revision: { increment: 1 } } });
  });
  return getInstitutionAward(access, awardId);
}
export async function waiveObligation(access: OrganizationAccess, awardId: string, obligationId: string, rawInput: Prisma.JsonObject) {
  const input = waiveObligationSchema.parse(rawInput);
  await db.$transaction(async (client) => {
    const { organizationId, userId } = await requireAwardInstitutionRole(client, access, "MANAGER");
    const award = await lockAward(client, organizationId, awardId); requireMutableAward(award.status);
    const obligation = await lockObligation(client, organizationId, awardId, obligationId); checkRevision(obligation.revision, input.revision);
    if (obligation.waivedAt || await client.awardSubmission.count({ where: { organizationId, awardId, obligationId, reviewStatus: "APPROVED" } })) throw new DomainConflictError("AWARD_OBLIGATION_RESOLVED");
    await client.awardObligation.update({ where: { organizationId_awardId_id: { organizationId, awardId, id: obligationId } }, data: { waivedAt: new Date(), waivedByUserId: userId, waiverReason: input.reason, revision: { increment: 1 } } });
  });
  return getInstitutionAward(access, awardId);
}

async function participantAward(client: Client, userId: string, awardId: string, manage = false) {
  const record = await client.award.findFirst({ where: { id: awardId, organization: { status: "ACTIVE" }, application: { project: projectAccessWhere(userId) } }, select: { organizationId: true, application: { select: { projectId: true } } } });
  if (!record) throw new ResourceNotFoundError("AWARD_NOT_FOUND");
  if (manage && client !== db) {
    await client.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${record.organizationId} AND "status" = 'ACTIVE' FOR SHARE`;
    if (!await client.organization.findFirst({ where: { id: record.organizationId, status: "ACTIVE" }, select: { id: true } })) throw new ResourceNotFoundError("AWARD_NOT_FOUND");
  }
  const project = await requireProjectAccess(userId, record.application.projectId, manage, client);
  return { organizationId: record.organizationId, project };
}
export async function getPersonalAward(userId: string, awardId: string): Promise<AwardDetailDto> {
  const { organizationId, project } = await participantAward(db, userId, awardId);
  // Private review notes and institution-only documents never enter the participant query.
  const record = await db.award.findFirst({ where: { organizationId, id: awardId, organization: { status: "ACTIVE" }, application: { project: projectAccessWhere(userId) } }, select: { ...awardDetailSelect, documents: { ...awardDetailSelect.documents, where: { visibleToParticipant: true } } } });
  if (!record) throw new ResourceNotFoundError("AWARD_NOT_FOUND");
  return { ...serializeAwardDetail(record), canManage: project.canManage };
}
export async function listPersonalAwards(userId: string, options: { projectId?: string; page?: number } = {}) {
  if (options.projectId) await requireProjectAccess(userId, options.projectId);
  const page = pageNumber(options.page);
  const where: Prisma.AwardWhereInput = { organization: { status: "ACTIVE" }, application: { projectId: options.projectId, project: projectAccessWhere(userId) } };
  const [records, total] = await Promise.all([db.award.findMany({ where, select: awardSummarySelect, orderBy: { createdAt: "desc" }, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }), db.award.count({ where })]);
  return { awards: records.map((record) => serializeAwardSummary(record)), page, pageSize: PAGE_SIZE, total };
}
export async function saveSubmissionDraft(userId: string, awardId: string, obligationId: string, rawInput: SaveSubmissionInput) {
  const input = saveSubmissionSchema.parse(rawInput);
  return db.$transaction(async (client) => {
    const { organizationId } = await participantAward(client, userId, awardId, true);
    const award = await lockAward(client, organizationId, awardId);
    if (award.status !== "ACTIVE") throw new DomainConflictError("AWARD_SUBMISSIONS_NOT_ACTIVE");
    const obligation = await lockObligation(client, organizationId, awardId, obligationId);
    if (obligation.waivedAt) throw new DomainConflictError("AWARD_OBLIGATION_RESOLVED");
    const latest = await client.awardSubmission.findFirst({ where: { organizationId, awardId, obligationId }, orderBy: { version: "desc" } });
    if (latest?.status === "SUBMITTED" && latest.reviewStatus !== "CHANGES_REQUESTED") throw new DomainConflictError("AWARD_NEW_REVISION_NOT_ALLOWED");
    if (latest && latest.status === "DRAFT") {
      if (input.draftId && input.draftId !== latest.id) throw new DomainConflictError("EXECUTION_REVISION_CONFLICT");
      checkRevision(latest.revision, input.revision);
      await client.awardSubmissionEvidence.deleteMany({ where: { organizationId, awardId, submissionId: latest.id } });
      const updated = await client.awardSubmission.update({ where: { organizationId_awardId_id: { organizationId, awardId, id: latest.id } }, data: { summary: input.summary, details: input.details, revision: { increment: 1 }, evidence: { create: input.evidence } }, select: submissionSelect });
      return serializeSubmission(updated);
    }
    if (input.revision !== 0 || input.draftId) throw new DomainConflictError("EXECUTION_REVISION_CONFLICT");
    if ((latest?.version ?? 0) >= 100) throw new DomainConflictError("AWARD_SUBMISSION_LIMIT");
    const draft = await client.awardSubmission.create({ data: { organizationId, awardId, obligationId, version: (latest?.version ?? 0) + 1, summary: input.summary, details: input.details, createdByUserId: userId, evidence: { create: input.evidence } }, select: submissionSelect });
    return serializeSubmission(draft);
  });
}
export async function submitSubmission(userId: string, awardId: string, submissionId: string, rawInput: Prisma.JsonObject) {
  const input = submitSubmissionSchema.parse(rawInput);
  return db.$transaction(async (client) => {
    const { organizationId } = await participantAward(client, userId, awardId, true);
    const award = await lockAward(client, organizationId, awardId);
    if (award.status !== "ACTIVE") throw new DomainConflictError("AWARD_SUBMISSIONS_NOT_ACTIVE");
    const submission = await client.awardSubmission.findFirst({ where: { organizationId, awardId, id: submissionId } });
    if (!submission) throw new ResourceNotFoundError("AWARD_SUBMISSION_NOT_FOUND");
    const obligation = await lockObligation(client, organizationId, awardId, submission.obligationId);
    if (obligation.waivedAt) throw new DomainConflictError("AWARD_OBLIGATION_RESOLVED");
    if (submission.status !== "DRAFT") throw new DomainConflictError("AWARD_SUBMISSION_FROZEN");
    checkRevision(submission.revision, input.revision);
    if (submission.summary.trim().length < 10) throw new DomainConflictError("AWARD_SUBMISSION_SUMMARY_REQUIRED");
    return serializeSubmission(await client.awardSubmission.update({ where: { organizationId_awardId_id: { organizationId, awardId, id: submissionId } }, data: { status: "SUBMITTED", submittedAt: new Date(), submittedByUserId: userId, revision: { increment: 1 } }, select: submissionSelect }));
  });
}
export async function reviewSubmission(access: OrganizationAccess, awardId: string, submissionId: string, rawInput: ReviewSubmissionInput) {
  const input = reviewSubmissionSchema.parse(rawInput);
  await db.$transaction(async (client) => {
    const { organizationId, userId } = await requireAwardInstitutionRole(client, access, "ANALYST");
    const award = await lockAward(client, organizationId, awardId);
    if (!["ACTIVE", "SUSPENDED"].includes(award.status)) throw new DomainConflictError("AWARD_REVIEW_NOT_ACTIVE");
    const submission = await client.awardSubmission.findFirst({ where: { organizationId, awardId, id: submissionId } });
    if (!submission) throw new ResourceNotFoundError("AWARD_SUBMISSION_NOT_FOUND");
    const obligation = await lockObligation(client, organizationId, awardId, submission.obligationId);
    if (obligation.waivedAt) throw new DomainConflictError("AWARD_OBLIGATION_RESOLVED");
    if (submission.status !== "SUBMITTED") throw new DomainConflictError("AWARD_SUBMISSION_NOT_SUBMITTED");
    if (submission.reviewStatus !== "PENDING") throw new DomainConflictError("AWARD_REVIEW_FROZEN");
    await client.awardSubmission.update({ where: { organizationId_awardId_id: { organizationId, awardId, id: submissionId } }, data: { reviewStatus: input.decision, feedback: input.feedback, internalNote: input.internalNote, reviewedAt: new Date(), reviewedByUserId: userId } });
    if (input.decision === "APPROVED" || input.decision === "CHANGES_REQUESTED") await notifyAwardManagers(client, { organizationId, awardId, actorUserId: userId, kind: input.decision === "APPROVED" ? "AWARD_REVIEW_APPROVED" : "AWARD_REVIEW_CHANGES_REQUESTED", dedupeKey: `award-review:${submissionId}:${input.decision}`, title: input.decision === "APPROVED" ? "Uma entrega do apoio foi aprovada." : "Uma entrega do apoio precisa de ajustes." });
  });
  return getInstitutionAward(access, awardId);
}

export async function createDisbursement(access: OrganizationAccess, awardId: string, rawInput: Prisma.JsonObject) {
  const input = createDisbursementSchema.parse(rawInput);
  await db.$transaction(async (client) => {
    const { organizationId, userId } = await requireAwardInstitutionRole(client, access, "MANAGER");
    const award = await lockAward(client, organizationId, awardId); requireMutableAward(award.status);
    if (await client.awardDisbursement.count({ where: { organizationId, awardId } }) >= 200) throw new DomainConflictError("AWARD_DISBURSEMENT_LIMIT");
    await client.awardDisbursement.create({ data: { organizationId, awardId, createdByUserId: userId, ...input, amount: new Prisma.Decimal(input.amount), plannedFor: date(input.plannedFor) } });
  });
  return getInstitutionAward(access, awardId);
}
export async function updateDisbursement(access: OrganizationAccess, awardId: string, disbursementId: string, rawInput: Prisma.JsonObject) {
  const input = updateDisbursementSchema.parse(rawInput);
  await db.$transaction(async (client) => {
    const { organizationId, userId } = await requireAwardInstitutionRole(client, access, "MANAGER");
    const award = await lockAward(client, organizationId, awardId); requireMutableAward(award.status);
    const disbursement = await client.awardDisbursement.findFirst({ where: { organizationId, awardId, id: disbursementId } });
    if (!disbursement) throw new ResourceNotFoundError("AWARD_DISBURSEMENT_NOT_FOUND");
    if (disbursement.status !== "PLANNED") throw new DomainConflictError("AWARD_DISBURSEMENT_FROZEN");
    checkRevision(disbursement.revision, input.revision);
    await client.awardDisbursement.updateMany({ where: { organizationId, awardId, id: disbursementId }, data: { ...input, amount: new Prisma.Decimal(input.amount), plannedFor: date(input.plannedFor), paidAt: input.status === "PAID" ? date(input.paidAt) : null, paidByUserId: input.status === "PAID" ? userId : null, paidRecordedAt: input.status === "PAID" ? new Date() : null, revision: { increment: 1 } } });
  });
  return getInstitutionAward(access, awardId);
}
export async function createAwardDocument(access: OrganizationAccess, awardId: string, rawInput: Prisma.JsonObject) {
  const input = createAwardDocumentSchema.parse(rawInput);
  await db.$transaction(async (client) => {
    const { organizationId, userId } = await requireAwardInstitutionRole(client, access, "MANAGER");
    const award = await lockAward(client, organizationId, awardId); requireMutableAward(award.status);
    if (await client.awardDocument.count({ where: { organizationId, awardId } }) >= 100) throw new DomainConflictError("AWARD_DOCUMENT_LIMIT");
    await client.awardDocument.create({ data: { organizationId, awardId, createdByUserId: userId, ...input } });
  });
  return getInstitutionAward(access, awardId);
}

export async function listCallExecution(access: OrganizationAccess, programId: string, callId: string, rawPage = 1): Promise<CallExecutionDto> {
  const { organizationId } = await requireAwardInstitutionRole(db, access); const page = pageNumber(rawPage);
  const call = await db.fundingCall.findFirst({ where: { organizationId, fundingProgramId: programId, id: callId }, select: { id: true, title: true, resultsPublishedAt: true } });
  if (!call) throw new ResourceNotFoundError("FUNDING_CALL_NOT_FOUND");
  const where: Prisma.ApplicationWhereInput = { organizationId, fundingCallId: callId, status: "DECIDED", decision: "SELECTED" };
  const [records, total, prepared, active] = await Promise.all([db.application.findMany({ where, select: { id: true, projectNameSnapshot: true, teamNameSnapshot: true, award: { select: institutionAwardSummarySelect }, enrollments: { select: { id: true, cohortId: true, ventureId: true }, take: 1 } }, orderBy: { projectNameSnapshot: "asc" }, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }), db.application.count({ where }), db.award.count({ where: { organizationId, fundingCallId: callId } }), db.award.count({ where: { organizationId, fundingCallId: callId, status: "ACTIVE" } })]);
  return { applications: records.map((record) => ({ ...record, award: record.award ? serializeAwardSummary(record.award) : null })), page, pageSize: PAGE_SIZE, total, call: { ...call, resultsPublishedAt: call.resultsPublishedAt?.toISOString() ?? null }, counts: { selected: total, prepared, active } };
}
export type ExecutionAttention = "OVERDUE" | "REVIEW" | "CHANGES" | "DISBURSEMENT" | "ENDING" | "PREPARING";
export async function listOrganizationExecution(access: OrganizationAccess, options: { page?: number; status?: AwardStatus; programId?: string; callId?: string; attention?: ExecutionAttention } = {}): Promise<OrganizationExecutionDto> {
  const { organizationId } = await requireAwardInstitutionRole(db, access); const page = pageNumber(options.page);
  const where: Prisma.AwardWhereInput = { organizationId, status: options.status, fundingCallId: options.callId, fundingCall: options.programId ? { fundingProgramId: options.programId } : undefined };
  const today = date(calendarToday())!; const soon = new Date(today.getTime() + 30 * 86400000);
  const base = { organizationId, fundingCallId: options.callId, fundingCall: options.programId ? { fundingProgramId: options.programId } : undefined };
  const activeBase: Prisma.AwardWhereInput = { ...base, status: { in: ["ACTIVE", "SUSPENDED"] } };
  const activeAttention: Prisma.AwardWhereInput = { status: { in: ["ACTIVE", "SUSPENDED"] } };
  const attentionWhere: Partial<Record<ExecutionAttention, Prisma.AwardWhereInput>> = {
    PREPARING: { status: "PREPARING" },
    OVERDUE: { ...activeAttention, obligations: { some: { dueAt: { lt: today }, waivedAt: null, submissions: { none: { status: "SUBMITTED", reviewStatus: { in: ["APPROVED", "PENDING"] } } } } } },
    REVIEW: { ...activeAttention, obligations: { some: { waivedAt: null, submissions: { some: { status: "SUBMITTED", reviewStatus: "PENDING" } } } } },
    CHANGES: { ...activeAttention, obligations: { some: { waivedAt: null, AND: [{ submissions: { some: { reviewStatus: "CHANGES_REQUESTED" } } }, { submissions: { none: { status: "SUBMITTED", reviewStatus: { in: ["APPROVED", "PENDING", "REJECTED"] } } } }] } } },
    DISBURSEMENT: { ...activeAttention, disbursements: { some: { status: "PLANNED" } } },
    ENDING: { status: "ACTIVE", endsAt: { gte: today, lte: soon } },
  };
  if (options.attention && attentionWhere[options.attention]) where.AND = [attentionWhere[options.attention]!];
  const [records, total, preparing, active, pendingReviews, overdueObligations, changesRequested, plannedDisbursements, endingSoon, awaitingPreparation, awaitingCalls] = await Promise.all([
    db.award.findMany({ where, select: institutionAwardSummarySelect, orderBy: [{ endsAt: "asc" }, { createdAt: "desc" }], take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }), db.award.count({ where }),
    db.award.count({ where: { ...base, status: "PREPARING" } }), db.award.count({ where: { ...base, status: "ACTIVE" } }),
    db.awardSubmission.count({ where: { organizationId, status: "SUBMITTED", reviewStatus: "PENDING", obligation: { award: activeBase, waivedAt: null } } }),
    db.awardObligation.count({ where: { organizationId, award: activeBase, dueAt: { lt: today }, waivedAt: null, submissions: { none: { status: "SUBMITTED", reviewStatus: { in: ["APPROVED", "PENDING"] } } } } }),
    db.awardObligation.count({ where: { organizationId, award: activeBase, waivedAt: null, AND: [{ submissions: { some: { reviewStatus: "CHANGES_REQUESTED" } } }, { submissions: { none: { status: "SUBMITTED", reviewStatus: { in: ["APPROVED", "PENDING", "REJECTED"] } } } }] } }),
    db.awardDisbursement.count({ where: { organizationId, status: "PLANNED", award: activeBase } }), db.award.count({ where: { ...base, status: "ACTIVE", endsAt: { gte: today, lte: soon } } }),
    db.application.count({ where: { organizationId, fundingCallId: options.callId, fundingCall: { fundingProgramId: options.programId, resultsPublishedAt: { not: null } }, decision: "SELECTED", status: "DECIDED", award: null } }),
    db.fundingCall.findMany({ where: { organizationId, id: options.callId, fundingProgramId: options.programId, resultsPublishedAt: { not: null }, applications: { some: { status: "DECIDED", decision: "SELECTED", award: null } } }, select: { id: true, title: true, fundingProgramId: true, fundingProgram: { select: { name: true } }, _count: { select: { applications: { where: { status: "DECIDED", decision: "SELECTED", award: null } } } } }, orderBy: { resultsPublishedAt: "desc" }, take: 20 }),
  ]);
  return { awards: records.map((record) => serializeAwardSummary(record)), page, pageSize: PAGE_SIZE, total, awaitingCalls: awaitingCalls.map((call) => ({ id: call.id, title: call.title, fundingProgramId: call.fundingProgramId, programName: call.fundingProgram.name, selected: call._count.applications })), counts: { preparing, active, pendingReviews, overdueObligations, changesRequested, plannedDisbursements, endingSoon, awaitingPreparation } };
}
