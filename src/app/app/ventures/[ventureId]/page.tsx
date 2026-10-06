import { notFound, redirect } from "next/navigation";

import { VentureEnrollmentForm } from "@/components/venture-enrollment-form";
import { VentureDetailActions } from "@/components/venture-detail-actions";
import { VentureTrajectory } from "@/components/venture-trajectory";
import { VentureMilestones } from "@/components/venture-milestones";
import { hasAtLeastRole } from "@/lib/auth/authorization";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { listOrganizationCohorts } from "@/lib/cohorts/service";
import { getOrganizationVenture } from "@/lib/ventures/service";
import { getVentureTrajectory } from "@/lib/monitoring/read-model";
import { listVentureMilestones } from "@/lib/milestones/service";
import { Breadcrumbs, PageHeader } from "@/components/ui";

type PageProps = { params: Promise<{ ventureId: string }> };

export default async function VentureDetailPage({ params }: PageProps) {
  const context = await getActiveOrganizationContext();
  if (!context) redirect("/app/organizations");
  const { ventureId } = await params;
  const [venture, cohorts] = await Promise.all([
    getOrganizationVenture(context.organization.id, ventureId),
    listOrganizationCohorts(context.organization.id),
  ]);
  if (!venture) notFound();
  const [trajectory, milestones] = await Promise.all([
    getVentureTrajectory(context.organization.id, ventureId),
    listVentureMilestones(context.organization.id, ventureId),
  ]);
  const canManage = hasAtLeastRole(context.membership.role, "MANAGER");

  return <div className="min-w-0 space-y-7"><PageHeader breadcrumbs={<Breadcrumbs items={[{ label: "Empreendimentos", href: "/app/ventures" }, { label: venture.name }]} />} title={venture.name} description={`${kindLabel(venture.kind)}${venture.legalName ? ` · ${venture.legalName}` : ""}`} action={<VentureDetailActions organizationId={context.organization.id} venture={venture} canManage={canManage} />} /><div className="flex flex-wrap gap-x-5 gap-y-2 border-y border-line py-4 text-sm text-slate">{venture.externalReference ? <span>Referência externa <strong className="font-medium text-ink">{venture.externalReference}</strong></span> : <span>A identidade permanece estável entre diferentes coortes e programas.</span>}</div><VentureEnrollmentForm organizationId={context.organization.id} venture={venture} cohorts={cohorts} canManage={canManage} /><VentureTrajectory trajectory={trajectory} /><VentureMilestones organizationId={context.organization.id} ventureId={ventureId} milestones={milestones} canManage={canManage} /></div>;
}

function kindLabel(kind: string) {
  return ({ COMPANY: "Empresa", PROJECT: "Projeto tecnológico", INITIATIVE: "Iniciativa", OTHER: "Outro" } as Record<string, string>)[kind] ?? kind;
}
