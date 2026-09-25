import Link from "next/link";
import { ArrowRight, CalendarClock, FolderKanban, LineChart, Plus } from "lucide-react";
import { redirect } from "next/navigation";

import { getActiveOrganizationContext, getAuthenticatedSession } from "@/lib/auth/session";
import { getOrganizationDashboard, type DashboardProgramDto, type FollowUpQueueItemDto } from "@/lib/dashboard/service";
import { PageHeader, StatusBadge } from "@/components/ui";

export default async function AppHomePage() {
  const auth = await getAuthenticatedSession();
  if (!auth) redirect("/login");
  const context = await getActiveOrganizationContext();
  if (!context && auth.memberships.length > 1) redirect("/app/organizations");
  if (!context) return <EmptyWorkspace />;

  const dashboard = await getOrganizationDashboard(context.organization.id);
  const activePrograms = dashboard.programs.filter((program) => program.status === "ACTIVE");
  const priorityQueue = dashboard.queue.filter((item) => item.bucket !== "COMPLETED").slice(0, 6);

  return <div>
    <PageHeader title="Visão geral" description="Acompanhe programas, empreendimentos e prazos em um único espaço." action={<Link href="/app/programs" className="button-primary"><Plus size={15} aria-hidden="true" /> Novo programa</Link>} />
    <section className="metric-strip" aria-label="Indicadores da organização">
      <MetricCard label="Programas ativos" value={dashboard.metrics.activeProgramCount} tone="orange" />
      <MetricCard label="Empreendimentos" value={dashboard.metrics.ventureCount} tone="purple" />
      <MetricCard label="Acompanhamentos abertos" value={dashboard.metrics.openFollowUpCount} tone="green" />
      <MetricCard label="Cobertura registrada" value={dashboard.metrics.coverage === null ? "—" : `${dashboard.metrics.coverage}%`} tone="green" detail={dashboard.metrics.coverage === null ? "Sem observações registradas" : "Observações enviadas"} />
    </section>

    <div className="workspace-grid-with-rail mt-4">
      <div className="min-w-0">
        <section aria-labelledby="programas-em-andamento">
          <SectionHeading id="programas-em-andamento" title="Programas em andamento" count={activePrograms.length} action={<Link href="/app/programs" className="button-secondary min-h-8 px-3 text-[0.625rem]">Ver todos</Link>} />
          {activePrograms.length ? <div className="grid gap-2.5 md:grid-cols-2">{activePrograms.slice(0, 4).map((program) => <ProgramCard key={program.id} program={program} />)}</div> : <EmptyState text="Nenhum programa ativo" detail="Ative um programa para acompanhar sua execução nesta visão." href="/app/programs" action="Ver programas" />}
        </section>

        <section className="mt-5" aria-labelledby="acompanhamentos-prioritarios">
          <SectionHeading id="acompanhamentos-prioritarios" title="Acompanhamentos prioritários" count={priorityQueue.length} tone="warning" action={<Link href="/app/follow-ups" className="button-secondary min-h-8 px-3 text-[0.625rem]">Abrir fila</Link>} />
          {priorityQueue.length ? <QueueTable items={priorityQueue} /> : <EmptyState text="Nenhum acompanhamento pendente" detail="A fila aparece quando houver uma observação aberta ou em atraso." href="/app/follow-ups" action="Ver acompanhamentos" />}
        </section>
      </div>

      <DashboardRail programs={dashboard.programs} queue={dashboard.queue} />
    </div>
  </div>;
}

function MetricCard({ label, value, tone, detail }: { label: string; value: number | string; tone: "orange" | "purple" | "green"; detail?: string }) {
  const bars = [14, 27, 19, 31, 23];
  return <dl className={`metric-card ${tone === "purple" ? "metric-card-purple" : tone === "green" ? "metric-card-green" : ""}`}><dt>{label}</dt><div className="flex items-end justify-between gap-3"><dd>{value}</dd><div className={`mini-bars ${tone === "purple" ? "mini-bars-purple" : tone === "green" ? "mini-bars-green" : ""}`} aria-hidden="true">{bars.map((height, index) => <span key={index} style={{ height: `${height}px` }} />)}</div></div>{detail ? <small>{detail}</small> : null}</dl>;
}

