import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { VentureEnrollmentForm } from "@/components/venture-enrollment-form";
import { hasAtLeastRole } from "@/lib/auth/authorization";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { listOrganizationCohorts } from "@/lib/cohorts/service";
import { getOrganizationVenture } from "@/lib/ventures/service";

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

  return <div className="space-y-7"><Link href="/app/ventures" className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:text-accent-dark"><ArrowLeft size={16} aria-hidden="true" /> Voltar para empreendimentos</Link><section className="rounded-2xl border border-line bg-white p-6 shadow-panel"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Empreendimento</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{venture.name}</h1><p className="mt-2 text-sm text-slate">{kindLabel(venture.kind)}{venture.legalName ? ` · ${venture.legalName}` : ""}</p>{venture.externalReference ? <p className="mt-4 text-sm text-slate">Referência externa: {venture.externalReference}</p> : null}</section><VentureEnrollmentForm organizationId={context.organization.id} venture={venture} cohorts={cohorts} canManage={canManage} /><section className="rounded-2xl border border-line bg-white shadow-panel"><div className="border-b border-line px-6 py-5"><h2 className="font-semibold text-ink">Participações</h2><p className="mt-1 text-sm text-slate">Coortes e programas dos quais este empreendimento participa.</p></div>{venture.enrollments.length ? <div className="divide-y divide-line">{venture.enrollments.map((enrollment) => <div key={enrollment.id} className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium text-ink">{enrollment.cohort.name}</p><p className="text-sm text-slate">{enrollment.cohort.fundingProgram.name} · entrada em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(enrollment.enrolledAt))}</p></div><span className="text-sm text-accent">{enrollment.status === "ACTIVE" ? "Ativa" : "Retirada"}</span></div>)}</div> : <p className="px-6 py-10 text-sm text-slate">Este empreendimento ainda não está inscrito em uma coorte.</p>}</section></div>;
}

function kindLabel(kind: string) {
  return ({ COMPANY: "Empresa", PROJECT: "Projeto tecnológico", INITIATIVE: "Iniciativa", OTHER: "Outro" } as Record<string, string>)[kind] ?? kind;
}
