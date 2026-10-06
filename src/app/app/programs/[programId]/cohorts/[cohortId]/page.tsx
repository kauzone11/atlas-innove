import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { CohortDetailActions } from "@/components/cohort-detail-actions";
import { CohortEnrollmentManager } from "@/components/cohort-enrollment-manager";
import { FollowUpWaveManager } from "@/components/follow-up-wave-manager";
import { hasAtLeastRole } from "@/lib/auth/authorization";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { getCohortWorkspace } from "@/lib/follow-up/service";
import { listOrganizationVentures } from "@/lib/ventures/service";
import { getOrganizationCohort } from "@/lib/cohorts/service";
import { listProgramFundingCalls } from "@/lib/funding-calls/service";
import { listTrackingProtocols } from "@/lib/tracking-protocols/service";
import { getCohortResults } from "@/lib/monitoring/read-model";
import { CohortResults } from "@/components/cohort-results";
import { Breadcrumbs, PageHeader, Panel, PanelHeader } from "@/components/ui";

type PageProps = { params: Promise<{ programId: string; cohortId: string }> };

export default async function CohortDetailPage({ params }: PageProps) {
  const context = await getActiveOrganizationContext();
  if (!context) redirect("/app/organizations");
  const { programId, cohortId } = await params;
  const [workspace, cohort] = await Promise.all([
    getCohortWorkspace(context.organization.id, cohortId),
    getOrganizationCohort(context.organization.id, cohortId),
  ]);
  if (!workspace || !cohort || workspace.cohort.fundingProgramId !== programId) notFound();
  const [ventures, fundingCalls, protocols, results] = await Promise.all([
    listOrganizationVentures(context.organization.id),
    listProgramFundingCalls(context.organization.id, programId),
    listTrackingProtocols(context.organization.id),
    getCohortResults(context.organization.id, cohortId),
  ]);
  const canManage = hasAtLeastRole(context.membership.role, "MANAGER");
  const enrolledVentureIds = new Set(workspace.enrollments.map((enrollment) => enrollment.venture.id));
  const availableVentures = ventures.filter((venture) => !enrolledVentureIds.has(venture.id)).map((venture) => ({ id: venture.id, name: venture.name, kind: venture.kind }));

  return (
    <div className="space-y-7">
      <PageHeader breadcrumbs={<Breadcrumbs items={[{ label: "Programas", href: "/app/programs" }, { label: workspace.cohort.fundingProgram.name, href: `/app/programs/${programId}` }, { label: workspace.cohort.name }]} />} title={workspace.cohort.name} description={`${workspace.cohort.fundingProgram.name}${workspace.cohort.code ? ` · ${workspace.cohort.code}` : ""}`} action={<CohortDetailActions organizationId={context.organization.id} cohort={cohort} fundingCalls={fundingCalls} protocols={protocols} canManage={canManage} />} />
      <Panel>
        <PanelHeader title="Contexto do acompanhamento" />
        <dl className="grid gap-5 p-6 sm:grid-cols-2">
          <div><dt className="text-sm text-slate">Edital de origem</dt><dd className="mt-1 font-medium">{cohort.fundingCall ? <Link className="hover:text-accent-hover" href={`/app/programs/${programId}/calls/${cohort.fundingCall.id}`}>{cohort.fundingCall.callNumber} · {cohort.fundingCall.title}</Link> : "Sem edital de origem"}</dd></div>
          <div><dt className="text-sm text-slate">Protocolo aplicado</dt><dd className="mt-1 font-medium">{cohort.trackingProtocolVersion ? `${cohort.trackingProtocolVersion.trackingProtocol.name} · v${cohort.trackingProtocolVersion.version}` : "Selecione uma versão antes de criar a primeira onda"}</dd></div>
          <div><dt className="text-sm text-slate">Período</dt><dd className="mt-1">{cohort.startsAt ? formatDate(cohort.startsAt) : "Início não definido"} · {cohort.endsAt ? formatDate(cohort.endsAt) : "Fim não definido"}</dd></div>
          <div><dt className="text-sm text-slate">Comparabilidade</dt><dd className="mt-1 text-sm">{cohort.waveCount ? "Versão preservada no histórico desta coorte." : "A versão será congelada na criação da primeira onda."}</dd></div>
        </dl>
        {hasAtLeastRole(context.membership.role, "ADMIN") ? <div className="border-t border-line px-6 py-4"><Link href="/app/protocols" className="text-sm font-medium text-accent-hover">Gerenciar protocolos de acompanhamento →</Link></div> : null}
      </Panel>
      <Panel>
        <PanelHeader title="Cobertura das observações" />
        <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryItem label="Esperadas" value={workspace.observationCounts.expected} />
          <SummaryItem label="Pendentes" value={workspace.observationCounts.pending} />
          <SummaryItem label="Em andamento" value={workspace.observationCounts.inProgress} />
          <SummaryItem label="Enviadas" value={workspace.observationCounts.submitted} />
          <SummaryItem label="Não respondidas" value={workspace.observationCounts.missed} />
        </dl>
      </Panel>
      <CohortEnrollmentManager organizationId={context.organization.id} cohortId={cohortId} enrollments={workspace.enrollments} availableVentures={availableVentures} canManage={canManage} />
      <FollowUpWaveManager organizationId={context.organization.id} cohortId={cohortId} waves={workspace.waves} canManage={canManage} canCreateWave={Boolean(cohort.trackingProtocolVersionId)} />
      {results ? <CohortResults results={results} /> : null}
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

function SummaryItem({ label, value }: { label: string; value: number }) {
  return <div className="px-6 pb-5 first:pt-0 sm:px-6"><dt className="text-sm text-slate">{label}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</dd></div>;
}
