import { notFound, redirect } from "next/navigation";

import { CohortEditForm } from "@/components/cohort-edit-form";
import { CohortEnrollmentManager } from "@/components/cohort-enrollment-manager";
import { FollowUpWaveManager } from "@/components/follow-up-wave-manager";
import { hasAtLeastRole } from "@/lib/auth/authorization";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { getCohortWorkspace } from "@/lib/follow-up/service";
import { listOrganizationVentures } from "@/lib/ventures/service";
import { Breadcrumbs, PageHeader, Panel, PanelHeader, StatusBadge, statusTone } from "@/components/ui";

type PageProps = { params: Promise<{ programId: string; cohortId: string }> };

export default async function CohortDetailPage({ params }: PageProps) {
  const context = await getActiveOrganizationContext();
  if (!context) redirect("/app/organizations");
  const { programId, cohortId } = await params;
  const [workspace, ventures] = await Promise.all([
    getCohortWorkspace(context.organization.id, cohortId),
    listOrganizationVentures(context.organization.id),
  ]);
  if (!workspace || workspace.cohort.fundingProgramId !== programId) notFound();
  const canManage = hasAtLeastRole(context.membership.role, "MANAGER");
  const enrolledVentureIds = new Set(workspace.enrollments.map((enrollment) => enrollment.venture.id));
  const availableVentures = ventures.filter((venture) => !enrolledVentureIds.has(venture.id)).map((venture) => ({ id: venture.id, name: venture.name, kind: venture.kind }));

  return (
    <div className="space-y-7">
      <PageHeader breadcrumbs={<Breadcrumbs items={[{ label: "Programas", href: "/app/programs" }, { label: workspace.cohort.fundingProgram.name, href: `/app/programs/${programId}` }, { label: workspace.cohort.name }]} />} title={workspace.cohort.name} description={`${workspace.cohort.fundingProgram.name}${workspace.cohort.code ? ` · ${workspace.cohort.code}` : ""}`} action={<StatusBadge label={statusLabel(workspace.cohort.status)} tone={statusTone(workspace.cohort.status)} />} />
      <CohortEditForm organizationId={context.organization.id} cohort={workspace.cohort} canManage={canManage} />
      <Panel>
        <PanelHeader title="Cobertura das observações" description="Os números abaixo refletem somente registros existentes." />
        <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryItem label="Esperadas" value={workspace.observationCounts.expected} />
          <SummaryItem label="Pendentes" value={workspace.observationCounts.pending} />
          <SummaryItem label="Em andamento" value={workspace.observationCounts.inProgress} />
          <SummaryItem label="Enviadas" value={workspace.observationCounts.submitted} />
          <SummaryItem label="Não respondidas" value={workspace.observationCounts.missed} />
        </dl>
      </Panel>
      <CohortEnrollmentManager organizationId={context.organization.id} cohortId={cohortId} enrollments={workspace.enrollments} availableVentures={availableVentures} canManage={canManage} />
      <FollowUpWaveManager organizationId={context.organization.id} cohortId={cohortId} waves={workspace.waves} canManage={canManage} />
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: number }) {
  return <div className="px-6 pb-5 first:pt-0 sm:px-6"><dt className="text-sm text-slate">{label}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</dd></div>;
}

function statusLabel(status: string): string {
  return ({ PLANNED: "Planejada", ACTIVE: "Ativa", CLOSED: "Encerrada", ARCHIVED: "Arquivada" } as Record<string, string>)[status] ?? status;
}
