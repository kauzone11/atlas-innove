import { Prisma, type FundingCall, type Application } from "@prisma/client";

import { AuthorizationError, assertActiveOrganizationAccess, hasAtLeastRole } from "@/lib/auth/authorization";
import { participantApplicationAccessWhere, projectAccessWhere, requireProjectAccess, requireTeamAccess } from "@/lib/auth/participant-access";
import { db } from "@/lib/db";
import { assertCohortCanReceiveEnrollment } from "@/lib/domain-invariants";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import { isEnrollmentEligibleAt } from "@/lib/observations/validation";
import { aggregateApplicationScore, rankApplications } from "@/lib/selection/score";
import { createApplicationSchema, updateApplicationSchema, criterionSchema, evaluationSchema, decisionSchema, enrollApplicationsSchema, type CreateApplicationInput, type UpdateApplicationInput, type CriterionInput, type EvaluationInput, type DecisionInput, type EnrollmentMapping } from "@/lib/selection/schemas";

type Client = Prisma.TransactionClient;
const callSelect = { id: true, title: true, callNumber: true, objective: true, status: true, applicationStartsAt: true, applicationEndsAt: true, applicationsEnabled: true, sourceUrl: true, resultsPublishedAt: true, organization: { select: { id: true, name: true } }, fundingProgram: { select: { id: true, name: true } } } as const;
const participantSelect = { id: true, organizationId: true, fundingCallId: true, projectId: true, teamId: true, submittedByUserId: true, revision: true, status: true, projectNameSnapshot: true, projectSummarySnapshot: true, projectDescriptionSnapshot: true, teamNameSnapshot: true, submittedAt: true, withdrawnAt: true, createdAt: true, updatedAt: true, decision: true, fundingCall: { select: callSelect }, enrollments: { select: { id: true, cohort: { select: { id: true, name: true } } } } } as const;
type ParticipantRecord = Prisma.ApplicationGetPayload<{ select: typeof participantSelect }>;
export type PersonalApplicationDto = ReturnType<typeof personalDto>;
export type ApplicationDto = PersonalApplicationDto;

function personalDto(record: ParticipantRecord, canManage: boolean) {
  return { id: record.id, projectId: record.projectId, teamId: record.teamId, revision: record.revision, status: record.status, projectNameSnapshot: record.projectNameSnapshot, projectSummarySnapshot: record.projectSummarySnapshot, projectDescriptionSnapshot: record.projectDescriptionSnapshot, teamNameSnapshot: record.teamNameSnapshot, submittedAt: record.submittedAt?.toISOString() ?? null, withdrawnAt: record.withdrawnAt?.toISOString() ?? null, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(), decision: record.fundingCall.resultsPublishedAt ? record.decision : null, canManage, enrollment: record.enrollments[0] ?? null, fundingCall: { ...record.fundingCall, applicationStartsAt: record.fundingCall.applicationStartsAt?.toISOString() ?? null, applicationEndsAt: record.fundingCall.applicationEndsAt?.toISOString() ?? null, resultsPublishedAt: record.fundingCall.resultsPublishedAt?.toISOString() ?? null } };
}

export async function requireApplicationParticipantAccess(userId: string, applicationId: string, manage = false, transaction: Client = db) {
  const record = await transaction.application.findFirst({ where: { id: applicationId, ...await participantApplicationAccessWhere(userId, transaction) } });
  if (!record) throw new ResourceNotFoundError("APPLICATION_NOT_FOUND");
  if (manage && !await canManageApplication(userId, record, transaction)) throw new AuthorizationError("APPLICATION_MANAGEMENT_FORBIDDEN");
  return record;
}

async function canManageApplication(userId: string, record: Pick<Application, "projectId" | "teamId">, transaction: Client = db): Promise<boolean> {
  try {
    if (transaction !== db) {
      const project = await transaction.project.findUnique({ where: { id: record.projectId }, select: { primaryTeamId: true } });
      const teamIds = [...new Set([project?.primaryTeamId, record.teamId].filter((id): id is string => Boolean(id)))].sort();
      for (const teamId of teamIds) await transaction.$queryRaw`SELECT "id" FROM "Team" WHERE "id" = ${teamId} FOR UPDATE`;
    }
    await requireProjectAccess(userId, record.projectId, true, transaction);
    if (record.teamId) await requireTeamAccess(userId, record.teamId, true, transaction);
    return true;
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof ResourceNotFoundError || error instanceof DomainConflictError) return false;
    throw error;
  }
}

