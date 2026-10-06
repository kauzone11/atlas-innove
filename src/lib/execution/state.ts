export type DeadlineState = { state: "UNDATED" | "OVERDUE" | "TODAY" | "UPCOMING"; days: number | null; label: string };
export type ObligationState = "PENDING" | "DRAFT" | "SUBMITTED" | "CHANGES_REQUESTED" | "APPROVED" | "REJECTED" | "WAIVED" | "OVERDUE";

export function calendarToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return ["year", "month", "day"].map((type) => parts.find((part) => part.type === type)!.value).join("-");
}

export function deadlineState(dueAt: string | null, today = calendarToday()): DeadlineState {
  if (!dueAt) return { state: "UNDATED", days: null, label: "Sem prazo definido" };
  const days = Math.round((Date.parse(`${dueAt}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  if (days < 0) return { state: "OVERDUE", days, label: "Em atraso" };
  if (days === 0) return { state: "TODAY", days, label: "Vence hoje" };
  return { state: "UPCOMING", days, label: `Vence em ${days} ${days === 1 ? "dia" : "dias"}` };
}

export function deriveObligationState(input: { waivedAt?: string | Date | null; dueAt: string | null; submissions: Array<{ status: string; reviewStatus: string }> }, today = calendarToday()): ObligationState {
  if (input.waivedAt) return "WAIVED";
  if (input.submissions.some((submission) => submission.status === "SUBMITTED" && submission.reviewStatus === "APPROVED")) return "APPROVED";
  const latest = input.submissions[0];
  if (latest?.status === "SUBMITTED" && latest.reviewStatus === "PENDING") return "SUBMITTED";
  if (latest?.reviewStatus === "CHANGES_REQUESTED") return "CHANGES_REQUESTED";
  if (latest?.reviewStatus === "REJECTED") return "REJECTED";
  if (deadlineState(input.dueAt, today).state === "OVERDUE") return "OVERDUE";
  return latest?.status === "DRAFT" ? "DRAFT" : "PENDING";
}

export function deriveExecutionState(status: string, endsAt: string | null, today = calendarToday()) {
  const deadline = deadlineState(endsAt, today);
  return { status, endingSoon: status === "ACTIVE" && deadline.days !== null && deadline.days >= 0 && deadline.days <= 30, pastEnd: status === "ACTIVE" && deadline.state === "OVERDUE" };
}

export function actionUrgency(input: { dueAt: string | null; changesRequested?: boolean }, today = calendarToday()): "OVERDUE" | "CHANGES_REQUESTED" | "DUE_SOON" | "NORMAL" {
  const deadline = deadlineState(input.dueAt, today);
  if (deadline.state === "OVERDUE") return "OVERDUE";
  if (input.changesRequested) return "CHANGES_REQUESTED";
  return deadline.days !== null && deadline.days <= 7 ? "DUE_SOON" : "NORMAL";
}
