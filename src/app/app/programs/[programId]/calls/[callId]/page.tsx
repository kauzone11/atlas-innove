import Link from "next/link";
import { ArrowRight, ExternalLink, FileText } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { FundingCallActions, FundingCallDocumentAction } from "@/components/funding-call-actions";
import { FundingCallNavigation } from "@/components/funding-call-navigation";
import { DocumentVisibilityAction } from "@/components/opportunities/funding-call-discovery";
import { supportTypeLabels, territoryScopeLabels } from "@/lib/opportunities/presentation";
import { Breadcrumbs, PageHeader, Panel, PanelHeader, StatusBadge, statusTone } from "@/components/ui";
import { hasAtLeastRole } from "@/lib/auth/authorization";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { listProgramCohorts } from "@/lib/cohorts/service";
import { getFundingCall } from "@/lib/funding-calls/service";
import { fundingCallDocumentTypeLabels } from "@/lib/funding-calls/presentation";
import { getOrganizationProgram } from "@/lib/programs/service";
import { listTrackingProtocols } from "@/lib/tracking-protocols/service";

type PageProps = { params: Promise<{ programId: string; callId: string }> };

export default async function FundingCallPage({ params }: PageProps) {
  const context = await getActiveOrganizationContext();
  if (!context) redirect("/app/organizations");
  const { programId, callId } = await params;
  const call = await getFundingCall(context.organization.id, programId, callId);
  if (!call) notFound();
  const [allCohorts, protocols, program] = await Promise.all([listProgramCohorts(context.organization.id, programId), listTrackingProtocols(context.organization.id), getOrganizationProgram(context.organization.id, programId)]);
  const cohorts = allCohorts.filter((cohort) => cohort.fundingCallId === callId);
  const canManage = hasAtLeastRole(context.membership.role, "MANAGER");

  return <div className="space-y-7">
    <PageHeader breadcrumbs={<Breadcrumbs items={[{ label: "Programas", href: "/app/programs" }, { label: call.fundingProgram.name, href: `/app/programs/${programId}` }, { label: `Edital ${call.callNumber}` }]} />} title={call.shortTitle || call.title} description={`Edital ${call.callNumber} · ${call.fundingProgram.name}`} action={<FundingCallActions organizationId={context.organization.id} call={call} protocols={protocols} canManage={canManage} canCreateCohort={Boolean(program && ["DRAFT", "ACTIVE"].includes(program.status))} />} />
    <FundingCallNavigation programId={programId} callId={callId} />
    {call.objective ? <p className="max-w-3xl text-sm leading-7 text-slate">{call.objective}</p> : null}
    <dl className="grid gap-x-8 gap-y-5 border-y border-line py-5 sm:grid-cols-2 lg:grid-cols-4">
      <Metadata label="Publicação">{dateLabel(call.publishedAt)}</Metadata>
      <Metadata label="Abertura das inscrições">{dateLabel(call.applicationStartsAt)}</Metadata>
      <Metadata label="Encerramento das inscrições">{dateLabel(call.applicationEndsAt)}</Metadata>
      <Metadata label="Orçamento total">{moneyLabel(call.totalBudget)}</Metadata>
      <Metadata label="Apoio máximo por projeto">{moneyLabel(call.maximumSupport)}</Metadata>
      <Metadata label="Projetos previstos">{call.targetProjects ?? "Não informado"}</Metadata>
      <Metadata label="Prazo de execução">{call.executionMonths ? `${call.executionMonths} meses` : "Não informado"}</Metadata>
      <Metadata label="Fonte">{call.sourceUrl ? <a href={call.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-accent-hover underline underline-offset-4">Abrir publicação <ExternalLink size={13} aria-hidden="true" /></a> : "Não informada"}</Metadata>
      <Metadata label="Candidaturas pela plataforma">{call.applicationsEnabled ? "Habilitadas neste edital" : "Não habilitadas"}</Metadata>
      <Metadata label="Descoberta pública">{call.publicListingEnabled ? call.status === "DRAFT" ? "Habilitada · aguardando saída do rascunho" : <Link href={`/opportunities/calls/${call.id}`} className="inline-flex min-h-11 items-center py-2 text-accent-hover underline underline-offset-4">Edital listado publicamente</Link> : "Não listado"}</Metadata>
      <Metadata label="Tipo de apoio">{supportTypeLabels[call.supportType]}</Metadata>
      <Metadata label="Território">{call.territoryLabel || territoryScopeLabels[call.territoryScope]}{call.eligibleStates.length ? ` · ${call.eligibleStates.join(", ")}` : ""}</Metadata>
      <Metadata label="Público">{call.audienceTags.join(" · ") || "Não informado"}</Metadata>
      <Metadata label="Áreas temáticas">{call.thematicAreas.join(" · ") || "Não informadas"}</Metadata>
    </dl>
    <Panel><PanelHeader title="Acompanhamento" description="Coortes originadas neste edital e preservadas após o fim da chamada." />
      {cohorts.length ? <div className="divide-y divide-line">{cohorts.map((cohort) => <Link key={cohort.id} href={`/app/programs/${programId}/cohorts/${cohort.id}`} className="block px-5 py-5 transition-colors hover:bg-surface-subtle sm:px-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><h3 className="break-words font-medium text-ink">{cohort.name}</h3><p className="mt-1 text-sm text-slate">{cohort.ventureCount} {cohort.ventureCount === 1 ? "empreendimento" : "empreendimentos"} · {cohort.waveCount} {cohort.waveCount === 1 ? "onda" : "ondas"}</p><p className="mt-1 text-sm text-slate">{cohort.trackingProtocolVersion ? `${cohort.trackingProtocolVersion.trackingProtocol.name} · v${cohort.trackingProtocolVersion.version}` : "Protocolo a configurar"}</p></div><span className="inline-flex shrink-0 items-center gap-2"><StatusBadge label={({ PLANNED: "Planejada", ACTIVE: "Ativa", CLOSED: "Encerrada", ARCHIVED: "Arquivada" } as Record<string, string>)[cohort.status] ?? cohort.status} tone={statusTone(cohort.status)} /><ArrowRight size={15} aria-hidden="true" className="text-accent-hover" /></span></div></Link>)}</div> : <div className="px-6 py-9"><h3 className="font-medium text-ink">O acompanhamento começa com uma coorte</h3><p className="mt-2 max-w-xl text-sm leading-6 text-slate">Crie um grupo para acompanhar os empreendimentos apoiados, aplicar um protocolo e registrar sua trajetória ao longo das ondas.</p></div>}
    </Panel>
    <Panel><PanelHeader title="Documentos" description="Publicações e anexos vinculados ao edital." action={<FundingCallDocumentAction organizationId={context.organization.id} call={call} canManage={canManage} />} />
      {call.documents.length ? <ul className="divide-y divide-line">{call.documents.map((document) => <li key={document.id}><a href={document.externalUrl} target="_blank" rel="noreferrer" className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-surface-subtle sm:px-6"><FileText size={18} aria-hidden="true" className="mt-1 shrink-0 text-slate" /><div className="min-w-0 flex-1"><p className="break-words font-medium text-ink">{document.title}</p><p className="mt-1 text-sm text-slate">{fundingCallDocumentTypeLabels[document.type] ?? document.type}{document.publishedAt ? ` · ${dateLabel(document.publishedAt)}` : ""} · {document.publicListingEnabled ? "Disponível no público" : "Institucional"}</p></div><ExternalLink size={15} aria-hidden="true" className="mt-1 shrink-0 text-accent-hover" /></a>{canManage ? <div className="px-5 pb-4 sm:px-6"><DocumentVisibilityAction organizationId={context.organization.id} programId={programId} callId={callId} document={document} /></div> : null}</li>)}</ul> : <p className="px-6 py-9 text-sm leading-6 text-slate">Nenhum documento vinculado. Adicione o link do edital, anexos, retificações ou resultados para manter a referência da chamada.</p>}
    </Panel>
  </div>;
}

function Metadata({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs font-medium text-slate">{label}</dt><dd className="mt-1 text-sm text-ink">{children}</dd></div>;
}
function dateLabel(value: string | null) { return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value)) : "Não informada"; }
function moneyLabel(value: string | null) { return value !== null ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value)) : "Não informado"; }