function SectionHeading({ id, title, count, action, tone = "success" }: { id: string; title: string; count: number; action: React.ReactNode; tone?: "success" | "warning" | "danger" }) {
  return <div className={`section-heading ${tone === "warning" ? "warning" : tone === "danger" ? "danger" : ""}`}><h2 id={id}>{title}<span className="section-count">{count}</span></h2>{action}</div>;
}

function ProgramCard({ program }: { program: DashboardProgramDto }) {
  const coverage = program.observationCount ? Math.round((program.submittedObservationCount / program.observationCount) * 100) : null;
  return <article className="workspace-card p-3.5"><div className="flex items-start gap-2.5"><span className="profile-monogram bg-accent-soft text-accent-hover"><FolderKanban size={16} aria-hidden="true" /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="truncate text-xs font-semibold text-ink">{program.name}</h3><p className="mt-0.5 truncate text-[0.5625rem] text-slate">{program.code ?? "Programa"} · {program.cohortCount} {program.cohortCount === 1 ? "coorte" : "coortes"}</p></div><StatusBadge label={programStatusLabel(program.status)} tone={program.status === "ACTIVE" ? "success" : "neutral"} /></div></div></div><div className="mt-3"><div className="mb-1 flex items-center justify-between gap-2 text-[0.5625rem] text-slate"><span>Execução registrada</span><span>{coverage === null ? "Sem observações" : `${coverage}%`}</span></div><span className="progress-track progress-track-purple"><span style={{ width: `${coverage ?? 0}%` }} /></span></div><div className="mt-3 flex items-center justify-between gap-2 text-[0.5625rem] text-slate"><span>{program.ventureCount} {program.ventureCount === 1 ? "empreendimento" : "empreendimentos"}</span><span>{program.nextLabel ? `Próximo: ${program.nextLabel}` : "Sem próximo marco"}</span></div><Link href={`/app/programs/${program.id}`} className="mt-3 inline-flex min-h-8 items-center gap-1 text-[0.625rem] font-semibold text-accent-hover hover:underline">Abrir programa <ArrowRight size={13} aria-hidden="true" /></Link></article>;
}

function QueueTable({ items }: { items: FollowUpQueueItemDto[] }) {
  return <div className="workspace-card overflow-hidden"><table className="data-table"><caption className="sr-only">Acompanhamentos prioritários</caption><thead><tr><th>Empreendimento</th><th>Onda</th><th>Prazo</th><th>Status</th><th><span className="sr-only">Ação</span></th></tr></thead><tbody>{items.map((item) => <QueueRow key={item.id} item={item} />)}</tbody></table><div className="mobile-records">{items.map((item) => <MobileQueueRow key={item.id} item={item} />)}</div></div>;
}

function QueueRow({ item }: { item: FollowUpQueueItemDto }) {
  return <tr><td><div className="flex items-center gap-2.5"><span className="profile-monogram h-7 w-7 rounded-lg text-[0.5625rem]">{initials(item.ventureName)}</span><span><strong className="font-semibold">{item.ventureName}</strong><small>{item.programName} · {item.cohortName}</small></span></div></td><td>{item.waveName}<small>Onda {item.waveSequence}</small></td><td>{formatDate(item.dueAt)}<small>{queueDueLabel(item)}</small></td><td><QueueStatus item={item} /></td><td><Link href={`/app/follow-ups#${item.id}`} className="button-secondary min-h-8 px-2.5 text-[0.5625rem]">Abrir</Link></td></tr>;
}

