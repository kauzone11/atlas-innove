import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { CohortCreateForm } from "@/components/cohort-create-form";
import { hasAtLeastRole } from "@/lib/auth/authorization";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { getOrganizationProgram } from "@/lib/programs/service";
import { listCohortVentures } from "@/lib/ventures/service";

type PageProps = { params: Promise<{ programId: string }> };

export default async function ProgramDetailPage({ params }: PageProps) {
  const context = await getActiveOrganizationContext();
  if (!context) redirect("/app/organizations");
  const { programId } = await params;
  const program = await getOrganizationProgram(context.organization.id, programId);
  if (!program) notFound();
  const cohortVentures = await Promise.all(program.cohorts.map(async (cohort) => ({ cohort, ventures: await listCohortVentures(context.organization.id, cohort.id) })));
  const canManage = hasAtLeastRole(context.membership.role, "MANAGER");

  return <div className="space-y-7"><Link href="/app/programs" className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:text-accent-dark"><ArrowLeft size={16} aria-hidden="true" /> Voltar para programas</Link><section className="rounded-2xl border border-line bg-white p-6 shadow-panel"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Programa</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{program.name}</h1><p className="mt-2 text-sm text-slate">{program.code ? `Código ${program.code} · ` : ""}{statusLabel(program.status)}</p></div><span className="rounded-full bg-canvas px-3 py-1 text-sm text-slate">{program.slug}</span></div>{program.description ? <p className="mt-5 max-w-3xl leading-7 text-slate">{program.description}</p> : null}</section>{canManage ? <CohortCreateForm organizationId={context.organization.id} programId={program.id} /> : null}<section className="rounded-2xl border border-line bg-white shadow-panel"><div className="border-b border-line px-6 py-5"><h2 className="font-semibold text-ink">Coortes</h2><p className="mt-1 text-sm text-slate">Ciclos de entrada para o acompanhamento dos empreendimentos.</p></div>{cohortVentures.length ? <div className="divide-y divide-line">{cohortVentures.map(({ cohort, ventures }) => <div key={cohort.id} className="px-6 py-5"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-medium text-ink">{cohort.name}</h3><p className="mt-1 text-sm text-slate">{cohort.referenceYear ? `${cohort.referenceYear} · ` : ""}{dateRange(cohort.startsAt, cohort.endsAt)}</p></div><span className="text-sm text-accent">{statusLabel(cohort.status)}</span></div><div className="mt-4 flex items-center justify-between gap-4"><p className="text-sm text-slate">{ventures.length ? `${ventures.length} ${ventures.length === 1 ? "empreendimento inscrito" : "empreendimentos inscritos"}` : "Nenhum empreendimento inscrito"}</p><Link href={`/app/ventures?cohortId=${cohort.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:text-accent-dark"><BriefcaseBusiness size={15} aria-hidden="true" /> Ver empreendimentos</Link></div>{ventures.length ? <ul className="mt-3 grid gap-2 text-sm text-ink sm:grid-cols-2">{ventures.slice(0, 6).map((entry) => <li key={entry.id}>{entry.venture.name}</li>)}</ul> : null}</div>)}</div> : <p className="px-6 py-10 text-sm text-slate">Nenhuma coorte cadastrada neste programa.</p>}</section></div>;
}

function statusLabel(status: string) {
  return ({ DRAFT: "Rascunho", ACTIVE: "Ativo", CLOSED: "Encerrado", ARCHIVED: "Arquivado", PLANNED: "Planejada" } as Record<string, string>)[status] ?? status;
}

function dateRange(startsAt: string | null, endsAt: string | null) {
  if (!startsAt && !endsAt) return "Datas não informadas";
  const format = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
  return `${startsAt ? format(startsAt) : "Sem início"} – ${endsAt ? format(endsAt) : "sem fim"}`;
}
