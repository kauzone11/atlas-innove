"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, FolderKanban, Plus, Search } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Dialog } from "@/components/dialog";
import { StatusBadge } from "@/components/ui";
import type { DashboardProgramDto } from "@/lib/dashboard/service";

export function ProgramsManager({ organizationId, programs, canManage }: { organizationId: string; programs: DashboardProgramDto[]; canManage: boolean }) {
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "DRAFT" | "CLOSED">("ALL");
  const [query, setQuery] = useState("");
  const featured = programs.find((program) => program.status === "ACTIVE") ?? programs[0];
  const filteredPrograms = useMemo(() => programs.filter((program) => {
    const matchesFilter = filter === "ALL" || program.status === filter;
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    return matchesFilter && (!normalizedQuery || `${program.name} ${program.code ?? ""}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery));
  }), [filter, programs, query]);

  return <div>
    <div className="workspace-toolbar"><div className="filter-pills" aria-label="Filtrar programas">{(["ALL", "ACTIVE", "DRAFT", "CLOSED"] as const).map((value) => <button key={value} type="button" className={`filter-pill ${filter === value ? "is-active" : ""}`} onClick={() => setFilter(value)}>{filterLabel(value)}{value === "ALL" ? ` · ${programs.length}` : ` · ${programs.filter((program) => program.status === value).length}`}</button>)}</div><div className="flex items-center gap-2"><label className="relative block w-full sm:w-52"><span className="sr-only">Buscar programa</span><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate" aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar programa…" className="field-control h-9 min-h-9 rounded-full pl-8 text-xs" /></label>{canManage ? <CreateProgramButton organizationId={organizationId} /> : null}</div></div>

    {featured ? <div className="workspace-grid-with-rail mb-4"><FeaturedProgram program={featured} /><UpcomingMilestones programs={programs} /></div> : null}
    <section className="workspace-card overflow-hidden" aria-labelledby="all-programs"><div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-3.5 sm:px-4"><h2 id="all-programs" className="text-sm font-semibold text-ink">Todos os programas</h2><span className="text-[0.5625rem] text-slate">{filteredPrograms.length} {filteredPrograms.length === 1 ? "programa" : "programas"}</span></div>{filteredPrograms.length ? <ProgramTable programs={filteredPrograms} /> : <div className="workspace-empty m-3.5"><p className="font-semibold text-ink">Nenhum programa encontrado</p><p className="mt-1 text-xs text-slate">Ajuste a busca ou remova os filtros para ver outros programas.</p></div>}</section>
  </div>;
}

function CreateProgramButton({ organizationId }: { organizationId: string }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className="button-primary min-h-9 whitespace-nowrap" onClick={() => setOpen(true)}><Plus size={14} aria-hidden="true" /> Novo programa</button><Dialog open={open} onClose={() => setOpen(false)} title="Novo programa" description="Registre uma iniciativa de apoio para começar a organizar suas coortes."><CreateProgramForm organizationId={organizationId} onSuccess={() => setOpen(false)} /></Dialog></>;
}

function FeaturedProgram({ program }: { program: DashboardProgramDto }) {
  const coverage = program.observationCount ? Math.round((program.submittedObservationCount / program.observationCount) * 100) : null;
  return <article className="workspace-card p-3.5 sm:p-4"><div className="flex items-start gap-2.5"><span className="profile-monogram bg-accent-soft text-accent-hover"><FolderKanban size={16} aria-hidden="true" /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-ink">{program.name}</h2><p className="mt-0.5 text-[0.5625rem] text-slate">{program.code ?? "Programa de apoio"}</p></div><StatusBadge label={programStatusLabel(program.status)} tone={program.status === "ACTIVE" ? "success" : "neutral"} /></div></div></div><div className="mt-3 grid grid-cols-3 overflow-hidden rounded-[0.6875rem] bg-line"><Fact label="Coortes" value={program.cohortCount} /><Fact label="Empreendimentos" value={program.ventureCount} /><Fact label="Acompanhamentos" value={program.waveCount} /></div><div className="mt-3"><div className="mb-1 flex items-center justify-between text-[0.5625rem] text-slate"><span>Progresso registrado</span><span>{coverage === null ? "Sem observações" : `${coverage}%`}</span></div><span className="progress-track progress-track-purple"><span style={{ width: `${coverage ?? 0}%` }} /></span></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-[0.625rem] text-slate">{program.nextLabel ? `Próximo marco: ${program.nextLabel}` : "Nenhum próximo marco com data definida"}</p><Link href={`/app/programs/${program.id}`} className="button-secondary min-h-8 text-[0.625rem]">Abrir programa <ArrowRight size={13} aria-hidden="true" /></Link></div></article>;
}

function UpcomingMilestones({ programs }: { programs: DashboardProgramDto[] }) {
  const upcoming = programs.filter((program) => program.nextDate).sort((left, right) => (left.nextDate ?? "").localeCompare(right.nextDate ?? "")).slice(0, 3);
  return <aside className="right-rail"><div className="right-rail-header"><h2>Próximos marcos</h2><span className="section-count">{upcoming.length}</span></div>{upcoming.length ? upcoming.map((program) => <div key={program.id} className="right-rail-item"><div className="flex items-start gap-2"><CalendarDays size={14} className="mt-0.5 shrink-0 text-data-purple" aria-hidden="true" /><div><p>{program.nextLabel}</p><small>{program.name} · {formatDate(program.nextDate)}</small></div></div></div>) : <p className="px-3.5 py-4 text-xs text-slate">Nenhum marco com data definida.</p>}</aside>;
}

function ProgramTable({ programs }: { programs: DashboardProgramDto[] }) {
  return <><table className="data-table"><caption className="sr-only">Programas da organização</caption><thead><tr><th>Programa</th><th>Etapa</th><th>Empreendimentos</th><th>Próximo marco</th><th>Execução</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{programs.map((program) => <tr key={program.id}><td><div className="flex items-center gap-2.5"><span className="profile-monogram h-7 w-7 rounded-lg bg-accent-soft text-accent-hover"><FolderKanban size={13} aria-hidden="true" /></span><span><strong className="font-semibold">{program.name}</strong><small>{program.code ?? "Sem código"}</small></span></div></td><td><StatusBadge label={programStatusLabel(program.status)} tone={program.status === "ACTIVE" ? "success" : "neutral"} /></td><td>{program.ventureCount}</td><td>{program.nextDate ? formatDate(program.nextDate) : "—"}<small>{program.nextLabel ?? "Sem marco"}</small></td><td><div className="w-24"><span className="progress-track progress-track-purple"><span style={{ width: `${program.observationCount ? Math.round((program.submittedObservationCount / program.observationCount) * 100) : 0}%` }} /></span><small>{program.observationCount ? `${Math.round((program.submittedObservationCount / program.observationCount) * 100)}%` : "—"}</small></div></td><td><Link href={`/app/programs/${program.id}`} className="button-secondary min-h-8 px-2.5 text-[0.5625rem]">Abrir</Link></td></tr>)}</tbody></table><div className="mobile-records">{programs.map((program) => <article key={program.id} className="mobile-record"><div className="min-w-0"><p>{program.name}</p><small>{program.code ?? "Sem código"} · {program.ventureCount} {program.ventureCount === 1 ? "empreendimento" : "empreendimentos"}</small></div><StatusBadge label={programStatusLabel(program.status)} tone={program.status === "ACTIVE" ? "success" : "neutral"} /><div className="mobile-record-meta"><span>{program.nextLabel ?? "Sem próximo marco"}</span><span>{program.observationCount ? `${Math.round((program.submittedObservationCount / program.observationCount) * 100)}% registrado` : "Sem observações"}</span><Link href={`/app/programs/${program.id}`} className="font-semibold text-accent-hover">Abrir</Link></div></article>)}</div></>;
}

function Fact({ label, value }: { label: string; value: number }) { return <div className="bg-surface-subtle px-2.5 py-2"><small className="block text-[0.5rem] text-slate">{label}</small><strong className="mt-0.5 block text-xs font-semibold text-ink">{value}</strong></div>; }
function filterLabel(value: "ALL" | "ACTIVE" | "DRAFT" | "CLOSED"): string { return ({ ALL: "Todos", ACTIVE: "Em execução", DRAFT: "Rascunho", CLOSED: "Encerrados" } as Record<typeof value, string>)[value]; }
function programStatusLabel(status: string): string { return ({ ACTIVE: "Em execução", DRAFT: "Rascunho", CLOSED: "Encerrado", ARCHIVED: "Arquivado" } as Record<string, string>)[status] ?? status; }
function formatDate(value: string | null): string { return value ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Fortaleza" }).format(new Date(value)) : "Sem data"; }

function CreateProgramForm({ organizationId, onSuccess }: { organizationId: string; onSuccess?: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(null);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/programs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, slug, code: code || null, description: description || null }) });
      const payload = (await response.json()) as { program?: { id: string }; error?: string };
      if (!response.ok || !payload.program) { setError(payload.error ?? "Não foi possível criar o programa."); return; }
      onSuccess?.(); router.push(`/app/programs/${payload.program.id}`);
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }

  return <form onSubmit={submit} className="space-y-5"><div className="grid gap-4 md:grid-cols-2"><Field id="program-name" label="Nome" value={name} onChange={(value) => { setName(value); if (!slugManuallyEdited) setSlug(slugify(value)); }} required /><Field id="program-slug" label="Identificador" value={slug} onChange={(value) => { setSlug(value); setSlugManuallyEdited(true); }} required hint="Gerado a partir do nome; ajuste apenas se precisar." /><Field id="program-code" label="Código" value={code} onChange={setCode} /><label className="block space-y-2 text-sm font-medium text-ink md:col-span-2"><span>Descrição</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={2000} className="field-control" /></label></div>{error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}<button disabled={pending} className="button-primary w-full">{pending ? "Salvando…" : "Criar programa"}</button></form>;
}

function Field({ id, label, value, onChange, required, hint }: { id: string; label: string; value: string; onChange: (value: string) => void; required?: boolean; hint?: string }) { return <label htmlFor={id} className="block space-y-2 text-sm font-medium text-ink"><span>{label}</span><input id={id} value={value} onChange={(event) => onChange(event.target.value)} required={required} className="field-control" />{hint ? <span className="block text-xs font-normal text-slate">{hint}</span> : null}</label>; }
function slugify(value: string): string { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64); }
