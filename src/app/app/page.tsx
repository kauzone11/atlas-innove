import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, FolderKanban } from "lucide-react";
import { redirect } from "next/navigation";

import { getActiveOrganizationContext, getAuthenticatedSession } from "@/lib/auth/session";
import { listOrganizationPrograms } from "@/lib/programs/service";
import { listOrganizationVentures } from "@/lib/ventures/service";

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
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Visão geral</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Acompanhamento de {context.organization.name}</h1>
        <p className="mt-3 max-w-2xl text-slate">Organize programas, coortes e empreendimentos em um contexto institucional único para acompanhar sua evolução com evidências estruturadas.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <OverviewSection title="Programas" icon={<FolderKanban size={19} aria-hidden="true" />} href="/app/programs" action="Ver programas">
          {programs.length ? programs.slice(0, 4).map((program) => <Link key={program.id} href={`/app/programs/${program.id}`} className="flex items-center justify-between gap-4 border-t border-line py-3 first:border-t-0"><span className="min-w-0"><span className="block truncate font-medium text-ink">{program.name}</span><span className="text-sm text-slate">{program.cohortCount} {program.cohortCount === 1 ? "coorte" : "coortes"}</span></span><ArrowRight size={16} className="shrink-0 text-accent" aria-hidden="true" /></Link>) : <EmptyList text="Nenhum programa cadastrado." href="/app/programs" action="Criar programa" />}
        </OverviewSection>
        <OverviewSection title="Empreendimentos" icon={<BriefcaseBusiness size={19} aria-hidden="true" />} href="/app/ventures" action="Ver empreendimentos">
          {ventures.length ? ventures.slice(0, 4).map((venture) => <Link key={venture.id} href={`/app/ventures/${venture.id}`} className="flex items-center justify-between gap-4 border-t border-line py-3 first:border-t-0"><span className="min-w-0"><span className="block truncate font-medium text-ink">{venture.name}</span><span className="text-sm text-slate">{venture.enrollments.length} {venture.enrollments.length === 1 ? "coorte" : "coortes"}</span></span><ArrowRight size={16} className="shrink-0 text-accent" aria-hidden="true" /></Link>) : <EmptyList text="Nenhum empreendimento cadastrado." href="/app/ventures" action="Criar empreendimento" />}
        </OverviewSection>
      </div>
    </div>
  );
}

function OverviewSection({ title, icon, href, action, children }: { title: string; icon: React.ReactNode; href: string; action: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-line bg-white p-6 shadow-panel"><div className="flex items-center justify-between gap-4"><h2 className="flex items-center gap-2 font-semibold text-ink">{icon}{title}</h2><Link href={href} className="text-sm font-semibold text-accent hover:text-accent-dark">{action}</Link></div><div className="mt-4">{children}</div></section>;
}

function EmptyList({ text, href, action }: { text: string; href: string; action: string }) {
  return <div className="rounded-xl border border-dashed border-line px-4 py-6 text-sm text-slate"><p>{text}</p><Link href={href} className="mt-3 inline-flex items-center gap-2 font-semibold text-accent hover:text-accent-dark">{action}<ArrowRight size={15} aria-hidden="true" /></Link></div>;
}

function EmptyWorkspace() {
  return <section className="rounded-2xl border border-line bg-white p-8 shadow-panel"><h1 className="text-2xl font-semibold text-ink">Escolha uma organização</h1><p className="mt-2 text-slate">Selecione o espaço institucional em que deseja trabalhar.</p><Link href="/app/organizations" className="mt-6 inline-flex rounded-lg bg-accent px-4 py-2.5 font-semibold text-white hover:bg-accent-dark">Ver organizações</Link></section>;
}
