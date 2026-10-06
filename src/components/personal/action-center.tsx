import Link from "next/link";
import { ArrowRight, ClipboardCheck, ListTodo, Send } from "lucide-react";
import type { ActionItem } from "@/lib/action-center/state";
import { deadlineState } from "@/lib/execution/state";

export function PersonalActionCenter({ actions }: { actions: ActionItem[] }) {
  const icons = { OBLIGATION: ClipboardCheck, REVISION: ClipboardCheck, APPLICATION: Send, TASK: ListTodo };
  return <section aria-labelledby="personal-actions"><h2 className="text-lg font-semibold" id="personal-actions">Próximas ações</h2><p className="mt-1 text-sm text-slate">Entregas do apoio, candidaturas e tarefas atribuídas a você.</p>
    {actions.length ? <ul className="mt-4 divide-y divide-line border-y border-line">{actions.slice(0, 8).map((action) => {
      const Icon = icons[action.kind];
      return <li key={action.id}><Link href={action.href} className="flex min-h-16 items-center gap-3 py-4"><Icon size={18} aria-hidden="true" className="shrink-0 text-accent-hover" /><span className="min-w-0 flex-1"><span className="block break-words text-sm font-medium">{action.title}</span><span className="mt-1 block break-words text-xs text-slate">{action.context}</span><span className={`mt-1 block text-xs ${action.urgency === "OVERDUE" ? "text-danger" : action.urgency === "CHANGES_REQUESTED" || action.urgency === "DUE_SOON" ? "text-warning" : "text-slate"}`}>{action.urgency === "CHANGES_REQUESTED" ? "Ajustes solicitados · " : ""}{deadlineState(action.dueAt).label}</span></span><ArrowRight size={16} aria-hidden="true" className="shrink-0 text-slate" /></Link></li>;
    })}</ul> : <p className="mt-4 border-t border-line py-5 text-sm text-slate">Nenhuma ação operacional pendente neste momento.</p>}
  </section>;
}
