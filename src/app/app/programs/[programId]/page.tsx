import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { ProgramDetailActions } from "@/components/program-detail-actions";
import { hasAtLeastRole } from "@/lib/auth/authorization";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { getOrganizationProgram } from "@/lib/programs/service";
import { listProgramCohorts } from "@/lib/cohorts/service";
import { listProgramFundingCalls } from "@/lib/funding-calls/service";
import { listTrackingProtocols } from "@/lib/tracking-protocols/service";
import { fundingCallStatusLabels } from "@/lib/funding-calls/presentation";
import { Breadcrumbs, PageHeader, Panel, PanelHeader, StatusBadge, statusTone } from "@/components/ui";

type PageProps = { params: Promise<{ programId: string }> };

export default async function ProgramDetailPage({ params }: PageProps) {
  const context = await getActiveOrganizationContext();
  if (!context) redirect("/app/organizations");
  const { programId } = await params;
  const program = await getOrganizationProgram(context.organization.id, programId);
  if (!program) notFound();
  const [calls, cohorts, protocols] = await Promise.all([
    listProgramFundingCalls(context.organization.id, programId),
    listProgramCohorts(context.organization.id, programId),
    listTrackingProtocols(context.organization.id),
  ]);
  const canManage = hasAtLeastRole(context.membership.role, "MANAGER");

  return <div className="space-y-7">
    <PageHeader breadcrumbs={<Breadcrumbs items={[{ label: "Programas", href: "/app/programs" }, { label: program.name }]} />} title={program.name} description={program.code ? `Código ${program.code}` : "Editais, coortes e acompanhamento deste programa."} action={<ProgramDetailActions organizationId={context.organization.id} program={program} canManage={canManage} fundingCalls={calls} protocols={protocols} />} />
    {program.description ? <p className="max-w-3xl border-y border-line py-4 text-sm leading-6 text-slate">{program.description}</p> : null}
    <section className="flex flex-wrap items-center justify-between gap-4 border-y border-line py-4"><div><h2 className="text-sm font-semibold">Análises do programa</h2><p className="mt-1 text-sm text-slate">Seleção, execução e resultados observados com seus respectivos universos.</p></div><Link href={`/app/analytics/programs/${programId}`} className="button-secondary">Consultar análises <ArrowRight size={16} aria-hidden="true" /></Link></section>
    <Panel><PanelHeader title="Editais" description="Chamadas específicas e seus grupos de acompanhamento." />
      {calls.length ? <div className="divide-y divide-line">{calls.map((call) => <Link key={call.id} href={`/app/programs/${programId}/calls/${call.id}`} className="block px-5 py-5 transition-colors hover:bg-surface-subtle sm:px-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="flex items-center gap-2 text-xs font-medium text-slate"><FileText size={14} aria-hidden="true" />{call.callNumber}</p><h3 className="mt-1 break-words font-medium text-ink">{call.title}</h3><p className="mt-1 text-sm text-slate">{call.cohortCount} {call.cohortCount === 1 ? "coorte" : "coortes"} · Inscrições {dateRange(call.applicationStartsAt, call.applicationEndsAt)}</p></div><span className="inline-flex shrink-0 items-center gap-2"><StatusBadge label={fundingCallStatusLabels[call.status] ?? call.status} tone={statusTone(call.status)} /><ArrowRight size={15} className="text-accent-hover" aria-hidden="true" /></span></div></Link>)}</div> : <div className="px-6 py-9"><h3 className="font-medium text-ink">Registre a primeira chamada do programa</h3><p className="mt-2 max-w-xl text-sm leading-6 text-slate">O edital organiza uma chamada de fomento e dá origem às coortes acompanhadas. {canManage && ["DRAFT", "ACTIVE"].includes(program.status) ? "Use Novo edital para começar." : "Um gestor pode cadastrar editais em um programa ativo ou em rascunho."}</p></div>}
    </Panel>
    <Panel><PanelHeader title="Coortes" description="Grupos comparáveis, com uma versão de protocolo preservada ao longo do tempo." />
      {cohorts.length ? <div className="divide-y divide-line">{cohorts.map((cohort) => <Link key={cohort.id} href={`/app/programs/${program.id}/cohorts/${cohort.id}`} className="block px-5 py-5 transition-colors hover:bg-surface-subtle sm:px-6"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><h3 className="break-words font-medium text-ink">{cohort.name}</h3><p className="mt-1 text-sm text-slate">{cohort.fundingCall ? `Edital ${cohort.fundingCall.callNumber}` : "Sem edital de origem"} · {cohort.referenceYear ? `${cohort.referenceYear} · ` : ""}{dateRange(cohort.startsAt, cohort.endsAt)}</p><p className="mt-1 text-sm text-slate">{cohort.ventureCount} {cohort.ventureCount === 1 ? "empreendimento" : "empreendimentos"} · {cohort.waveCount} {cohort.waveCount === 1 ? "onda" : "ondas"} · {cohort.trackingProtocolVersion ? `${cohort.trackingProtocolVersion.trackingProtocol.name} v${cohort.trackingProtocolVersion.version}` : "Protocolo a configurar"}</p></div><span className="inline-flex shrink-0 items-center gap-2"><StatusBadge label={statusLabel(cohort.status)} tone={statusTone(cohort.status)} /><ArrowRight size={15} className="text-accent-hover" aria-hidden="true" /></span></div></Link>)}</div> : <div className="px-6 py-9"><h3 className="font-medium text-ink">Organize o primeiro grupo de acompanhamento</h3><p className="mt-2 max-w-xl text-sm leading-6 text-slate">Uma coorte reúne empreendimentos de um mesmo ciclo. Crie a coorte a partir de um edital ou diretamente neste programa e selecione um protocolo antes da primeira onda.</p></div>}
    </Panel>
  </div>;
}

function statusLabel(status: string) {
  return ({ ACTIVE: "Ativa", CLOSED: "Encerrada", ARCHIVED: "Arquivada", PLANNED: "Planejada" } as Record<string, string>)[status] ?? status;
}

function dateRange(startsAt: string | null, endsAt: string | null) {
  if (!startsAt && !endsAt) return "sem período informado";
  const format = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
  return `${startsAt ? format(startsAt) : "sem início"} – ${endsAt ? format(endsAt) : "sem fim"}`;
}
