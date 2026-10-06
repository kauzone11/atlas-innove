import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { getImportPageAccess } from "@/components/imports/access";
import { Breadcrumbs, PageHeader, StatusBadge } from "@/components/ui";
import { getInstitutionOnboarding } from "@/lib/onboarding/service";

export default async function InstitutionalOnboardingPage() {
  const { context, canManage } = await getImportPageAccess();
  if (!canManage) return <PageHeader title="Preparação institucional" description="Esta área está disponível para gestores, administradores e proprietários da instituição." />;
  const { steps } = await getInstitutionOnboarding(context.auth.user.id, context.organization.id);
  return <div className="min-w-0 space-y-6">
    <PageHeader title="Preparação institucional" description="Um roteiro opcional, atualizado a partir dos registros da instituição. Retome quando precisar." breadcrumbs={<Breadcrumbs items={[{ label: "Configurações", href: "/app/settings" }, { label: "Preparação institucional" }]} />} />
    <div className="flex flex-wrap items-center justify-between gap-4 border-y border-line py-4"><p className="max-w-2xl text-sm text-slate">Já possui dados históricos? Importe por etapas, mantendo os identificadores da origem e as datas das evidências.</p><Link className="button-secondary" href="/app/imports">Importar dados históricos <ArrowRight size={16} aria-hidden="true" /></Link></div>
    <ol className="divide-y divide-line">{steps.map((step) => <li key={step.key} className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{step.title}</h2>{step.complete ? <span className="inline-flex items-center gap-1 text-xs text-success"><Check size={14} aria-hidden="true" />Registrado</span> : <StatusBadge label={step.optional ? "Opcional" : "A preparar"} />}</div><p className="mt-1 max-w-2xl text-sm leading-6 text-slate">{step.description}</p></div><Link className="button-tertiary shrink-0 self-start" href={step.href}>{step.action}<ArrowRight size={16} aria-hidden="true" /></Link></li>)}</ol>
    <p className="text-sm text-slate">Os registros podem ter sido criados manualmente ou por importação. Este roteiro não altera dados nem exige a publicação de editais ou resultados.</p>
  </div>;
}
