import { actionUrgency, calendarToday } from "@/lib/execution/state";

export type ActionItem = {
  id: string; kind: "OBLIGATION" | "REVISION" | "APPLICATION" | "TASK";
  title: string; context: string; dueAt: string | null;
  urgency: "OVERDUE" | "CHANGES_REQUESTED" | "DUE_SOON" | "NORMAL"; href: string;
};

export function prioritizeActions(items: Array<Omit<ActionItem, "urgency"> & { changesRequested?: boolean }>, today = calendarToday()): ActionItem[] {
  const urgencyOrder = { OVERDUE: 0, CHANGES_REQUESTED: 1, DUE_SOON: 2, NORMAL: 3 };
  const kindOrder = { REVISION: 0, OBLIGATION: 1, APPLICATION: 2, TASK: 3 };
  return items.map(({ changesRequested, ...item }) => ({ ...item, urgency: actionUrgency({ dueAt: item.dueAt, changesRequested }, today) }))
    .sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
      || (a.dueAt ?? "9999-12-31").localeCompare(b.dueAt ?? "9999-12-31")
      || kindOrder[a.kind] - kindOrder[b.kind] || a.id.localeCompare(b.id));
}