function MobileQueueRow({ item }: { item: FollowUpQueueItemDto }) {
  return <article id={item.id} className="mobile-record"><div className="min-w-0"><p>{item.ventureName}</p><small>{item.programName} · {item.cohortName}</small></div><QueueStatus item={item} /><div className="mobile-record-meta"><span>{item.waveName}</span><span>{formatDate(item.dueAt)}</span><Link href={`/app/follow-ups#${item.id}`} className="font-semibold text-accent-hover">Abrir</Link></div></article>;
}

function QueueStatus({ item }: { item: FollowUpQueueItemDto }) {
  const config = item.bucket === "OVERDUE" ? { label: "Em atraso", tone: "danger" as const } : item.bucket === "REVIEW" ? { label: "Em revisão", tone: "warning" as const } : item.bucket === "TODAY" ? { label: "Vence hoje", tone: "accent" as const } : item.bucket === "COMPLETED" ? { label: "Enviada", tone: "success" as const } : { label: "Agendada", tone: "neutral" as const };
  return <StatusBadge label={config.label} tone={config.tone} />;
}

function DashboardRail({ programs, queue }: { programs: DashboardProgramDto[]; queue: FollowUpQueueItemDto[] }) {
  const upcoming = programs.filter((program) => program.nextDate).sort((left, right) => (left.nextDate ?? "").localeCompare(right.nextDate ?? "")).slice(0, 4);
  const openToday = queue.filter((item) => item.bucket === "TODAY").slice(0, 4);
  return <aside className="right-rail" aria-label="Agenda e próximos marcos"><div className="right-rail-header"><h2>{openToday.length ? "Agenda de hoje" : "Próximos marcos"}</h2><span className="section-count">{openToday.length || upcoming.length}</span></div>{openToday.length ? openToday.map((item) => <div className="right-rail-item" key={item.id}><div className="flex items-start gap-2"><CalendarClock size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" /><div><p>{item.ventureName}</p><small>{item.waveName} · {formatDate(item.dueAt)}</small></div></div></div>) : upcoming.length ? upcoming.map((program) => <div className="right-rail-item" key={program.id}><div className="flex items-start gap-2"><LineChart size={14} className="mt-0.5 shrink-0 text-data-purple" aria-hidden="true" /><div><p>{program.nextLabel}</p><small>{program.name} · {formatDate(program.nextDate)}</small></div></div></div>) : <p className="px-3.5 py-4 text-xs text-slate">Nenhum marco com data definida.</p>}<div className="border-t border-line p-3.5"><Link href="/app/follow-ups" className="button-secondary w-full text-[0.625rem]">Ver acompanhamentos</Link></div></aside>;
}

function EmptyState({ text, detail, href, action }: { text: string; detail: string; href: string; action: string }) {
  return <div className="workspace-empty"><p className="font-semibold text-ink">{text}</p><p className="mt-1 max-w-[44ch] text-xs leading-5 text-slate">{detail}</p><Link href={href} className="mt-4 inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-accent-hover hover:underline">{action} <ArrowRight size={13} aria-hidden="true" /></Link></div>;
}

function EmptyWorkspace() {
  return <section className="workspace-empty max-w-xl"><h1 className="text-xl font-semibold tracking-tight text-ink">Escolha uma organização</h1><p className="mt-2 text-sm text-slate">Selecione o espaço institucional em que deseja trabalhar.</p><Link href="/app/organizations" className="button-primary mt-6">Ver organizações</Link></section>;
}

function initials(name: string): string { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function formatDate(value: string | null): string { return value ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Fortaleza" }).format(new Date(value)) : "Sem prazo"; }
function queueDueLabel(item: FollowUpQueueItemDto): string { if (!item.dueAt) return "Sem prazo"; if (item.bucket === "OVERDUE") return "Em atraso"; if (item.bucket === "TODAY") return "Hoje"; if (item.bucket === "REVIEW") return "Em revisão"; if (item.bucket === "COMPLETED") return "Enviada"; return "Agendada"; }
function programStatusLabel(status: string): string { return ({ ACTIVE: "Em execução", DRAFT: "Rascunho", CLOSED: "Encerrado", ARCHIVED: "Arquivado" } as Record<string, string>)[status] ?? status; }
