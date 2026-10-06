import Link from "next/link";
import { Layers3, Milestone, Route, UsersRound } from "lucide-react";
import type { TrajectoryEvent } from "@/lib/participants/trajectory";
import { formatParticipantTimestamp } from "@/lib/participants/presentation";

const categories = { all: "Todos", projects: "Projetos", programs: "Programas", teams: "Equipes", milestones: "Marcos" };
const icons = { projects: Layers3, programs: Route, teams: UsersRound, milestones: Milestone };

export function PersonalTrajectory({ events, category = "all", page = 1 }: { events: TrajectoryEvent[]; category?: string; page?: number }) {
  const filtered = events.filter((event) => !(category in categories) || category === "all" || event.category === category);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 40));
  const currentPage = Math.max(1, Math.min(pageCount, Math.floor(page) || 1));
  const visibleEvents = filtered.slice((currentPage - 1) * 40, currentPage * 40);
  const pageHref = (target: number) => `/app/personal?trajectory=${encodeURIComponent(category in categories ? category : "all")}&trajectoryPage=${target}#trajectory-title`;
  const groups = new Map<string, TrajectoryEvent[]>();
  for (const event of visibleEvents) {
    const year = new Intl.DateTimeFormat("pt-BR", { year: "numeric", timeZone: "America/Fortaleza" }).format(new Date(event.occurredAt));
    groups.set(year, [...(groups.get(year) ?? []), event]);
  }
  return <section aria-labelledby="trajectory-title" className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 id="trajectory-title" className="text-lg font-semibold">Minha trajetória</h2><p className="mt-1 text-sm leading-6 text-slate">Participações e marcos preservados ao longo do tempo.</p></div>{events.length > 12 ? <form method="get" className="flex flex-wrap items-end gap-2"><label className="block text-xs font-medium"><span>Mostrar</span><select className="field-control mt-2" name="trajectory" defaultValue={category}>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="button-secondary">Filtrar</button></form> : null}</div>{filtered.length ? [...groups.entries()].map(([year, entries]) => <div className="grid gap-3 border-t border-line pt-5 sm:grid-cols-[5rem_minmax(0,1fr)]" key={year}><h3 className="text-sm font-semibold text-slate">{year}</h3><ol className="divide-y divide-line">{entries.map((event) => { const Icon = icons[event.category]; return <li key={event.id}><Link className="flex min-h-16 items-start gap-3 rounded-md px-1 py-3 hover:bg-surface-subtle" href={event.href}><Icon size={17} aria-hidden="true" className="mt-1 shrink-0 text-accent-hover" /><span className="min-w-0"><span className="block break-words text-sm font-medium">{event.title}</span><time className="mt-1 block text-xs text-slate" dateTime={event.occurredAt}>{formatParticipantTimestamp(event.occurredAt)}</time></span></Link></li>; })}</ol></div>) : <p className="border-t border-line py-5 text-sm text-slate">Nenhum evento nesta categoria.</p>}{pageCount > 1 ? <nav aria-label="Páginas da trajetória" className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">{currentPage > 1 ? <Link className="button-secondary" href={pageHref(currentPage - 1)}>Mais recentes</Link> : <span />}<p className="text-xs text-slate">Página {currentPage} de {pageCount} · {filtered.length} eventos preservados</p>{currentPage < pageCount ? <Link className="button-secondary" href={pageHref(currentPage + 1)}>Mais antigos</Link> : <span />}</nav> : null}</section>;
}
