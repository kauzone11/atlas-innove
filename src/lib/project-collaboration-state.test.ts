import assert from "node:assert/strict";
import test from "node:test";
import { canTransitionTask, isTaskOverdue, projectCalendarToday } from "@/lib/project-collaboration/state";
import { calendarDateSchema, privateResourceUrlSchema } from "@/lib/project-collaboration/schemas";

test("task dates remain calendar dates and terminal tasks never become overdue or reopen", () => {
  assert.equal(projectCalendarToday(new Date("2026-10-06T01:00:00Z")), "2026-10-05");
  assert.equal(calendarDateSchema.safeParse("2026-02-30").success, false);
  assert.equal(calendarDateSchema.safeParse("2028-02-29").success, true);
  assert.equal(isTaskOverdue({ status: "TODO", dueAt: "2026-10-05" }, "2026-10-06"), true);
  assert.equal(isTaskOverdue({ status: "TODO", dueAt: "2026-10-06" }, "2026-10-06"), false);
  assert.equal(isTaskOverdue({ status: "DONE", dueAt: "2026-10-05" }, "2026-10-06"), false);
  assert.equal(canTransitionTask("TODO", "IN_PROGRESS"), true);
  assert.equal(canTransitionTask("DONE", "TODO"), false);
  assert.equal(canTransitionTask("CANCELLED", "DONE"), false);
});
test("private resources accept only HTTPS links without embedded credentials", () => {
  assert.equal(privateResourceUrlSchema.safeParse("https://example.test/report").success, true);
  for (const url of ["javascript:alert(1)", "data:text/plain,secret", "file:///tmp/file", "http://example.test", "https://user:secret@example.test"]) assert.equal(privateResourceUrlSchema.safeParse(url).success, false);
});
