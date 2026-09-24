import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { ProgramDetailActions } from "@/components/program-detail-actions";
import { hasAtLeastRole } from "@/lib/auth/authorization";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { getOrganizationProgram } from "@/lib/programs/service";
import { Breadcrumbs, PageHeader, Panel, PanelHeader, StatusBadge, statusTone } from "@/components/ui";

type PageProps = { params: Promise<{ programId: string }> };

export default async function ProgramDetailPage({ params }: PageProps) {
  const context = await getActiveOrganizationContext();
  if (!context) redirect("/app/organizations");
  const { programId } = await params;
  const program = await getOrganizationProgram(context.organization.id, programId);
  if (!program) notFound();
  const canManage = hasAtLeastRole(context.membership.role, "MANAGER");

  return <div className="space-y-7"><PageHeader breadcrumbs={<Breadcrumbs items={[{ label: "Programas", href: "/app/programs" }, { label: program.name }]} />} title={program.name} description={program.code ? `Código ${program.code}` : undefined} action={<ProgramDetailActions organizationId={context.organization.id} program={program} canManage={canManage} />} /><div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-line py-4 text-sm text-slate"><span>Identificador <strong className="font-medium text-ink">{program.slug}</strong></span>{program.description ? <span className="basis-full max-w-3xl leading-6">{program.description}</span> : null}</div><Panel><PanelHeader title="Coortes" />{program.cohorts.length ? <div className="divide-y divide-line">{program.cohorts.map((cohort) => <Link key={cohort.id} href={`/app/programs/${program.id}/cohorts/${cohort.id}`} className="block px-6 py-5 transition-colors hover:bg-surface-subtle"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-medium text-ink">{cohort.name}</h3><p className="mt-1 text-sm text-slate">{cohort.referenceYear ? `${cohort.referenceYear} · ` : ""}{dateRange(cohort.startsAt, cohort.endsAt)} · {cohort.ventureCount} {cohort.ventureCount === 1 ? "empreendimento inscrito" : "empreendimentos inscritos"}</p></div><span className="inline-flex shrink-0 items-center gap-2"><StatusBadge label={statusLabel(cohort.status)} tone={statusTone(cohort.status)} /><ArrowRight size={15} className="text-accent-hover" aria-hidden="true" /></span></div></Link>)}</div> : <p className="px-6 py-10 text-sm text-slate">Nenhuma coorte cadastrada neste programa.</p>}</Panel></div>;
}

function statusLabel(status: string) {
  return ({ DRAFT: "Rascunho", ACTIVE: "Ativo", CLOSED: "Encerrado", ARCHIVED: "Arquivado", PLANNED: "Planejada" } as Record<string, string>)[status] ?? status;
}

function dateRange(startsAt: string | null, endsAt: string | null) {
  if (!startsAt && !endsAt) return "Datas não informadas";
  const format = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
  return `${startsAt ? format(startsAt) : "Sem início"} – ${endsAt ? format(endsAt) : "sem fim"}`;
}