export async function listPersonalApplications(userId: string): Promise<PersonalApplicationDto[]> {
  const records = await db.application.findMany({ where: await participantApplicationAccessWhere(userId), select: participantSelect, orderBy: { createdAt: "desc" } });
  const [projects, teams] = await Promise.all([
    db.project.findMany({ where: { id: { in: [...new Set(records.map((record) => record.projectId))] }, ...projectAccessWhere(userId) }, select: { id: true, archivedAt: true, status: true, memberships: { where: { userId, leftAt: null }, select: { role: true } }, primaryTeam: { select: { archivedAt: true, memberships: { where: { userId, status: "ACTIVE", leftAt: null }, select: { role: true } } } } } }),
    db.team.findMany({ where: { id: { in: records.map((record) => record.teamId).filter((id): id is string => Boolean(id)) }, archivedAt: null, memberships: { some: { userId, status: "ACTIVE", leftAt: null, role: { in: ["OWNER", "LEAD"] } } } }, select: { id: true } }),
  ]);
  const manageableProjects = new Set(projects.filter((project) => !project.archivedAt && project.status !== "ARCHIVED" && (project.memberships.some((membership) => ["OWNER", "LEAD"].includes(membership.role)) || (!project.primaryTeam?.archivedAt && project.primaryTeam?.memberships.some((membership) => ["OWNER", "LEAD"].includes(membership.role))))).map((project) => project.id));
  const manageableTeams = new Set(teams.map((team) => team.id));
  return records.map((record) => personalDto(record, manageableProjects.has(record.projectId) && (!record.teamId || manageableTeams.has(record.teamId))));
}

export async function getPersonalApplication(userId: string, applicationId: string): Promise<PersonalApplicationDto | null> {
  const record = await db.application.findFirst({ where: { id: applicationId, ...await participantApplicationAccessWhere(userId) }, select: participantSelect });
  return record ? personalDto(record, await canManageApplication(userId, record)) : null;
}

function applicationDeadline(call: Pick<FundingCall, "applicationEndsAt">): Date | null {
  if (!call.applicationEndsAt) return null;
  const end = call.applicationEndsAt;
  // Calendar dates are stored at UTC midnight; their deadline includes the entire stored calendar day.
  return end.getUTCHours() === 0 && end.getUTCMinutes() === 0 && end.getUTCSeconds() === 0 && end.getUTCMilliseconds() === 0 ? new Date(end.getTime() + 86400000 - 1) : end;
}

export function assertCallAcceptsApplications(call: Pick<FundingCall, "status" | "applicationsEnabled" | "applicationStartsAt" | "applicationEndsAt">, now = new Date()) {
  if (!call.applicationsEnabled || call.status !== "OPEN") throw new DomainConflictError("APPLICATION_CALL_NOT_OPEN");
  if (call.applicationStartsAt && now < call.applicationStartsAt) throw new DomainConflictError("APPLICATION_WINDOW_NOT_STARTED");
  const end = applicationDeadline(call);
  if (end && now > end) throw new DomainConflictError("APPLICATION_DEADLINE_PASSED");
}

async function lockCall(transaction: Client, organizationId: string, programId: string | null, callId: string) {
  if (programId) await transaction.$queryRaw`SELECT "id" FROM "FundingCall" WHERE "organizationId" = ${organizationId} AND "fundingProgramId" = ${programId} AND "id" = ${callId} FOR UPDATE`;
  else await transaction.$queryRaw`SELECT "id" FROM "FundingCall" WHERE "organizationId" = ${organizationId} AND "id" = ${callId} FOR UPDATE`;
}

async function requireCall(transaction: Client, organizationId: string, programId: string, callId: string) {
  const call = await transaction.fundingCall.findFirst({ where: { organizationId, fundingProgramId: programId, id: callId } });
  if (!call) throw new ResourceNotFoundError("FUNDING_CALL_NOT_FOUND");
  return call;
}

