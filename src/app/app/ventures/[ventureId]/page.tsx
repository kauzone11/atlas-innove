import { notFound, redirect } from "next/navigation";

import { VentureEnrollmentForm } from "@/components/venture-enrollment-form";
import { VentureEditForm } from "@/components/venture-edit-form";
import { hasAtLeastRole } from "@/lib/auth/authorization";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { listOrganizationCohorts } from "@/lib/cohorts/service";
import { getOrganizationVenture } from "@/lib/ventures/service";
import { Breadcrumbs, PageHeader, Panel, PanelHeader, StatusBadge } from "@/components/ui";

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
  const canManage = hasAtLeastRole(context.membership.role, "MANAGER");

  return <div className="space-y-8"><PageHeader breadcrumbs={<Breadcrumbs items={[{ label: "Empreendimentos", href: "/app/ventures" }, { label: venture.name }]} />} title={venture.name} description={`${kindLabel(venture.kind)}${venture.legalName ? ` · ${venture.legalName}` : ""}`} action={<StatusBadge label={`${venture.enrollments.length} ${venture.enrollments.length === 1 ? "participação" : "participações"}`} tone="neutral" />} /><Panel className="p-6">{venture.externalReference ? <p className="text-sm text-slate">Referência externa: <span className="text-ink">{venture.externalReference}</span></p> : <p className="text-sm text-slate">A identidade desta entidade permanece estável entre diferentes coortes e programas.</p>}</Panel><VentureEditForm organizationId={context.organization.id} venture={venture} canManage={canManage} /><VentureEnrollmentForm organizationId={context.organization.id} venture={venture} cohorts={cohorts} canManage={canManage} /><Panel><PanelHeader title="Participações" description="Coortes e programas dos quais este empreendimento participa." />{venture.enrollments.length ? <div className="divide-y divide-line">{venture.enrollments.map((enrollment) => <div key={enrollment.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium text-ink">{enrollment.cohort.name}</p><p className="text-sm text-slate">{enrollment.cohort.fundingProgram.name} · entrada em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(enrollment.enrolledAt))}</p></div><StatusBadge label={enrollment.status === "ACTIVE" ? "Ativa" : "Retirada"} tone={enrollment.status === "ACTIVE" ? "success" : "neutral"} /></div>)}</div> : <p className="px-6 py-10 text-sm text-slate">Este empreendimento ainda não está inscrito em uma coorte.</p>}</Panel></div>;
}

function kindLabel(kind: string) {
  return ({ COMPANY: "Empresa", PROJECT: "Projeto tecnológico", INITIATIVE: "Iniciativa", OTHER: "Outro" } as Record<string, string>)[kind] ?? kind;
}
