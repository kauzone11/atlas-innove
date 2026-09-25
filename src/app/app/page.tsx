import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { redirect } from "next/navigation";

import { getActiveOrganizationContext, getAuthenticatedSession } from "@/lib/auth/session";
import { listOrganizationPrograms } from "@/lib/programs/service";
import { listOrganizationVentures } from "@/lib/ventures/service";
import { PageHeader, Panel, PanelHeader, StatusBadge, statusTone } from "@/components/ui";

export default async function AppHomePage() {
  const auth = await getAuthenticatedSession();
  if (!auth) redirect("/login");
  const context = await getActiveOrganizationContext();
  if (!context && auth.memberships.length > 1) redirect("/app/organizations");
  if (!context) return <EmptyWorkspace />;

  const [programs, ventures] = await Promise.all([
    listOrganizationPrograms(context.organization.id),
    listOrganizationVentures(context.organization.id),
  ]);

  return (
    <div>
      <PageHeader title="Visão geral" description={context.organization.name} />

      <dl className="mb-6 grid overflow-hidden rounded-[0.875rem] border border-line bg-white sm:grid-cols-2">
        <SummaryItem label="Programas" value={programs.length} href="/app/programs" />
        <SummaryItem label="Empreendimentos" value={ventures.length} href="/app/ventures" />
      </dl>

      <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <OverviewSection title="Programas" href="/app/programs" action="Ver programas">
          {programs.length ? programs.slice(0, 5).map((program) => <Link key={program.id} href={`/app/programs/${program.id}`} className="flex items-center justify-between gap-4 border-t border-line py-4 first:border-t-0"><span className="min-w-0"><span className="block truncate font-medium text-ink">{program.name}</span><span className="text-sm text-slate">{program.cohortCount} {program.cohortCount === 1 ? "coorte" : "coortes"}</span></span><span className="inline-flex shrink-0 items-center gap-3"><StatusBadge label={statusLabel(program.status)} tone={statusTone(program.status)} /><ArrowRight size={16} className="text-accent-hover" aria-hidden="true" /></span></Link>) : <EmptyList text="Nenhum programa cadastrado." href="/app/programs" action="Criar programa" />}
        </OverviewSection>
        <OverviewSection title="Empreendimentos" href="/app/ventures" action="Ver empreendimentos">
          {ventures.length ? ventures.slice(0, 5).map((venture) => <Link key={venture.id} href={`/app/ventures/${venture.id}`} className="flex items-center justify-between gap-4 border-t border-line py-4 first:border-t-0"><span className="min-w-0"><span className="block truncate font-medium text-ink">{venture.name}</span><span className="text-sm text-slate">{venture.enrollments.length} {venture.enrollments.length === 1 ? "participação" : "participações"}</span></span><ArrowRight size={16} className="shrink-0 text-accent-hover" aria-hidden="true" /></Link>) : <EmptyList text="Nenhum empreendimento cadastrado." href="/app/ventures" action="Criar empreendimento" />}
        </OverviewSection>
      </div>
    </div>
  );
}

function OverviewSection({ title, href, action, children }: { title: string; href: string; action: string; children: React.ReactNode }) {
  return <Panel><PanelHeader title={title} action={<Link href={href} className="button-tertiary min-h-9 px-2 text-xs">{action}</Link>} /><div className="p-6 pt-2">{children}</div></Panel>;
}

function EmptyList({ text, href, action }: { text: string; href: string; action: string }) {
  return <div className="border-t border-line px-1 py-5 text-sm text-slate"><p>{text}</p><Link href={href} className="mt-3 inline-flex min-h-11 items-center gap-2 font-semibold text-accent-hover hover:underline">{action}<ArrowRight size={15} aria-hidden="true" /></Link></div>;
}

function SummaryItem({ label, value, href }: { label: string; value: number; href: string }) {
  return <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><dt className="text-sm text-slate"><Link href={href} className="hover:text-ink">{label}</Link></dt><dd className="text-2xl font-semibold tabular-nums text-ink">{value}</dd></div>;
}

function statusLabel(status: string) {
  return ({ DRAFT: "Rascunho", ACTIVE: "Ativo", CLOSED: "Encerrado", ARCHIVED: "Arquivado", PLANNED: "Planejado" } as Record<string, string>)[status] ?? status;
}

function EmptyWorkspace() {
  return <Panel className="max-w-xl p-6"><h1 className="text-2xl font-semibold tracking-tight text-ink">Escolha uma organização</h1><p className="mt-2 text-slate">Selecione o espaço institucional em que deseja trabalhar.</p><Link href="/app/organizations" className="button-primary mt-6">Ver organizações</Link></Panel>;
}
