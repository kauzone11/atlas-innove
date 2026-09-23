import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { CohortEditForm } from "@/components/cohort-edit-form";
import { CohortEnrollmentManager } from "@/components/cohort-enrollment-manager";
import { FollowUpWaveManager } from "@/components/follow-up-wave-manager";
import { hasAtLeastRole } from "@/lib/auth/authorization";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { getCohortWorkspace } from "@/lib/follow-up/service";
import { listOrganizationVentures } from "@/lib/ventures/service";

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
      <Link href={`/app/programs/${programId}`} className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:text-accent-dark"><ArrowLeft size={16} aria-hidden="true" /> Voltar para o programa</Link>
      <section className="rounded-2xl border border-line bg-white p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Coorte</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{workspace.cohort.name}</h1>
        <p className="mt-2 text-sm text-slate">{workspace.cohort.fundingProgram.name} · {statusLabel(workspace.cohort.status)}{workspace.cohort.code ? ` · ${workspace.cohort.code}` : ""}</p>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-slate">Esta é a área operacional da coorte: participações, ondas de observação e cobertura registrada.</p>
      </section>
      <CohortEditForm organizationId={context.organization.id} cohort={workspace.cohort} canManage={canManage} />
      <section className="rounded-2xl border border-line bg-white p-6 shadow-panel">
        <h2 className="font-semibold text-ink">Cobertura das observações</h2>
        <p className="mt-1 text-sm text-slate">Os números abaixo refletem somente registros de observação existentes.</p>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryItem label="Esperadas" value={workspace.observationCounts.expected} />
          <SummaryItem label="Pendentes" value={workspace.observationCounts.pending} />
          <SummaryItem label="Em andamento" value={workspace.observationCounts.inProgress} />
          <SummaryItem label="Enviadas" value={workspace.observationCounts.submitted} />
          <SummaryItem label="Não respondidas" value={workspace.observationCounts.missed} />
        </dl>
      </section>
      <CohortEnrollmentManager organizationId={context.organization.id} cohortId={cohortId} enrollments={workspace.enrollments} availableVentures={availableVentures} canManage={canManage} />
      <FollowUpWaveManager organizationId={context.organization.id} cohortId={cohortId} waves={workspace.waves} canManage={canManage} />
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-line bg-canvas px-4 py-3"><dt className="text-sm text-slate">{label}</dt><dd className="mt-1 text-2xl font-semibold text-ink">{value}</dd></div>;
}

function statusLabel(status: string): string {
  return ({ PLANNED: "Planejada", ACTIVE: "Ativa", CLOSED: "Encerrada", ARCHIVED: "Arquivada" } as Record<string, string>)[status] ?? status;
}
