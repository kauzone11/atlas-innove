import { Prisma } from "@prisma/client";
import { calendarToday, deadlineState, deriveExecutionState, deriveObligationState } from "@/lib/execution/state";

export const submissionSelect = {
  id: true, version: true, revision: true, status: true, summary: true, details: true,
  reviewStatus: true, feedback: true, submittedAt: true, reviewedAt: true, createdAt: true,
  submittedBy: { select: { id: true, profile: { select: { fullName: true } } } }, reviewedBy: { select: { id: true, profile: { select: { fullName: true } } } },
  evidence: { select: { id: true, label: true, url: true }, orderBy: { createdAt: "asc" }, take: 20 },
} as const satisfies Prisma.AwardSubmissionSelect;

const obligationFields = {
  id: true, revision: true, type: true, title: true, description: true, required: true, position: true,
  periodStartsAt: true, periodEndsAt: true, dueAt: true, waivedAt: true, waiverReason: true,
  createdBy: { select: { id: true, profile: { select: { fullName: true } } } }, waivedBy: { select: { id: true, profile: { select: { fullName: true } } } },
} as const;
const awardFields = {
  id: true, organizationId: true, applicationId: true, fundingCallId: true, status: true, revision: true,
  agreementNumber: true, approvedAmount: true, counterpartAmount: true, signedAt: true, startsAt: true, endsAt: true,
  activatedAt: true, completedAt: true, terminatedAt: true, createdAt: true,
  organization: { select: { id: true, name: true } },
  application: { select: { id: true, projectId: true, projectNameSnapshot: true, teamNameSnapshot: true, enrollments: { where: { awardId: null }, select: { id: true, cohortId: true, ventureId: true, awardId: true, status: true, cohort: { select: { id: true, name: true } }, venture: { select: { id: true, name: true } } }, take: 1 } } },
  fundingCall: { select: { id: true, title: true, fundingProgram: { select: { id: true, name: true } } } },
  enrollments: { select: { id: true, cohortId: true, ventureId: true, status: true, cohort: { select: { id: true, name: true } }, venture: { select: { id: true, name: true } } }, take: 1 },
} as const;
export const awardSummarySelect = {
  ...awardFields,
  obligations: { select: { id: true, type: true, title: true, required: true, dueAt: true, waivedAt: true, submissions: { select: { status: true, reviewStatus: true }, orderBy: { version: "desc" }, take: 1 } }, orderBy: [{ position: "asc" }, { id: "asc" }], take: 200 },
  disbursements: { select: { id: true, label: true, amount: true, status: true, plannedFor: true, paidAt: true }, orderBy: [{ plannedFor: "asc" }, { id: "asc" }], take: 200 },
} as const satisfies Prisma.AwardSelect;
export const awardDetailSelect = {
  ...awardSummarySelect,
  obligations: { select: { ...obligationFields, submissions: { select: submissionSelect, orderBy: { version: "desc" }, take: 100 }, dueDateHistory: { select: { id: true, oldDueAt: true, newDueAt: true, reason: true, changedAt: true, changedBy: { select: { id: true, profile: { select: { fullName: true } } } } }, orderBy: { changedAt: "desc" }, take: 200 } }, orderBy: [{ position: "asc" }, { id: "asc" }], take: 200 },
  disbursements: { select: { id: true, label: true, amount: true, status: true, plannedFor: true, paidAt: true, paidRecordedAt: true, paidBy: { select: { id: true, profile: { select: { fullName: true } } } }, externalReference: true, note: true, revision: true }, orderBy: [{ plannedFor: "asc" }, { id: "asc" }], take: 200 },
  documents: { select: { id: true, title: true, type: true, url: true, visibleToParticipant: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 100 },
  statusHistory: { select: { id: true, fromStatus: true, toStatus: true, reason: true, changedAt: true, changedBy: { select: { id: true, profile: { select: { fullName: true } } } } }, orderBy: { changedAt: "desc" }, take: 200 },
} as const satisfies Prisma.AwardSelect;
export const institutionAwardSummarySelect = {
  ...awardSummarySelect,
  obligations: { ...awardSummarySelect.obligations, select: { ...awardSummarySelect.obligations.select, _count: { select: { submissions: { where: { status: "DRAFT" } } } }, submissions: { ...awardSummarySelect.obligations.select.submissions, where: { status: "SUBMITTED" } } } },
} as const satisfies Prisma.AwardSelect;
export const institutionAwardDetailSelect = {
  ...awardDetailSelect,
  obligations: { ...awardDetailSelect.obligations, select: { ...awardDetailSelect.obligations.select, _count: { select: { submissions: { where: { status: "DRAFT" } } } }, submissions: { ...awardDetailSelect.obligations.select.submissions, where: { status: "SUBMITTED" } } } },
} as const satisfies Prisma.AwardSelect;

export const dateOnly = (value: Date | null) => value?.toISOString().slice(0, 10) ?? null;
const timestamp = (value: Date | null) => value?.toISOString() ?? null;
type SummaryRecord = Prisma.AwardGetPayload<{ select: typeof awardSummarySelect }>;
type DetailRecord = Prisma.AwardGetPayload<{ select: typeof awardDetailSelect }>;
export function serializeSubmission(record: Prisma.AwardSubmissionGetPayload<{ select: typeof submissionSelect }>) {
  return { ...record, submittedAt: timestamp(record.submittedAt), reviewedAt: timestamp(record.reviewedAt), createdAt: record.createdAt.toISOString() };
}
function serializeObligationSummary(record: SummaryRecord["obligations"][number] & { _count?: { submissions: number } }, today: string) {
  const dueAt = dateOnly(record.dueAt);
  const { _count, ...fields } = record;
  const state = deriveObligationState({ ...record, dueAt }, today);
  return { ...fields, dueAt, waivedAt: timestamp(record.waivedAt), submissions: record.submissions, draftExists: (_count?.submissions ?? record.submissions.filter((submission) => submission.status === "DRAFT").length) > 0, state: state === "PENDING" && (_count?.submissions ?? 0) > 0 ? "DRAFT" as const : state, deadline: deadlineState(dueAt, today) };
}
export function serializeAwardSummary(record: SummaryRecord, today = calendarToday()) {
  const obligations = record.obligations.map((obligation) => serializeObligationSummary(obligation, today));
  const disbursements = record.disbursements.map((entry) => ({ ...entry, amount: entry.amount.toString(), plannedFor: dateOnly(entry.plannedFor), paidAt: dateOnly(entry.paidAt) }));
  return {
    ...record, approvedAmount: record.approvedAmount?.toString() ?? null, counterpartAmount: record.counterpartAmount?.toString() ?? null,
    projectId: record.application.projectId, projectName: record.application.projectNameSnapshot, fundingProgramId: record.fundingCall.fundingProgram.id, programName: record.fundingCall.fundingProgram.name, institutionName: record.organization.name,
    historicalEnrollments: record.application.enrollments,
    signedAt: dateOnly(record.signedAt), startsAt: dateOnly(record.startsAt), endsAt: dateOnly(record.endsAt),
    activatedAt: timestamp(record.activatedAt), completedAt: timestamp(record.completedAt), terminatedAt: timestamp(record.terminatedAt), createdAt: record.createdAt.toISOString(),
    obligations, disbursements, execution: deriveExecutionState(record.status, dateOnly(record.endsAt), today),
    counts: { obligations: obligations.length, approved: obligations.filter((entry) => entry.state === "APPROVED").length, waived: obligations.filter((entry) => entry.state === "WAIVED").length, overdue: obligations.filter((entry) => entry.deadline.state === "OVERDUE" && !["APPROVED", "WAIVED", "SUBMITTED"].includes(entry.state)).length, pendingReviews: obligations.filter((entry) => entry.state === "SUBMITTED").length, changesRequested: obligations.filter((entry) => entry.state === "CHANGES_REQUESTED").length },
    financial: { paid: record.disbursements.filter((entry) => entry.status === "PAID").reduce((sum, entry) => sum.add(entry.amount), new Prisma.Decimal(0)).toString(), planned: record.disbursements.filter((entry) => entry.status === "PLANNED").reduce((sum, entry) => sum.add(entry.amount), new Prisma.Decimal(0)).toString() },
  };
}
export function serializeAwardDetail(record: DetailRecord) {
  const today = calendarToday();
  const base = serializeAwardSummary(record, today);
  return { ...base, obligations: record.obligations.map((entry) => {
    const { _count, ...fields } = entry as typeof entry & { _count?: { submissions: number } };
    const summary = serializeObligationSummary(entry, today);
    return { ...fields, ...summary, draftExists: (_count?.submissions ?? entry.submissions.filter((submission) => submission.status === "DRAFT").length) > 0, periodStartsAt: dateOnly(entry.periodStartsAt), periodEndsAt: dateOnly(entry.periodEndsAt), submissions: entry.submissions.map(serializeSubmission), dueDateHistory: entry.dueDateHistory.map((history) => ({ ...history, oldDueAt: dateOnly(history.oldDueAt), newDueAt: dateOnly(history.newDueAt), changedAt: history.changedAt.toISOString() })) };
  }), disbursements: record.disbursements.map((entry) => ({ ...entry, amount: entry.amount.toString(), plannedFor: dateOnly(entry.plannedFor), paidAt: dateOnly(entry.paidAt), paidRecordedAt: timestamp(entry.paidRecordedAt) })), documents: record.documents.map((entry) => ({ ...entry, createdAt: entry.createdAt.toISOString() })), statusHistory: record.statusHistory.map((entry) => ({ ...entry, changedAt: entry.changedAt.toISOString() })) };
}
export type AwardSummaryDto = ReturnType<typeof serializeAwardSummary>;
export type AwardDetailDto = ReturnType<typeof serializeAwardDetail> & { canManage?: boolean; internalNotes?: Array<{ id: string; internalNote: string | null }> };
export type CallExecutionDto = { applications: Array<{ id: string; projectNameSnapshot: string; teamNameSnapshot: string | null; award: AwardSummaryDto | null; enrollments: Array<{ id: string; cohortId: string; ventureId: string }> }>; page: number; pageSize: number; total: number; call: { id: string; title: string; resultsPublishedAt: string | null }; counts: { selected: number; prepared: number; active: number } };
export type OrganizationExecutionDto = { awards: AwardSummaryDto[]; page: number; pageSize: number; total: number; awaitingCalls: Array<{ id: string; title: string; fundingProgramId: string; programName: string; selected: number }>; counts: { preparing: number; active: number; pendingReviews: number; overdueObligations: number; changesRequested: number; plannedDisbursements: number; endingSoon: number; awaitingPreparation: number } };
