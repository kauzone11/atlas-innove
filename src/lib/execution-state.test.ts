import assert from "node:assert/strict";
import test from "node:test";
import { calendarToday, deadlineState, deriveExecutionState, deriveObligationState, actionUrgency } from "@/lib/execution/state";
import { createAwardSchema, createDisbursementSchema, saveSubmissionSchema, transitionAwardSchema } from "@/lib/awards/schemas";

test("execution calendar dates preserve Fortaleza midnight boundaries", () => {
  assert.equal(calendarToday(new Date("2026-10-06T02:59:59Z")), "2026-10-05");
  assert.equal(calendarToday(new Date("2026-10-06T03:00:00Z")), "2026-10-06");
  assert.equal(deadlineState("2026-10-06", "2026-10-06").state, "TODAY");
  assert.equal(deadlineState("2026-10-05", "2026-10-06").state, "OVERDUE");
  assert.equal(deadlineState("2026-10-07", "2026-10-06").days, 1);
  assert.equal(deadlineState(null, "2026-10-06").state, "UNDATED");
});
test("obligation resolution outranks deadlines and pending review is distinct from overdue authoring", () => {
  const input = { dueAt: "2026-01-01", waivedAt: null, submissions: [] as Array<{ status: string; reviewStatus: string }> };
  assert.equal(deriveObligationState(input, "2026-10-06"), "OVERDUE");
  assert.equal(deriveObligationState({ ...input, submissions: [{ status: "SUBMITTED", reviewStatus: "PENDING" }] }, "2026-10-06"), "SUBMITTED");
  assert.equal(deriveObligationState({ ...input, submissions: [{ status: "SUBMITTED", reviewStatus: "CHANGES_REQUESTED" }] }, "2026-10-06"), "CHANGES_REQUESTED");
  assert.equal(deriveObligationState({ ...input, submissions: [{ status: "SUBMITTED", reviewStatus: "APPROVED" }] }, "2026-10-06"), "APPROVED");
  assert.equal(deriveObligationState({ ...input, waivedAt: "2026-10-06" }, "2026-10-06"), "WAIVED");
  assert.equal(deriveObligationState({ dueAt: null, submissions: [{ status: "DRAFT", reviewStatus: "PENDING" }] }, "2026-10-06"), "DRAFT");
  assert.equal(deriveExecutionState("ACTIVE", "2026-10-30", "2026-10-06").endingSoon, true);
  assert.equal(deriveExecutionState("COMPLETED", "2026-10-30", "2026-10-06").endingSoon, false);
  assert.equal(actionUrgency({ dueAt: "2026-10-05", changesRequested: true }, "2026-10-06"), "OVERDUE");
});
test("award input preserves nonfinancial support, strict date periods, decimals, confirmation and HTTPS evidence", () => {
  const applicationId = "c000000000000000000000000";
  assert.equal(createAwardSchema.parse({ applicationId }).approvedAmount, null);
  assert.equal(createAwardSchema.safeParse({ applicationId, approvedAmount: 1.1 }).success, false);
  assert.equal(createAwardSchema.safeParse({ applicationId, approvedAmount: "1.001" }).success, false);
  assert.equal(createAwardSchema.safeParse({ applicationId, startsAt: "2026-10-07", endsAt: "2026-10-06" }).success, false);
  assert.equal(createAwardSchema.safeParse({ applicationId, startsAt: "2026-02-30" }).success, false);
  assert.equal(transitionAwardSchema.safeParse({ revision: 1, status: "ACTIVE" }).success, false);
  assert.equal(transitionAwardSchema.safeParse({ revision: 1, status: "TERMINATED" }).success, false);
  assert.equal(createDisbursementSchema.safeParse({ label: "Parcel", amount: "0" }).success, false);
  assert.equal(saveSubmissionSchema.safeParse({ revision: 0, summary: "Draft", evidence: [{ label: "Unsafe", url: "javascript:alert(1)" }] }).success, false);
  assert.equal(saveSubmissionSchema.safeParse({ revision: 0, summary: "Draft", evidence: [{ label: "Safe", url: "https://example.test/report" }] }).success, true);
});