async function requireInstitutionRole(transaction: Client, userId: string, organizationId: string, minimumRole: "VIEWER" | "ANALYST" | "MANAGER") {
  // Role and organization revocation serialize with the entire authorized write transaction.
  if (transaction !== db) {
    await transaction.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId} FOR SHARE`;
    await transaction.$queryRaw`SELECT "id" FROM "OrganizationMembership" WHERE "organizationId" = ${organizationId} AND "userId" = ${userId} FOR SHARE`;
  }
  const membership = await transaction.organizationMembership.findFirst({ where: { organizationId, userId }, include: { organization: true } });
  if (!membership) throw new AuthorizationError("ORGANIZATION_ACCESS_DENIED");
  assertActiveOrganizationAccess({ organizationStatus: membership.organization.status, membershipStatus: membership.status, role: membership.role, minimumRole });
  return membership.role;
}

export async function requireInstitutionApplicationAccess(userId: string, organizationId: string, programId: string, callId: string, applicationId: string, minimumRole: "VIEWER" | "ANALYST" | "MANAGER" = "VIEWER", transaction: Client = db) {
  await requireInstitutionRole(transaction, userId, organizationId, minimumRole);
  await requireCall(transaction, organizationId, programId, callId);
  const application = await transaction.application.findFirst({ where: { organizationId, fundingCallId: callId, id: applicationId, submittedAt: { not: null }, status: { not: "DRAFT" } } });
  if (!application) throw new ResourceNotFoundError("APPLICATION_NOT_FOUND");
  return application;
}

export async function createPersonalApplication(userId: string, rawInput: CreateApplicationInput) {
  const input = createApplicationSchema.parse(rawInput);
  const id = await db.$transaction(async (transaction) => {
    const scopedCall = await transaction.fundingCall.findUnique({ where: { id: input.fundingCallId }, select: { organizationId: true } });
    if (!scopedCall) throw new ResourceNotFoundError("FUNDING_CALL_NOT_FOUND");
    if (input.organizationId && input.organizationId !== scopedCall.organizationId) throw new AuthorizationError("TENANT_SCOPE_MISMATCH");
    await transaction.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${scopedCall.organizationId} FOR SHARE`;
    await lockCall(transaction, scopedCall.organizationId, null, input.fundingCallId);
    const call = await transaction.fundingCall.findFirst({ where: { organizationId: scopedCall.organizationId, id: input.fundingCallId, organization: { status: "ACTIVE" } } });
    if (!call) throw new ResourceNotFoundError("FUNDING_CALL_NOT_FOUND");
    if (!call.publicListingEnabled && !await transaction.application.findFirst({ where: { fundingCallId: call.id, organizationId: call.organizationId, ...await participantApplicationAccessWhere(userId, transaction) }, select: { id: true } })) throw new ResourceNotFoundError("FUNDING_CALL_NOT_FOUND");
    assertCallAcceptsApplications(call);
    const project = await requireProjectAccess(userId, input.projectId, true, transaction);
    const teamId = input.teamId === undefined ? project.primaryTeamId : input.teamId;
    const team = teamId ? await requireTeamAccess(userId, teamId, true, transaction) : null;
    if (teamId && teamId !== project.primaryTeamId) throw new DomainConflictError("APPLICATION_TEAM_PROJECT_MISMATCH");
    const record = await transaction.application.create({ data: { organizationId: call.organizationId, fundingCallId: call.id, projectId: project.id, teamId, submittedByUserId: userId, projectNameSnapshot: project.name, projectSummarySnapshot: project.summary, projectDescriptionSnapshot: project.description, teamNameSnapshot: team?.name ?? null } });
    return record.id;
  });
  return (await getPersonalApplication(userId, id))!;
}

