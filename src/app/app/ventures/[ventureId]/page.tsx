import { notFound, redirect } from "next/navigation";

import { VentureEnrollmentForm } from "@/components/venture-enrollment-form";
import { VentureDetailActions } from "@/components/venture-detail-actions";
import { hasAtLeastRole } from "@/lib/auth/authorization";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { listOrganizationCohorts } from "@/lib/cohorts/service";
import { getOrganizationVenture } from "@/lib/ventures/service";
import { Breadcrumbs, PageHeader, Panel, PanelHeader } from "@/components/ui";

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

  return <div className="space-y-7"><PageHeader breadcrumbs={<Breadcrumbs items={[{ label: "Empreendimentos", href: "/app/ventures" }, { label: venture.name }]} />} title={venture.name} description={`${kindLabel(venture.kind)}${venture.legalName ? ` · ${venture.legalName}` : ""}`} action={<VentureDetailActions organizationId={context.organization.id} venture={venture} canManage={canManage} />} /><div className="flex flex-wrap gap-x-5 gap-y-2 border-y border-line py-4 text-sm text-slate">{venture.externalReference ? <span>Referência externa <strong className="font-medium text-ink">{venture.externalReference}</strong></span> : <span>A identidade permanece estável entre diferentes coortes e programas.</span>}</div><VentureEnrollmentForm organizationId={context.organization.id} venture={venture} cohorts={cohorts} canManage={canManage} /><Panel><PanelHeader title="Participações" />{venture.enrollments.length ? <div className="divide-y divide-line">{venture.enrollments.map((enrollment) => <div key={enrollment.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium text-ink">{enrollment.cohort.name}</p><p className="text-sm text-slate">{enrollment.cohort.fundingProgram.name} · entrada em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(enrollment.enrolledAt))}</p></div><span className={`status-badge ${enrollment.status === "ACTIVE" ? "status-success" : "status-neutral"}`}>{enrollment.status === "ACTIVE" ? "Ativa" : "Retirada"}</span></div>)}</div> : <p className="px-6 py-10 text-sm text-slate">Este empreendimento ainda não está inscrito em uma coorte.</p>}</Panel></div>;
}

function kindLabel(kind: string) {
  return ({ COMPANY: "Empresa", PROJECT: "Projeto tecnológico", INITIATIVE: "Iniciativa", OTHER: "Outro" } as Record<string, string>)[kind] ?? kind;
}
