import Link from "next/link";
import { ArrowRight, ChevronRight, ClipboardCheck, Info, Target } from "lucide-react";
import { redirect } from "next/navigation";

import { getActiveOrganizationContext, getAuthenticatedSession } from "@/lib/auth/session";
import { listOrganizationPrograms } from "@/lib/programs/service";
import { listOrganizationVentures } from "@/lib/ventures/service";
import { EvidenceLegend, Hero, HeroAction, Panel, PanelHeader, StatBar, StatTile, StatusBadge, statusTone } from "@/components/ui";
import { WaveRibbon } from "@/components/wave-ribbon";
import { MonitoringWaves } from "@/components/monitoring-waves";
import { getLatestCohortResults, getOrganizationMonitoring } from "@/lib/monitoring/read-model";
import { formatIndicatorValue, formatMonitoringDate } from "@/lib/monitoring/format";
import { getInstitutionExecutionAttention } from "@/lib/action-center/institution";
import { hasAtLeastRole } from "@/lib/auth/authorization";

export default async function AppHomePage() {
  const auth = await getAuthenticatedSession();
  if (!auth) redirect("/login");
  const context = await getActiveOrganizationContext();
  if (!context && auth.memberships.length > 1) redirect("/app/organizations");
  if (!context) return <EmptyWorkspace />;

  const [programs, ventures, waves, latestResults, executionAttention] = await Promise.all([
    listOrganizationPrograms(context.organization.id),
    listOrganizationVentures(context.organization.id),
    getOrganizationMonitoring(context.organization.id),
    getLatestCohortResults(context.organization.id),
    getInstitutionExecutionAttention(context),
  ]);
  const activeWaves = waves.filter((wave) => ["OVERDUE", "OPEN", "UPCOMING"].includes(wave.attention));
  const expected = waves.filter((wave) => wave.status !== "ARCHIVED").reduce((total, wave) => total + wave.coverage.expected, 0);
  const submitted = waves.filter((wave) => wave.status !== "ARCHIVED").reduce((total, wave) => total + wave.coverage.submitted, 0);
  const latestWave = latestResults?.results.waves.filter((wave) => wave.coverage.submitted > 0).at(-1);
  const latestIndicators = latestWave?.indicators.filter((indicator) => indicator.validCount > 0).slice(0, 3) ?? [];

  const focus = waves.find((wave) => wave.attention === "OVERDUE") ?? waves.find((wave) => wave.attention === "OPEN");
  const ribbonCohortId = (focus ?? waves.find((wave) => wave.status !== "ARCHIVED"))?.cohort.id;
  const ribbon = ribbonCohortId ? waves.filter((wave) => wave.cohort.id === ribbonCohortId && wave.status !== "ARCHIVED").sort((left, right) => left.sequence - right.sequence) : [];
  const missing = focus ? focus.coverage.pending + focus.coverage.inProgress : 0;
  const canPrepare = hasAtLeastRole(context.membership.role, "MANAGER");
  const needsAttention = executionAttention.pendingReviews || executionAttention.overdueObligations;
  const alsoAsks = needsAttention ? (
    <>
      <span className="eyebrow mb-1.5 block">Também pede ação</span>
      <div className="divide-y divide-[rgba(255,255,255,.28)]">
        <Link href="/app/execution" className="flex min-h-[60px] items-center gap-3.5 py-3.5 text-[#fff] no-underline"><ClipboardCheck size={20} aria-hidden="true" /><span className="min-w-0 flex-1"><span className="block font-semibold">{executionAttention.pendingReviews} {executionAttention.pendingReviews === 1 ? "entrega aguarda" : "entregas aguardam"} análise</span><span className="block text-[0.8125rem] opacity-90">{executionAttention.overdueObligations} {executionAttention.overdueObligations === 1 ? "obrigação em atraso" : "obrigações em atraso"}</span></span><ChevronRight size={16} aria-hidden="true" /></Link>
      </div>
    </>
  ) : undefined;

  const hero = focus ? (
    <Hero
      eyebrow={`${context.organization.name} · Visão geral`}
      title={missing ? `${missing === 1 ? "Falta 1 resposta" : `Faltam ${missing} respostas`} na onda ${focus.name}` : `A onda ${focus.name} recebeu todas as respostas previstas`}
      description={`${focus.cohort.name} · ${focus.cohort.fundingProgram.name}. ${focus.coverage.submitted} de ${focus.coverage.expected} observações foram enviadas${focus.closesAt ? `. Encerramento previsto em ${formatMonitoringDate(focus.closesAt)}` : ""}.`}
      actions={<><HeroAction solid href={`/app/programs/${focus.cohort.fundingProgramId}/cohorts/${focus.cohort.id}`}>Abrir a coorte <ArrowRight size={15} aria-hidden="true" /></HeroAction><HeroAction href="/app/follow-ups">Ver acompanhamentos</HeroAction></>}
      aside={alsoAsks}
    />
  ) : (
    <Hero
      eyebrow={`${context.organization.name} · Visão geral`}
      title={programs.length ? "Nenhuma onda pede ação agora" : "Comece pelo programa"}
      description={programs.length ? "Quando uma onda estiver aberta ou em atraso, ela aparece aqui com o universo esperado e o que falta responder." : "Esta organização ainda não tem programas. O acompanhamento se organiza em uma sequência curta: programa, coorte, empreendimentos e a primeira onda."}
      actions={<><HeroAction solid href="/app/programs">{programs.length ? "Abrir programas" : "Criar o primeiro programa"} <ArrowRight size={15} aria-hidden="true" /></HeroAction>{canPrepare ? <HeroAction href="/app/imports">Importar histórico</HeroAction> : null}</>}
      aside={alsoAsks}
      seed={4}
    />
  );

  return (
    <div className="min-w-0 space-y-6">
      {hero}
      {canPrepare && (!programs.length || (!ventures.length && !waves.length)) ? <p className="flex gap-2 text-[0.8125rem] leading-6 text-slate"><Target size={14} className="mt-1.5 shrink-0" aria-hidden="true" /><span>Preparando o acompanhamento? <Link href="/app/settings/onboarding" className="font-semibold text-accent hover:underline">Abra o roteiro de preparação</Link> ou <Link href="/app/imports" className="font-semibold text-accent hover:underline">importe dados históricos</Link>. Ele é opcional e não gera nota.</span></p> : null}

      <div className="pt-4">
        <StatBar>
          <StatTile label="Programas" value={programs.length} sub={`${programs.filter((program) => program.status === "ACTIVE").length} ativos`} href="/app/programs" />
          <StatTile label="Empreendimentos" value={ventures.length} sub={ventures.length ? "cadastrados na organização" : "nenhum cadastrado"} href="/app/ventures" />
          <StatTile label="Ondas abertas" value={waves.filter((wave) => wave.status === "OPEN").length} sub={`${waves.filter((wave) => wave.attention === "OVERDUE").length} em atraso`} href="/app/follow-ups" />
          <StatTile label="Observações enviadas" value={`${submitted}/${expected}`} sub={`universo esperado: ${expected}`} href="/app/follow-ups" />
        </StatBar>
      </div>

      <div className="grid gap-6 pt-3 min-[1100px]:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0 space-y-6">
          {ribbon.length ? <section className="sec" aria-labelledby="tide-title">
            <div className="sec-h"><div><h2 id="tide-title">A maré da coorte</h2><p>{ribbon[0].cohort.name} · {ribbon[0].cohort.fundingProgram.name}</p></div><Link href={`/app/programs/${ribbon[0].cohort.fundingProgramId}/cohorts/${ribbon[0].cohort.id}`} className="button-secondary min-h-9 px-4 text-xs">Abrir coorte</Link></div>
            <WaveRibbon waves={ribbon} />
            <p className="sec-f"><Info size={14} aria-hidden="true" /><span>Cobertura é a razão entre observações enviadas e o universo esperado. Não mede o desempenho dos empreendimentos.</span></p>
          </section> : null}

          <Panel>
            <PanelHeader title="Próximas ações" description="Ondas em atraso, abertas e previstas nos programas da organização." action={<Link href="/app/follow-ups" className="button-tertiary min-h-9 px-3 text-xs">Ver acompanhamentos</Link>} />
            {activeWaves.length ? <MonitoringWaves waves={activeWaves.slice(0, 4)} showPending={false} /> : <div className="px-6 pb-6"><EmptyList text={waves.length ? "Nenhuma onda aberta ou prevista neste momento." : "Crie uma coorte, aplique um protocolo e organize a baseline para iniciar o acompanhamento."} href="/app/programs" action="Abrir programas" /></div>}
          </Panel>

          {latestResults && latestWave && latestIndicators.length ? <Panel>
            <PanelHeader title="Resultados registrados" description={`${latestResults.cohortName} · ${latestResults.programName} · ${latestWave.name}`} action={<Link href={`/app/programs/${latestResults.programId}/cohorts/${latestResults.results.cohortId}`} className="button-tertiary min-h-9 px-3 text-xs">Ver coorte</Link>} />
            <dl className="divide-y divide-line px-6">{latestIndicators.map((indicator) => <div key={indicator.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between"><dt className="text-sm font-semibold text-ink">{indicator.label}<span className="mt-1 block text-xs font-normal text-slate">{indicator.valueType === "ENUM" ? "Distribuição dos valores observados" : "Média dos valores observados"}</span></dt><dd className="text-sm text-ink sm:text-right"><span className="block font-display text-2xl font-semibold tabular-nums tracking-[-0.03em]">{indicator.valueType === "ENUM" ? indicator.distribution.filter((item) => item.count > 0).map((item) => `${item.value}: ${item.count}`).join(" · ") : formatIndicatorValue(indicator.mean, indicator.valueType, indicator.unit)}</span><span className="mt-1 block text-xs text-slate">{indicator.validCount} {indicator.validCount === 1 ? "valor válido" : "valores válidos"}</span></dd></div>)}</dl>
            <p className="px-6 pb-5 pt-3 text-xs leading-5 text-slate">Resumo da coorte com o envio mais recente. Os resultados descrevem os valores registrados; não medem o efeito do programa.</p>
          </Panel> : null}

          <div className="grid gap-6 min-[900px]:grid-cols-2">
            <OverviewSection title="Programas" href="/app/programs" action="Ver programas">
              {programs.length ? programs.slice(0, 5).map((program) => <Link key={program.id} href={`/app/programs/${program.id}`} className="list-row"><span className="min-w-0 flex-1"><span className="block truncate font-semibold text-ink">{program.name}</span><span className="text-sm text-slate">{program.cohortCount} {program.cohortCount === 1 ? "coorte" : "coortes"}</span></span><span className="inline-flex shrink-0 items-center gap-3"><StatusBadge label={statusLabel(program.status)} tone={statusTone(program.status)} /><ChevronRight size={16} className="text-slate" aria-hidden="true" /></span></Link>) : <EmptyList text="Nenhum programa cadastrado." href="/app/programs" action="Criar programa" />}
            </OverviewSection>
            <OverviewSection title="Empreendimentos" href="/app/ventures" action="Ver empreendimentos">
              {ventures.length ? ventures.slice(0, 5).map((venture) => <Link key={venture.id} href={`/app/ventures/${venture.id}`} className="list-row"><span className="min-w-0 flex-1"><span className="block truncate font-semibold text-ink">{venture.name}</span><span className="text-sm text-slate">{venture.enrollments.length} {venture.enrollments.length === 1 ? "participação" : "participações"}</span></span><ChevronRight size={16} className="shrink-0 text-slate" aria-hidden="true" /></Link>) : <EmptyList text="Nenhum empreendimento cadastrado." href="/app/ventures" action="Criar empreendimento" />}
            </OverviewSection>
          </div>
        </div>

        <aside className="min-w-0 space-y-6" aria-label="Apoio à leitura">
          <section className="sec"><div className="sec-h"><h2>Como ler</h2></div><EvidenceLegend /><p className="mt-3 text-sm text-slate">Zero é um valor informado. Sem dado é a falta de informação. Uma onda não enviada não vira zero em nenhuma conta.</p></section>
          <section className="sec"><div className="sec-h"><div><h2>Leitura do portfólio</h2><p>Compare coortes, confira a qualidade das evidências e preserve resultados em relatórios.</p></div></div><Link href="/app/analytics" className="button-secondary">Abrir análises <ArrowRight size={16} aria-hidden="true" /></Link></section>
        </aside>
      </div>
    </div>
  );
}

function OverviewSection({ title, href, action, children }: { title: string; href: string; action: string; children: React.ReactNode }) {
  return <Panel><PanelHeader title={title} action={<Link href={href} className="button-tertiary min-h-9 px-3 text-xs">{action}</Link>} /><div className="px-3 pb-4">{children}</div></Panel>;
}

function EmptyList({ text, href, action }: { text: string; href: string; action: string }) {
  return <div className="px-3 py-4 text-sm text-slate"><p>{text}</p><Link href={href} className="mt-3 inline-flex min-h-11 items-center gap-2 font-semibold text-accent hover:underline">{action}<ArrowRight size={15} aria-hidden="true" /></Link></div>;
}

function statusLabel(status: string) {
  return ({ DRAFT: "Rascunho", ACTIVE: "Ativo", CLOSED: "Encerrado", ARCHIVED: "Arquivado", PLANNED: "Planejado" } as Record<string, string>)[status] ?? status;
}

function EmptyWorkspace() {
  return <Panel className="max-w-xl p-6"><h1 className="text-3xl font-medium tracking-[-0.035em] text-ink">Escolha uma organização</h1><p className="mt-2 text-slate">Selecione o espaço institucional em que deseja trabalhar.</p><Link href="/app/organizations" className="button-primary mt-6">Ver organizações</Link></Panel>;
}