async function participantMutation(transaction: Client, userId: string, id: string, revision: number) {
  const initial = await transaction.application.findFirst({ where: { id, ...await participantApplicationAccessWhere(userId, transaction) }, select: { organizationId: true, fundingCallId: true } });
  if (!initial) throw new ResourceNotFoundError("APPLICATION_NOT_FOUND");
  await transaction.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${initial.organizationId} FOR SHARE`;
  await lockCall(transaction, initial.organizationId, null, initial.fundingCallId);
  await transaction.$queryRaw`SELECT "id" FROM "Application" WHERE "organizationId" = ${initial.organizationId} AND "id" = ${id} FOR UPDATE`;
  const application = await transaction.application.findFirst({ where: { organizationId: initial.organizationId, id }, include: { fundingCall: { include: { organization: true } } } });
  if (!application) throw new ResourceNotFoundError("APPLICATION_NOT_FOUND");
  if (!await canManageApplication(userId, application, transaction)) throw new AuthorizationError("APPLICATION_MANAGEMENT_FORBIDDEN");
  if (application.revision !== revision) throw new DomainConflictError("APPLICATION_REVISION_CONFLICT");
  if (application.fundingCall.organization.status !== "ACTIVE") throw new AuthorizationError("ORGANIZATION_INACTIVE");
  return application;
}

export async function updatePersonalApplication(userId: string, id: string, rawInput: UpdateApplicationInput) {
  const input = updateApplicationSchema.parse(rawInput);
  await db.$transaction(async (transaction) => {
    const current = await participantMutation(transaction, userId, id, input.revision);
    if (current.status !== "DRAFT") throw new DomainConflictError("APPLICATION_SNAPSHOT_FROZEN");
    assertCallAcceptsApplications(current.fundingCall);
    const project = await requireProjectAccess(userId, current.projectId, true, transaction);
    let teamNameSnapshot = current.teamNameSnapshot;
    if (input.teamId !== undefined) {
      if (input.teamId && input.teamId !== project.primaryTeamId) throw new DomainConflictError("APPLICATION_TEAM_PROJECT_MISMATCH");
      teamNameSnapshot = input.teamId ? (await requireTeamAccess(userId, input.teamId, true, transaction)).name : null;
    }
    const { revision, ...fields } = input;
    await transaction.application.updateMany({ where: { organizationId: current.organizationId, id, revision, status: "DRAFT" }, data: { ...fields, teamNameSnapshot, revision: { increment: 1 } } });
  });
  return (await getPersonalApplication(userId, id))!;
}

export async function submitPersonalApplication(userId: string, id: string, revision: number) {
  await db.$transaction(async (transaction) => {
    const current = await participantMutation(transaction, userId, id, revision);
    if (current.status !== "DRAFT") throw new DomainConflictError("APPLICATION_SNAPSHOT_FROZEN");
    assertCallAcceptsApplications(current.fundingCall);
    const project = await requireProjectAccess(userId, current.projectId, true, transaction);
    if (current.teamId && current.teamId !== project.primaryTeamId) throw new DomainConflictError("APPLICATION_TEAM_PROJECT_MISMATCH");
    if (!current.projectNameSnapshot.trim() || !current.projectSummarySnapshot.trim()) throw new DomainConflictError("APPLICATION_SNAPSHOT_INCOMPLETE");
    await transaction.application.updateMany({ where: { organizationId: current.organizationId, id, revision, status: "DRAFT" }, data: { status: "SUBMITTED", submittedAt: new Date(), submittedByUserId: userId, revision: { increment: 1 } } });
  });
  return (await getPersonalApplication(userId, id))!;
}

export async function withdrawPersonalApplication(userId: string, id: string, revision: number) {
  await db.$transaction(async (transaction) => {
    const current = await participantMutation(transaction, userId, id, revision);
    if (!["DRAFT", "SUBMITTED", "IN_REVIEW"].includes(current.status) || current.fundingCall.resultsPublishedAt || ["CLOSED", "ARCHIVED"].includes(current.fundingCall.status)) throw new DomainConflictError("APPLICATION_WITHDRAWAL_UNAVAILABLE");
    await transaction.application.updateMany({ where: { organizationId: current.organizationId, id, revision }, data: { status: "WITHDRAWN", withdrawnAt: new Date(), revision: { increment: 1 } } });
  });
  return (await getPersonalApplication(userId, id))!;
}

export { listPersonalOpportunities, getPersonalOpportunity, type PersonalOpportunityDto, type PersonalOpportunityDto as OpportunityDto } from "@/lib/opportunities/service";

function criterionDto(record: Prisma.EvaluationCriterionGetPayload<object>) { return { id: record.id, name: record.name, description: record.description, weight: record.weight.toString(), maxScore: record.maxScore.toString(), position: record.position }; }
export type CriterionDto = ReturnType<typeof criterionDto>;
const evaluationSelect = { id: true, revision: true, status: true, evaluatorUserId: true, submittedAt: true, evaluator: { select: { id: true, profile: { select: { fullName: true } } } }, scores: { select: { criterionId: true, score: true, comment: true } } } as const;
type EvaluationRecord = Prisma.ApplicationEvaluationGetPayload<{ select: typeof evaluationSelect }>;
function evaluationDto(record: EvaluationRecord) { return { id: record.id, revision: record.revision, status: record.status, evaluator: { id: record.evaluator.id, name: record.evaluator.profile?.fullName ?? "Membro da instituição" }, submittedAt: record.submittedAt?.toISOString() ?? null, scores: record.scores.map((score) => ({ ...score, score: score.score.toString() })) }; }
export type EvaluationDto = ReturnType<typeof evaluationDto>;
const institutionalSelect = { id: true, revision: true, status: true, projectNameSnapshot: true, projectSummarySnapshot: true, projectDescriptionSnapshot: true, teamNameSnapshot: true, submittedAt: true, withdrawnAt: true, decision: true, decisionNote: true, decidedAt: true, submittedBy: { select: { id: true, profile: { select: { fullName: true } } } }, evaluations: { select: evaluationSelect }, enrollments: { select: { id: true } } } as const;
type InstitutionalRecord = Prisma.ApplicationGetPayload<{ select: typeof institutionalSelect }>;
function institutionDto(record: InstitutionalRecord, criteria: Parameters<typeof aggregateApplicationScore>[0], includeDecisionNote = false) {
  const aggregate = aggregateApplicationScore(criteria, record.evaluations);
  return { id: record.id, revision: record.revision, status: record.status, projectNameSnapshot: record.projectNameSnapshot, projectSummarySnapshot: record.projectSummarySnapshot, projectDescriptionSnapshot: record.projectDescriptionSnapshot, teamNameSnapshot: record.teamNameSnapshot, submittedAt: record.submittedAt?.toISOString() ?? null, withdrawnAt: record.withdrawnAt?.toISOString() ?? null, decision: record.decision, decisionNote: includeDecisionNote ? record.decisionNote : null, decidedAt: record.decidedAt?.toISOString() ?? null, submittedBy: { id: record.submittedBy.id, name: record.submittedBy.profile?.fullName ?? "Participante" }, score: aggregate.score?.toDecimalPlaces(4).toNumber() ?? null, exactScore: aggregate.score?.toString() ?? null, evaluationCount: aggregate.evaluationCount, enrollmentId: record.enrollments[0]?.id ?? null };
}
export type CallApplicationDto = ReturnType<typeof institutionDto>;

export async function listCallCriteria(organizationId: string, programId: string, callId: string) {
  await requireCall(db, organizationId, programId, callId);
  return (await db.evaluationCriterion.findMany({ where: { organizationId, fundingCallId: callId }, orderBy: [{ position: "asc" }, { id: "asc" }] })).map(criterionDto);
}

export async function listCallApplications(organizationId: string, programId: string, callId: string, search = "", userId?: string) {
  await requireCall(db, organizationId, programId, callId);
  const query = search.trim().slice(0, 200);
  const [criteria, records] = await Promise.all([db.evaluationCriterion.findMany({ where: { organizationId, fundingCallId: callId } }), db.application.findMany({ where: { organizationId, fundingCallId: callId, submittedAt: { not: null }, status: { not: "DRAFT" }, ...(query ? { OR: [{ projectNameSnapshot: { contains: query, mode: "insensitive" } }, { teamNameSnapshot: { contains: query, mode: "insensitive" } }, { submittedBy: { profile: { fullName: { contains: query, mode: "insensitive" } } } }] } : {}) }, select: institutionalSelect, orderBy: [{ submittedAt: "asc" }, { id: "asc" }] })]);
  const membership = userId ? await db.organizationMembership.findFirst({ where: { organizationId, userId, status: "ACTIVE", organization: { status: "ACTIVE" } }, select: { role: true } }) : null;
  return records.map((record) => institutionDto(record, criteria, Boolean(membership && hasAtLeastRole(membership.role, "MANAGER"))));
}

export async function getCallApplication(organizationId: string, programId: string, callId: string, applicationId: string, evaluatorUserId?: string) {
  await requireCall(db, organizationId, programId, callId);
  const record = await db.application.findFirst({ where: { organizationId, fundingCallId: callId, id: applicationId, submittedAt: { not: null }, status: { not: "DRAFT" } }, select: institutionalSelect });
  if (!record) return null;
  const criteria = await db.evaluationCriterion.findMany({ where: { organizationId, fundingCallId: callId }, orderBy: [{ position: "asc" }, { id: "asc" }] });
  const membership = evaluatorUserId ? await db.organizationMembership.findFirst({ where: { organizationId, userId: evaluatorUserId, status: "ACTIVE", organization: { status: "ACTIVE" } }, select: { role: true } }) : null;
  const manager = membership ? hasAtLeastRole(membership.role, "MANAGER") : false;
  return { ...institutionDto(record, criteria, manager), criteria: criteria.map(criterionDto), evaluations: manager ? record.evaluations.map(evaluationDto) : [], ownEvaluation: record.evaluations.find((evaluation) => evaluation.evaluatorUserId === evaluatorUserId) ? evaluationDto(record.evaluations.find((evaluation) => evaluation.evaluatorUserId === evaluatorUserId)!) : null };
}

export async function getCallRanking(organizationId: string, programId: string, callId: string, userId?: string) {
  return rankApplications((await listCallApplications(organizationId, programId, callId, "", userId)).filter((application) => application.status !== "WITHDRAWN"));
}

async function mutableCriteriaCall(transaction: Client, organizationId: string, programId: string, callId: string, userId: string) {
  await requireInstitutionRole(transaction, userId, organizationId, "MANAGER");
  await lockCall(transaction, organizationId, programId, callId);
  const call = await requireCall(transaction, organizationId, programId, callId);
  if (call.evaluationStartedAt) throw new DomainConflictError("EVALUATION_CRITERIA_FROZEN");
  if (["ARCHIVED", "CLOSED", "RESULT_PUBLISHED"].includes(call.status)) throw new DomainConflictError("EVALUATION_PHASE_INVALID");
  return call;
}

export async function createCallCriterion(organizationId: string, programId: string, callId: string, userId: string, rawInput: CriterionInput) {
  const input = criterionSchema.parse(rawInput);
  return db.$transaction(async (transaction) => { await mutableCriteriaCall(transaction, organizationId, programId, callId, userId); return criterionDto(await transaction.evaluationCriterion.create({ data: { ...input, organizationId, fundingCallId: callId } })); });
}
export async function updateCallCriterion(organizationId: string, programId: string, callId: string, userId: string, criterionId: string, rawInput: CriterionInput) {
  const input = criterionSchema.parse(rawInput);
  return db.$transaction(async (transaction) => { await mutableCriteriaCall(transaction, organizationId, programId, callId, userId); const updated = await transaction.evaluationCriterion.updateMany({ where: { organizationId, fundingCallId: callId, id: criterionId }, data: input }); if (!updated.count) throw new ResourceNotFoundError("EVALUATION_CRITERION_NOT_FOUND"); return criterionDto((await transaction.evaluationCriterion.findFirst({ where: { organizationId, fundingCallId: callId, id: criterionId } }))!); });
}
export async function deleteCallCriterion(organizationId: string, programId: string, callId: string, userId: string, criterionId: string) {
  await db.$transaction(async (transaction) => { await mutableCriteriaCall(transaction, organizationId, programId, callId, userId); const deleted = await transaction.evaluationCriterion.deleteMany({ where: { organizationId, fundingCallId: callId, id: criterionId } }); if (!deleted.count) throw new ResourceNotFoundError("EVALUATION_CRITERION_NOT_FOUND"); });
}
export async function reorderCallCriteria(organizationId: string, programId: string, callId: string, userId: string, criterionIds: string[]) {
  await db.$transaction(async (transaction) => { await mutableCriteriaCall(transaction, organizationId, programId, callId, userId); const criteria = await transaction.evaluationCriterion.findMany({ where: { organizationId, fundingCallId: callId }, select: { id: true } }); if (new Set(criterionIds).size !== criteria.length || criterionIds.length !== criteria.length || criteria.some((criterion) => !criterionIds.includes(criterion.id))) throw new DomainConflictError("EVALUATION_CRITERIA_ORDER_INVALID"); for (const [position, id] of criterionIds.entries()) await transaction.evaluationCriterion.updateMany({ where: { organizationId, fundingCallId: callId, id }, data: { position } }); });
  return listCallCriteria(organizationId, programId, callId);
}

export async function saveApplicationEvaluation(organizationId: string, programId: string, callId: string, applicationId: string, evaluatorUserId: string, rawInput: EvaluationInput) {
  const input = evaluationSchema.parse(rawInput);
  return db.$transaction(async (transaction) => {
    await requireInstitutionRole(transaction, evaluatorUserId, organizationId, "ANALYST");
    await lockCall(transaction, organizationId, programId, callId);
    const call = await requireCall(transaction, organizationId, programId, callId);
    if (call.status !== "IN_REVIEW" || call.resultsPublishedAt) throw new DomainConflictError("EVALUATION_PHASE_INVALID");
    const application = await transaction.application.findFirst({ where: { organizationId, fundingCallId: callId, id: applicationId } });
    if (!application || !["SUBMITTED", "IN_REVIEW"].includes(application.status)) throw new DomainConflictError("APPLICATION_NOT_EVALUABLE");
    const criteria = await transaction.evaluationCriterion.findMany({ where: { organizationId, fundingCallId: callId } });
    if (!criteria.length) throw new DomainConflictError("EVALUATION_CRITERIA_REQUIRED");
    if (new Set(input.scores.map((score) => score.criterionId)).size !== input.scores.length) throw new DomainConflictError("EVALUATION_CRITERION_DUPLICATE");
    for (const score of input.scores) { const criterion = criteria.find((entry) => entry.id === score.criterionId); if (!criterion) throw new DomainConflictError("EVALUATION_CRITERION_CALL_MISMATCH"); if (new Prisma.Decimal(score.score).lt(0) || new Prisma.Decimal(score.score).gt(criterion.maxScore)) throw new DomainConflictError("EVALUATION_SCORE_RANGE_INVALID"); }
    if (input.submit && input.scores.length !== criteria.length) throw new DomainConflictError("EVALUATION_INCOMPLETE");
    let evaluation = await transaction.applicationEvaluation.findUnique({ where: { organizationId_applicationId_evaluatorUserId: { organizationId, applicationId, evaluatorUserId } } });
    if (evaluation?.status === "SUBMITTED") throw new DomainConflictError("EVALUATION_SUBMITTED_IMMUTABLE");
    if ((evaluation?.revision ?? 0) !== input.revision) throw new DomainConflictError("EVALUATION_REVISION_CONFLICT");
    if (!call.evaluationStartedAt) await transaction.fundingCall.updateMany({ where: { organizationId, id: callId }, data: { evaluationStartedAt: new Date() } });
    if (!evaluation) evaluation = await transaction.applicationEvaluation.create({ data: { organizationId, fundingCallId: callId, applicationId, evaluatorUserId } });
    await transaction.applicationEvaluationScore.deleteMany({ where: { organizationId, fundingCallId: callId, evaluationId: evaluation.id } });
    await transaction.applicationEvaluationScore.createMany({ data: input.scores.map((score) => ({ ...score, organizationId, fundingCallId: callId, evaluationId: evaluation!.id })) });
    await transaction.applicationEvaluation.updateMany({ where: { organizationId, fundingCallId: callId, id: evaluation.id, revision: input.revision, status: "DRAFT" }, data: { status: input.submit ? "SUBMITTED" : "DRAFT", submittedAt: input.submit ? new Date() : null, revision: { increment: 1 } } });
    await transaction.application.updateMany({ where: { organizationId, fundingCallId: callId, id: applicationId, status: "SUBMITTED" }, data: { status: "IN_REVIEW", revision: { increment: 1 } } });
    return evaluationDto((await transaction.applicationEvaluation.findFirst({ where: { organizationId, fundingCallId: callId, id: evaluation.id }, select: evaluationSelect }))!);
  });
}

export async function decideCallApplications(organizationId: string, programId: string, callId: string, userId: string, rawInput: DecisionInput) {
  const input = decisionSchema.parse(rawInput);
  await db.$transaction(async (transaction) => {
    await requireInstitutionRole(transaction, userId, organizationId, "MANAGER"); await lockCall(transaction, organizationId, programId, callId); const call = await requireCall(transaction, organizationId, programId, callId);
    if (call.status !== "IN_REVIEW" || call.resultsPublishedAt) throw new DomainConflictError("DECISION_PHASE_INVALID");
    const ids = [...new Set(input.applicationIds)];
    const applications = await transaction.application.findMany({ where: { organizationId, fundingCallId: callId, id: { in: ids }, status: { in: ["SUBMITTED", "IN_REVIEW", "DECIDED"] } }, select: { id: true } });
    if (applications.length !== ids.length) throw new DomainConflictError("APPLICATION_DECISION_SCOPE_INVALID");
    await transaction.application.updateMany({ where: { organizationId, fundingCallId: callId, id: { in: ids } }, data: { decision: input.decision, decisionNote: input.decisionNote ?? null, decidedAt: new Date(), decidedByUserId: userId, status: "DECIDED", revision: { increment: 1 } } });
  });
  return listCallApplications(organizationId, programId, callId, "", userId);
}

export async function publishCallResults(organizationId: string, programId: string, callId: string, userId: string) {
  return db.$transaction(async (transaction) => {
    await requireInstitutionRole(transaction, userId, organizationId, "MANAGER"); await lockCall(transaction, organizationId, programId, callId); const call = await requireCall(transaction, organizationId, programId, callId);
    if (call.resultsPublishedAt) return { resultsPublishedAt: call.resultsPublishedAt.toISOString() };
    if (call.status !== "IN_REVIEW") throw new DomainConflictError("DECISION_PHASE_INVALID");
    const applications = await transaction.application.findMany({ where: { organizationId, fundingCallId: callId, status: { notIn: ["DRAFT", "WITHDRAWN"] } }, select: { decision: true } });
    if (!applications.length || applications.some((application) => application.decision === "PENDING")) throw new DomainConflictError("APPLICATION_DECISIONS_INCOMPLETE");
    const now = new Date(); await transaction.fundingCall.updateMany({ where: { organizationId, id: callId }, data: { status: "RESULT_PUBLISHED", resultsPublishedAt: now } }); return { resultsPublishedAt: now.toISOString() };
  });
}

async function enrollmentContext(transaction: Client, organizationId: string, programId: string, callId: string, cohortId: string, applicationIds: string[]) {
  const call = await requireCall(transaction, organizationId, programId, callId);
  if (!call.resultsPublishedAt || !["RESULT_PUBLISHED", "CLOSED"].includes(call.status)) throw new DomainConflictError("RESULTS_NOT_PUBLISHED");
  const cohort = await transaction.cohort.findFirst({ where: { organizationId, fundingProgramId: programId, fundingCallId: callId, id: cohortId } });
  if (!cohort) throw new DomainConflictError("APPLICATION_COHORT_CALL_MISMATCH");
  assertCohortCanReceiveEnrollment(cohort.status);
  const ids = [...new Set(applicationIds)];
  if (!ids.length || ids.length > 200) throw new DomainConflictError("APPLICATION_SELECTION_REQUIRED");
  const applications = await transaction.application.findMany({ where: { organizationId, fundingCallId: callId, id: { in: ids }, decision: "SELECTED", status: "DECIDED" }, include: { enrollments: { select: { id: true, cohortId: true, ventureId: true } } }, orderBy: { id: "asc" } });
  if (applications.length !== ids.length) throw new DomainConflictError("APPLICATION_SELECTION_SCOPE_INVALID");
  return { cohort, applications };
}

export async function getCallEnrollmentPreview(organizationId: string, programId: string, callId: string, cohortId: string, applicationIds: string[]) {
  const { cohort, applications } = await enrollmentContext(db, organizationId, programId, callId, cohortId, applicationIds);
  const ventures = await db.venture.findMany({ where: { organizationId, OR: [{ sourceProjectId: null, archivedAt: null }, { sourceProjectId: { in: applications.map((application) => application.projectId) } }] }, select: { id: true, name: true, kind: true, sourceProjectId: true, archivedAt: true }, orderBy: { name: "asc" } });
  return { cohort: { id: cohort.id, name: cohort.name }, applications: applications.map((application) => { const venture = ventures.find((venture) => venture.sourceProjectId === application.projectId); return { id: application.id, projectNameSnapshot: application.projectNameSnapshot, teamNameSnapshot: application.teamNameSnapshot, venture: venture ? { id: venture.id, name: venture.name, kind: venture.kind, archivedAt: venture.archivedAt?.toISOString() ?? null } : null, enrollmentId: application.enrollments[0]?.id ?? null }; }), availableVentures: ventures.filter((venture) => !venture.archivedAt).map((venture) => ({ id: venture.id, name: venture.name, kind: venture.kind, eligibleApplicationIds: applications.filter((application) => venture.sourceProjectId === null || venture.sourceProjectId === application.projectId).map((application) => application.id) })) };
}

export async function enrollCallApplications(organizationId: string, programId: string, callId: string, userId: string, cohortId: string, applicationIds: string[], mappings: EnrollmentMapping[] = []) {
  enrollApplicationsSchema.parse({ cohortId, applicationIds, mappings });
  if (new Set(mappings.map((mapping) => mapping.applicationId)).size !== mappings.length || mappings.some((mapping) => !applicationIds.includes(mapping.applicationId))) throw new DomainConflictError("APPLICATION_VENTURE_MAPPING_INVALID");
  return db.$transaction(async (transaction) => {
    await requireInstitutionRole(transaction, userId, organizationId, "MANAGER");
    // Existing cohort operations take cohort before call; preserving that order avoids lock inversion.
    await transaction.$queryRaw`SELECT "id" FROM "Cohort" WHERE "organizationId" = ${organizationId} AND "id" = ${cohortId} FOR UPDATE`;
    await lockCall(transaction, organizationId, programId, callId);
    const { applications } = await enrollmentContext(transaction, organizationId, programId, callId, cohortId, applicationIds);
    // Every batch takes project and venture locks in stable order across calls and cohorts.
    const projectIds = [...new Set(applications.map((application) => application.projectId))].sort();
    await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "Project" WHERE "id" IN (${Prisma.join(projectIds)}) ORDER BY "id" FOR UPDATE`);
    const mappedSources = await transaction.venture.findMany({ where: { organizationId, sourceProjectId: { in: applications.map((application) => application.projectId) } }, select: { id: true } });
    const ventureIds = [...new Set([...mappedSources.map((venture) => venture.id), ...mappings.map((mapping) => mapping.ventureId).filter((id): id is string => Boolean(id))])].sort();
    if (ventureIds.length) await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "Venture" WHERE "organizationId" = ${organizationId} AND "id" IN (${Prisma.join(ventureIds)}) ORDER BY "id" FOR UPDATE`);
    const enrollments = [];
    const waves = await transaction.followUpWave.findMany({ where: { organizationId, cohortId, status: { in: ["PLANNED", "OPEN"] } }, select: { id: true, scheduledFor: true, opensAt: true, createdAt: true } });
    for (const application of applications) {
      const mapping = mappings.find((entry) => entry.applicationId === application.id);
      if (application.enrollments.length) {
        if (application.enrollments[0].cohortId !== cohortId) throw new DomainConflictError("APPLICATION_ALREADY_ENROLLED_OTHER_COHORT");
        if (mapping?.ventureId && application.enrollments[0].ventureId !== mapping.ventureId) throw new DomainConflictError("APPLICATION_VENTURE_MAPPING_INVALID");
        enrollments.push({ applicationId: application.id, enrollmentId: application.enrollments[0].id, reused: true }); continue;
      }
      const sourceVenture = await transaction.venture.findUnique({ where: { organizationId_sourceProjectId: { organizationId, sourceProjectId: application.projectId } } });
      if (mapping?.ventureId === null && sourceVenture) throw new DomainConflictError("APPLICATION_VENTURE_MAPPING_CHANGED");
      if (mapping?.ventureId && sourceVenture && sourceVenture.id !== mapping.ventureId) throw new DomainConflictError("APPLICATION_VENTURE_MAPPING_INVALID");
      let venture = sourceVenture;
      if (mapping?.ventureId && !venture) {
        const existing = await transaction.venture.findFirst({ where: { organizationId, id: mapping.ventureId, archivedAt: null } });
        if (!existing || (existing.sourceProjectId && existing.sourceProjectId !== application.projectId)) throw new DomainConflictError("APPLICATION_VENTURE_MAPPING_INVALID");
        venture = await transaction.venture.update({ where: { organizationId_id: { organizationId, id: existing.id } }, data: { sourceProjectId: application.projectId } });
      }
      if (!venture) venture = await transaction.venture.create({ data: { organizationId, sourceProjectId: application.projectId, name: application.projectNameSnapshot, kind: mapping?.kind ?? "PROJECT" } });
      if (venture.archivedAt) throw new DomainConflictError("APPLICATION_VENTURE_ARCHIVED");
      const existing = await transaction.ventureEnrollment.findUnique({ where: { organizationId_cohortId_ventureId: { organizationId, cohortId, ventureId: venture.id } } });
      if (existing && existing.applicationId !== application.id) throw new DomainConflictError("APPLICATION_VENTURE_ALREADY_ENROLLED");
      const enrollment = existing ?? await transaction.ventureEnrollment.create({ data: { organizationId, cohortId, ventureId: venture.id, applicationId: application.id } });
      const eligible = waves.filter((wave) => isEnrollmentEligibleAt(enrollment, wave.scheduledFor ?? wave.opensAt ?? wave.createdAt, Boolean(wave.scheduledFor)));
      if (eligible.length) await transaction.ventureObservation.createMany({ data: eligible.map((wave) => ({ organizationId, cohortId, ventureEnrollmentId: enrollment.id, followUpWaveId: wave.id })), skipDuplicates: true });
      enrollments.push({ applicationId: application.id, enrollmentId: enrollment.id, ventureId: venture.id, reused: Boolean(existing) });
    }
    return { enrollments };
  }, { maxWait: 10000, timeout: 30000 });
}
