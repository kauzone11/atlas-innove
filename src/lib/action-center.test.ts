import assert from "node:assert/strict";
import test from "node:test";
import { prioritizeActions } from "@/lib/action-center/state";

test("actions prioritize overdue, revision feedback, nearby deadlines and stable identifiers", () => {
  const items = prioritizeActions([
    { id: "task", kind: "TASK", title: "Task", context: "Project", dueAt: "2026-10-13", href: "/task" },
    { id: "revision", kind: "REVISION", title: "Revision", context: "Award", dueAt: "2026-11-01", href: "/revision", changesRequested: true },
    { id: "late", kind: "OBLIGATION", title: "Report", context: "Award", dueAt: "2026-10-05", href: "/report" },
    { id: "draft", kind: "APPLICATION", title: "Application", context: "Call", dueAt: "2026-10-07", href: "/application" },
    { id: "undated-b", kind: "TASK", title: "B", context: "Project", dueAt: null, href: "/b" },
    { id: "undated-a", kind: "TASK", title: "A", context: "Project", dueAt: null, href: "/a" },
  ], "2026-10-06");
  assert.deepEqual(items.map((item) => item.id), ["late", "revision", "draft", "task", "undated-a", "undated-b"]);
  assert.equal(items[0].urgency, "OVERDUE");
  assert.equal(items[1].urgency, "CHANGES_REQUESTED");
  assert.equal(items[2].urgency, "DUE_SOON");
  assert.equal(items[4].urgency, "NORMAL");
});
