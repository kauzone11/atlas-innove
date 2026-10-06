import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { redirect } from "next/navigation";

import { getActiveOrganizationContext, getAuthenticatedSession } from "@/lib/auth/session";
import { listOrganizationPrograms } from "@/lib/programs/service";
import { listOrganizationVentures } from "@/lib/ventures/service";
import { PageHeader, Panel, PanelHeader, StatusBadge, statusTone } from "@/components/ui";
import { MonitoringWaves } from "@/components/monitoring-waves";
import { getLatestCohortResults, getOrganizationMonitoring } from "@/lib/monitoring/read-model";
import { formatIndicatorValue } from "@/lib/monitoring/format";

export default async function AppHomePage() {
  const auth = await getAuthenticatedSession();
  if (!auth) redirect("/login");
  const context = await getActiveOrganizationContext();
  if (!context && auth.memberships.length > 1) redirect("/app/organizations");
  if (!context) return <EmptyWorkspace />;

  const [programs, ventures, waves, latestResults] = await Promise.all([
    listOrganizationPrograms(context.organization.id),
    listOrganizationVentures(context.organization.id),
    getOrganizationMonitoring(context.organization.id),
    getLatestCohortResults(context.organization.id),
  ]);
  const activeWaves = waves.filter((wave) => ["OVERDUE", "OPEN", "UPCOMING"].includes(wave.attention));
  const expected = waves.filter((wave) => wave.status !== "ARCHIVED").reduce((total, wave) => total + wave.coverage.expected, 0);
  const submitted = waves.filter((wave) => wave.status !== "ARCHIVED").reduce((total, wave) => total + wave.coverage.submitted, 0);
  const latestWave = latestResults?.results.waves.filter((wave) => wave.coverage.submitted > 0).at(-1);
  const latestIndicators = latestWave?.indicators.filter((indicator) => indicator.validCount > 0).slice(0, 3) ?? [];

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader title="Visão geral" description={context.organization.name} />

      <dl className="grid overflow-hidden rounded-[0.875rem] border border-line bg-white sm:grid-cols-2 lg:grid-cols-4">
        <SummaryItem label="Programas" value={programs.length} href="/app/programs" />
        <SummaryItem label="Empreendimentos" value={ventures.length} href="/app/ventures" />
        <SummaryItem label="Ondas abertas" value={waves.filter((wave) => wave.status === "OPEN").length} href="/app/follow-ups" />
        <SummaryItem label="Observações enviadas" value={`${submitted}/${expected}`} href="/app/follow-ups" />
      </dl>

      <Panel>
        <PanelHeader title="Próximas ações" description="Ondas em atraso, abertas e previstas nos programas da organização." action={<Link href="/app/follow-ups" className="button-tertiary min-h-9 px-2 text-xs">Ver acompanhamentos</Link>} />
        {activeWaves.length ? <MonitoringWaves waves={activeWaves.slice(0, 4)} showPending={false} /> : <div className="px-6 pb-6"><EmptyList text={waves.length ? "Nenhuma onda aberta ou prevista neste momento." : "Crie uma coorte, aplique um protocolo e organize a baseline para iniciar o acompanhamento."} href="/app/programs" action="Abrir programas" /></div>}
      </Panel>

      {latestResults && latestWave && latestIndicators.length ? <Panel>
        <PanelHeader title="Resultados registrados" description={`${latestResults.cohortName} · ${latestResults.programName} · ${latestWave.name}`} action={<Link href={`/app/programs/${latestResults.programId}/cohorts/${latestResults.results.cohortId}`} className="button-tertiary min-h-9 px-2 text-xs">Ver coorte</Link>} />
        <dl className="divide-y divide-line border-t border-line">{latestIndicators.map((indicator) => <div key={indicator.id} className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-start sm:justify-between"><dt className="text-sm font-medium text-ink">{indicator.label}<span className="mt-1 block text-xs font-normal text-slate">{indicator.valueType === "ENUM" ? "Distribuição dos valores observados" : "Média dos valores observados"}</span></dt><dd className="text-sm text-ink sm:text-right"><span className="block font-semibold tabular-nums">{indicator.valueType === "ENUM" ? indicator.distribution.filter((item) => item.count > 0).map((item) => `${item.value}: ${item.count}`).join(" · ") : formatIndicatorValue(indicator.mean, indicator.valueType, indicator.unit)}</span><span className="mt-1 block text-xs text-slate">{indicator.validCount} {indicator.validCount === 1 ? "valor válido" : "valores válidos"}</span></dd></div>)}</dl>
        <p className="border-t border-line px-6 py-4 text-xs leading-5 text-slate">Resumo da coorte com o envio mais recente. Os resultados descrevem os valores registrados; não medem o efeito do programa.</p>
      </Panel> : null}

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

function SummaryItem({ label, value, href }: { label: string; value: number | string; href: string }) {
  return <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><dt className="text-sm text-slate"><Link href={href} className="hover:text-ink">{label}</Link></dt><dd className="text-2xl font-semibold tabular-nums text-ink">{value}</dd></div>;
}

function statusLabel(status: string) {
  return ({ DRAFT: "Rascunho", ACTIVE: "Ativo", CLOSED: "Encerrado", ARCHIVED: "Arquivado", PLANNED: "Planejado" } as Record<string, string>)[status] ?? status;
}

function EmptyWorkspace() {
  return <Panel className="max-w-xl p-6"><h1 className="text-2xl font-semibold tracking-tight text-ink">Escolha uma organização</h1><p className="mt-2 text-slate">Selecione o espaço institucional em que deseja trabalhar.</p><Link href="/app/organizations" className="button-primary mt-6">Ver organizações</Link></Panel>;
}
