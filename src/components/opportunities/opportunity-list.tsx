import Link from "next/link";
import { ArrowUpRight, Compass } from "lucide-react";
import { StatusBadge } from "@/components/ui";
import { SaveOpportunityButton } from "@/components/opportunities/save-button";
import { deadlineLabel, relevanceLabels, supportTypeLabels, territoryScopeLabels } from "@/lib/opportunities/presentation";
import { formatMonitoringDate } from "@/lib/monitoring/format";
import type { PersonalOpportunityDto } from "@/lib/opportunities/service";

function deadlineParts(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return { day: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", timeZone: "UTC" }).format(date), month: new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(date).replace(".", "") };
}

export function OpportunityList({ opportunities, personal = false }: { opportunities: PersonalOpportunityDto[]; personal?: boolean }) {
  if (!opportunities.length) return <div className="empty-state"><div className="empty-ico"><Compass size={22} aria-hidden="true" /></div><h2 className="text-xl font-semibold tracking-[-0.02em]">Nenhuma oportunidade encontrada</h2><p>Altere os filtros ou volte depois. As chamadas aparecem aqui quando sua publicação é autorizada pela instituição.</p></div>;
  return <ul className="space-y-3">{opportunities.map((entry) => {
    const deadline = deadlineParts(entry.applicationEndsAt);
    const href = personal ? `/app/personal/opportunities/${entry.id}` : `/opportunities/calls/${entry.id}`;
    return <li key={`${entry.kind}-${entry.id}`}><article className="oprow card-link">
      <div className="min-w-0 sm:w-[7.5rem]">
        <span className="block text-xs text-slate">Prazo</span>
        {deadline ? <span className="block font-display text-[1.6rem] font-semibold leading-none tracking-[-0.04em] tabular-nums">{deadline.day}<span className="ml-1.5 text-xs font-medium uppercase tracking-normal text-slate">de {deadline.month}</span></span> : <span className="block text-sm text-slate">Consulte a fonte oficial</span>}
      </div>
      <div className="min-w-0">
        <p className="text-xs leading-5 text-slate">{entry.institution} · {entry.callNumber}</p>
        <h2 className="mt-1 break-words text-lg font-semibold tracking-[-0.02em]">{entry.title}</h2>
        {entry.objective ? <p className="mt-2 line-clamp-3 max-w-3xl whitespace-pre-wrap break-words text-sm leading-6 text-slate">{entry.objective}</p> : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge label={deadlineLabel(entry.status, entry.applicationStartsAt, entry.applicationEndsAt)} tone={entry.canApply ? "success" : "neutral"} />
          <span className="tag">{supportTypeLabels[entry.supportType]}</span>
          <span className="tag">{entry.territoryLabel || entry.territory || territoryScopeLabels[entry.territoryScope]}{entry.eligibleStates.length ? ` · ${entry.eligibleStates.join(", ")}` : ""}</span>
          {entry.kind === "EXTERNAL" ? <span className="status-badge status-neutral" style={{ boxShadow: "inset 0 0 0 1px var(--line-2)", background: "transparent" }}>Fonte externa</span> : null}
        </div>
        {entry.thematicAreas.length ? <p className="mt-2 break-words text-xs leading-5 text-slate">Áreas: {entry.thematicAreas.join(" · ")}</p> : null}
        <p className="mt-2 text-xs leading-5 text-slate">{entry.applicationEndsAt ? `Inscrições até ${formatMonitoringDate(entry.applicationEndsAt)} · ` : ""}{entry.kind === "INTERNAL" ? "Dados publicados pela instituição no Innove" : "Fonte oficial externa"}</p>
        {personal && entry.relevance ? <details className="mt-3 text-xs leading-5 text-slate"><summary className="min-h-11 cursor-pointer py-3 font-medium text-ink">{relevanceLabels[entry.relevance.level]} · Por quê?</summary><ul className="mt-2 list-disc space-y-1 pl-4">{entry.relevance.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul><p className="mt-2">A relação temática e territorial não confirma elegibilidade.</p></details> : null}
      </div>
      <div className="flex flex-wrap items-start gap-2 sm:justify-end">
        {personal ? <SaveOpportunityButton id={entry.id} kind={entry.kind} saved={entry.saved} /> : null}
        {entry.kind === "INTERNAL" ? <Link className={entry.canApply ? "button-primary" : "button-secondary"} href={href}>Ver edital<ArrowUpRight size={16} aria-hidden="true" /></Link> : entry.sourceUrl ? <a className="button-secondary" href={entry.sourceUrl} target="_blank" rel="noopener noreferrer">Fonte oficial<ArrowUpRight size={16} aria-hidden="true" /></a> : null}
      </div>
    </article></li>;
  })}</ul>;
}
