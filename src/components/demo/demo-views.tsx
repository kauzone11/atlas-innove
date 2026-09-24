import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, BookOpen, CalendarDays, Check, ChevronRight, ExternalLink, LineChart, ShieldCheck } from "lucide-react";

import type { DemoDataset, DemoObservationValue, DemoVenture, DemoWave } from "@/lib/demo/read-model";

export function DemoPageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <header className="demo-page-header"><div className="min-w-0">{eyebrow ? <p className="demo-eyebrow">{eyebrow}</p> : null}<h1>{title}</h1>{description ? <p className="demo-page-description">{description}</p> : null}</div>{action ? <div className="demo-page-actions">{action}</div> : null}</header>;
}

export function DemoSourceNote({ children = "Demonstração independente com metadados públicos de programas de fomento. Empreendimentos, pessoas e resultados apresentados são fictícios." }: { children?: React.ReactNode }) {
  return <p className="demo-source-note"><span aria-hidden="true" />{children}</p>;
}

export function InstitutionOverview({ dataset }: { dataset: DemoDataset }) {
  const perspective = "instituicao";
  const priorityVentures = dataset.ventures.filter((venture) => venture.status === "ACTIVE").slice(0, 5);
  return <div>
    <DemoPageHeader title="Visão geral" action={<Link href={`/demo/acompanhamentos?perspectiva=${perspective}`} className="demo-button-primary"><LineChart size={16} aria-hidden="true" />Abrir acompanhamento</Link>} />
    <DemoSourceNote />
    <MetricStrip dataset={dataset} />
    <div className="demo-overview-grid">
      <div className="demo-main-column">
        <section className="demo-section" aria-labelledby="programa-destaque"><SectionHeading id="programa-destaque" title="Programa em destaque" action={<Link href={`/demo/programas?perspectiva=${perspective}`} className="demo-text-link">Ver programa <ArrowUpRight size={14} aria-hidden="true" /></Link>} /><ProgramFeature dataset={dataset} /></section>
        <section className="demo-section" aria-labelledby="acompanhamentos-prioritarios"><SectionHeading id="acompanhamentos-prioritarios" title="Acompanhamentos prioritários" action={<Link href={`/demo/acompanhamentos?perspectiva=${perspective}`} className="demo-button-quiet">Ver todos</Link>} /><PriorityTable ventures={priorityVentures} latestWave={dataset.waves.at(-1)} /></section>
        <section className="demo-section" aria-labelledby="comparacao-coorte"><SectionHeading id="comparacao-coorte" title="Comparação na última onda" action={<span className="demo-section-count">Clientes pagantes</span>} /><CohortComparison dataset={dataset} /></section>
      </div>
      <aside className="demo-side-rail" aria-label="Contexto da demonstração"><div className="demo-rail-card"><p className="demo-eyebrow">Como ler este recorte</p><h2>Programa, coorte e trajetória em uma mesma leitura.</h2><p>O edital e seus valores são metadados oficiais. Os 10 empreendimentos, observações e marcos compõem um cenário longitudinal fictício.</p><Link href={`/demo/acompanhamentos?perspectiva=${perspective}`} className="demo-text-link">Explorar ondas <ChevronRight size={14} aria-hidden="true" /></Link></div><div className="demo-rail-card demo-rail-card-accent"><p className="demo-eyebrow">Última onda</p><strong>{dataset.metrics.latestWaveName}</strong><span>{dataset.metrics.latestSubmitted} de {dataset.metrics.latestExpected} esperadas respondidas</span><div className="demo-progress"><span style={{ width: `${dataset.metrics.latestWaveCoverage}%` }} /></div><small>{dataset.metrics.latestWaveCoverage}% de cobertura · ausência não é zero</small></div></aside>
    </div>
  </div>;
}

export function ParticipantHome({ dataset }: { dataset: DemoDataset }) {
  const venture = dataset.ventures.find((item) => item.slug === "orlasense") ?? dataset.ventures[0];
  const timeline = venture ? [...venture.milestones].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)).slice(0, 4) : [];
  return <div>
    <DemoPageHeader title="Minha trajetória" action={venture ? <Link href={`/demo/empreendimentos/${venture.slug}?perspectiva=participante`} className="demo-button-primary">Abrir trajetória <ArrowUpRight size={16} aria-hidden="true" /></Link> : null} />
    <DemoSourceNote>Marina Duarte é uma persona demonstrativa. A trajetória abaixo deriva do cenário fictício da coorte e não representa uma pessoa real.</DemoSourceNote>
    <section className="demo-participant-intro"><div className="demo-large-avatar">MD</div><div><p className="demo-eyebrow">Persona demonstrativa</p><h2>Marina Duarte</h2><p>Produto e tecnologia · Aracaju, SE</p></div><span className="demo-status-chip demo-status-chip-soft"><span aria-hidden="true" /> Participação ativa</span></section>
    <div className="demo-participant-grid"><section className="demo-section" aria-labelledby="linha-do-tempo"><SectionHeading id="linha-do-tempo" title="Linha do tempo" action={<span className="demo-section-count">{timeline.length} marcos</span>} /><div className="demo-timeline">{timeline.map((milestone) => <div className="demo-timeline-item" key={`${milestone.occurredAt}-${milestone.title}`}><span className="demo-timeline-dot" aria-hidden="true" /><div><time dateTime={milestone.occurredAt}>{formatDate(milestone.occurredAt, "MMM yyyy")}</time><h3>{milestone.title}</h3><p>{milestone.description ?? "Marco registrado na trajetória demonstrativa."}</p></div></div>)}<div className="demo-timeline-item"><span className="demo-timeline-dot is-muted" aria-hidden="true" /><div><time>Próxima leitura</time><h3>Histórico preservado</h3><p>Acompanhamentos futuros poderão registrar novas evidências sem substituir o que já foi observado.</p></div></div></div></section><aside className="demo-side-rail"><div className="demo-rail-card"><p className="demo-eyebrow">Meu programa</p><h2>{dataset.program.call?.shortTitle ?? dataset.program.name}</h2><p>Vínculo com a coorte demonstrativa do Centelha 2 · SE.</p><Link href="/demo/programas?perspectiva=participante" className="demo-text-link">Ver detalhes <ChevronRight size={14} aria-hidden="true" /></Link></div><div className="demo-rail-card"><p className="demo-eyebrow">Oportunidades</p><h2>{dataset.opportunities.length} chamadas públicas</h2><p>Metadados conferidos em {formatDate(dataset.opportunities[0]?.sourceCheckedAt ?? "2026-09-24", "dd/MM/yyyy")}.</p><Link href="/demo/oportunidades?perspectiva=participante" className="demo-text-link">Explorar oportunidades <ChevronRight size={14} aria-hidden="true" /></Link></div></aside></div>
  </div>;
}

export function ProgramView({ dataset, perspective = "instituicao" }: { dataset: DemoDataset; perspective?: "instituicao" | "participante" }) {
  const call = dataset.program.call;
  return <div>
    <DemoPageHeader title="Programa Centelha 2 · SE" description={perspective === "participante" ? "O programa ao qual a persona demonstrativa está vinculada e a trilha que acompanha sua trajetória." : "Um edital histórico, uma coorte demonstrativa e a trilha de acompanhamento que conecta os dois."} action={<Link href={`/demo/acompanhamentos?perspectiva=${perspective}`} className="demo-button-primary"><LineChart size={16} aria-hidden="true" />Abrir acompanhamento</Link>} />
    <DemoSourceNote />
    <div className="demo-program-grid">
      <section className="demo-program-main">
        <div className="demo-official-banner"><div className="demo-official-copy"><p className="demo-eyebrow">Informação oficial</p><h2>{call?.title ?? dataset.program.name}</h2><p>{call?.objective}</p><div className="demo-inline-facts"><span><ShieldCheck size={14} aria-hidden="true" />Fonte conferida</span><span><CalendarDays size={14} aria-hidden="true" />{call?.sourceCheckedAt ? formatDate(call.sourceCheckedAt, "dd/MM/yyyy") : "—"}</span></div></div><span className="demo-status-badge is-neutral">Histórico</span></div>
        <div className="demo-fact-grid"><Fact label="Publicação" value={call?.publishedAt ? formatDate(call.publishedAt, "dd MMM yyyy") : "—"} /><Fact label="Execução" value={call?.executionMonths ? "até " + call.executionMonths + " meses" : "—"} /><Fact label="Apoio máximo" value={call?.maximumSupport ? formatMoney(call.maximumSupport) : "—"} /><Fact label="Projetos previstos" value={call?.targetProjects ? String(call.targetProjects) : "—"} /></div>
        <section className="demo-section" aria-labelledby="coorte-demonstrativa"><SectionHeading id="coorte-demonstrativa" title="Coorte demonstrativa" action={<span className="demo-section-count">{dataset.ventures.length} empreendimentos fictícios</span>} /><div className="demo-cohort-intro"><div><h3>{dataset.cohort.name}</h3><p>Período demonstrativo · {formatDate(dataset.cohort.startsAt, "MMM yyyy")} a {formatDate(dataset.cohort.endsAt, "MMM yyyy")}</p></div><span className="demo-status-badge is-purple">Edital nº {dataset.cohort.fundingCallNumber ?? "—"}</span></div><div className="demo-venture-grid">{dataset.ventures.map((venture) => <Link key={venture.slug} href={`/demo/empreendimentos/${venture.slug}?perspectiva=${perspective}`} className="demo-venture-item"><span className="demo-monogram">{initials(venture.name)}</span><span className="min-w-0"><strong>{venture.name}</strong><small>{venture.kind === "COMPANY" ? "Empresa" : venture.kind === "PROJECT" ? "Projeto" : "Iniciativa"} · {venture.status === "ACTIVE" ? "ativa" : "participação encerrada"}</small></span><ChevronRight size={15} aria-hidden="true" /></Link>)}</div></section>
      </section>
      <aside className="demo-program-rail"><div className="demo-rail-card"><p className="demo-eyebrow">Fonte oficial</p><h2>FAPITEC/SE</h2><p>Metadados conferidos em {call?.sourceCheckedAt ? formatDate(call.sourceCheckedAt, "dd/MM/yyyy") : "—"}.</p>{call?.documents.map((document) => <a key={document.title} href={document.externalUrl} target="_blank" rel="noopener noreferrer" className="demo-source-link">{document.title}<ExternalLink size={13} aria-hidden="true" /></a>)}</div><div className="demo-rail-card"><p className="demo-eyebrow">Acompanhamento</p><h2>{dataset.waves.length} ondas</h2><div className="demo-wave-mini-list">{dataset.waves.map((wave) => <div key={wave.sequence}><span>{wave.name}</span><strong>{wave.coverage}%</strong></div>)}</div><Link href={`/demo/acompanhamentos?perspectiva=${perspective}`} className="demo-text-link">Ver cobertura <ChevronRight size={14} aria-hidden="true" /></Link></div></aside>
    </div>
  </div>;
}

export function FollowUpsView({ dataset }: { dataset: DemoDataset }) {
  return <div><DemoPageHeader title="Acompanhamentos" description="Quatro ondas para observar mudanças, lacunas e ritmos diferentes na mesma coorte." action={<span className="demo-readonly-label">Somente leitura</span>} /><DemoSourceNote>O cenário é demonstrativo. Uma observação marcada como não respondida não equivale a valor zero; quando uma participação foi encerrada, ela sai apenas das ondas posteriores.</DemoSourceNote><div className="demo-wave-strip">{dataset.waves.map((wave, index) => <div className={`demo-wave-step ${index === dataset.waves.length - 1 ? "is-current" : ""}`} key={wave.sequence}><span className="demo-wave-index">{String(index).padStart(2, "0")}</span><div><strong>{wave.name}</strong><small>{wave.submitted}/{wave.expected} respondidas</small></div><b>{wave.coverage}%</b></div>)}</div><CoverageChart dataset={dataset} /><section className="demo-section demo-followup-section" aria-labelledby="ondas"><SectionHeading id="ondas" title="Fila de acompanhamento" action={<span className="demo-section-count">{dataset.metrics.activeVentureCount} ativos no recorte</span>} /><FollowUpTable dataset={dataset} /></section></div>;
}

export function VentureDetailView({ dataset, venture, perspective = "instituicao" }: { dataset: DemoDataset; venture: DemoVenture; perspective?: "instituicao" | "participante" }) {
  return <div><DemoPageHeader title={venture.name} description="Uma identidade estável, observada em quatro momentos diferentes." action={<Link href={`/demo/acompanhamentos?perspectiva=${perspective}`} className="demo-button-secondary">Voltar aos acompanhamentos</Link>} /><DemoSourceNote>Valores e marcos são fictícios e pertencem ao cenário demonstrativo. O edital exibido é um metadado oficial separado da trajetória.</DemoSourceNote><section className="demo-venture-hero"><div className="demo-large-avatar">{initials(venture.name)}</div><div className="min-w-0"><p className="demo-eyebrow">{venture.kind === "COMPANY" ? "Empresa apoiada" : venture.kind === "PROJECT" ? "Projeto acompanhado" : "Iniciativa acompanhada"}</p><h2>{venture.name}</h2><p>Centelha 2 · SE · coorte demonstrativa</p></div><span className={`demo-status-badge ${venture.status === "ACTIVE" ? "is-green" : "is-neutral"}`}>{venture.status === "ACTIVE" ? "Participação ativa" : "Participação encerrada"}</span></section><section className="demo-section" aria-labelledby="trajetoria"><SectionHeading id="trajetoria" title="Trajetória longitudinal" action={<span className="demo-section-count">{dataset.protocol.name} · v{dataset.protocol.version}</span>} /><div className="demo-longitudinal-grid">{dataset.protocol.indicators.map((indicator) => <MetricTrajectory key={indicator.key} indicator={indicator} venture={venture} waves={dataset.waves} />)}</div></section><section className="demo-section" aria-labelledby="marcos"><SectionHeading id="marcos" title="Marcos registrados" action={<span className="demo-section-count">{venture.milestones.length} marcos</span>} /><div className="demo-milestone-list">{venture.milestones.map((milestone) => <div className="demo-milestone" key={`${milestone.occurredAt}-${milestone.title}`}><span className="demo-milestone-icon" aria-hidden="true"><Check size={15} /></span><div><time dateTime={milestone.occurredAt}>{formatDate(milestone.occurredAt, "dd MMM yyyy")}</time><h3>{milestone.title}</h3>{milestone.description ? <p>{milestone.description}</p> : null}</div></div>)}</div></section></div>;
}

function MetricStrip({ dataset }: { dataset: DemoDataset }) {
  const items = [{ label: "Empreendimentos", value: dataset.metrics.ventureCount, detail: "no recorte demo", tone: "orange" }, { label: "Ondas", value: dataset.metrics.waveCount, detail: "baseline a 24 meses", tone: "purple" }, { label: "Cobertura da última onda", value: `${dataset.metrics.latestWaveCoverage}%`, detail: `${dataset.metrics.latestSubmitted} de ${dataset.metrics.latestExpected} esperadas`, tone: "green" }, { label: "Equipe observada", value: dataset.metrics.latestTeamSize, detail: `${dataset.metrics.latestSubmitted} respostas válidas em ${dataset.metrics.latestWaveName}`, tone: "orange" }];
  return <dl className="demo-metric-strip">{items.map((item) => <div className={`demo-metric demo-metric-${item.tone}`} key={item.label}><dt><span aria-hidden="true" />{item.label}</dt><dd>{item.value}</dd><small>{item.detail}</small></div>)}</dl>;
}

function ProgramFeature({ dataset }: { dataset: DemoDataset }) {
  const call = dataset.program.call;
  return <div className="demo-program-feature"><div className="demo-program-editorial"><Image src="/demo/editorial-innovation.jpeg" alt="Imagem editorial de uma profissional em um ambiente de inovação" fill sizes="(max-width: 767px) 100vw, 220px" /></div><div className="demo-program-feature-body"><div className="demo-program-feature-top"><div className="demo-call-icon" aria-hidden="true"><BookOpen size={18} /></div><div className="min-w-0"><h3>{call?.shortTitle ?? dataset.program.name}</h3><p>{call?.callNumber ? `Edital nº ${call.callNumber} · FAPITEC/SE` : "Programa histórico"}</p></div><span className="demo-status-badge is-neutral">Encerrado</span></div><p className="demo-program-summary">{call?.objective}</p><div className="demo-program-facts"><span><small>Projetos previstos</small><strong>{call?.targetProjects ?? "—"}</strong></span><span><small>Execução</small><strong>{call?.executionMonths ? `${call.executionMonths} meses` : "—"}</strong></span><span><small>Apoio máximo</small><strong>{call?.maximumSupport ? formatMoney(call.maximumSupport) : "—"}</strong></span></div><div className="demo-program-feature-bottom"><span><CalendarDays size={13} aria-hidden="true" /> Publicado em {call?.publishedAt ? formatDate(call.publishedAt, "dd/MM/yyyy") : "—"}</span><Link href="/demo/programas?perspectiva=instituicao" className="demo-text-link">Abrir programa <ArrowUpRight size={14} aria-hidden="true" /></Link></div></div></div>;
}

function PriorityTable({ ventures, latestWave }: { ventures: DemoVenture[]; latestWave?: DemoDataset["waves"][number] }) {
  return <div className="demo-priority-table"><div className="demo-priority-head"><span>Empreendimento</span><span>Onda</span><span>Cobertura</span><span>Status</span></div>{ventures.map((venture) => { const observation = venture.observations.find((item) => item.sequence === latestWave?.sequence); const expected = latestWave && isExpected(venture, latestWave); const coverage = observation?.status === "SUBMITTED" ? 100 : 0; return <Link href={`/demo/empreendimentos/${venture.slug}?perspectiva=instituicao`} className="demo-priority-row" key={venture.slug}><span className="demo-venture-cell"><span className="demo-monogram">{initials(venture.name)}</span><span><strong>{venture.name}</strong><small>Centelha 2 · SE · 2023</small></span></span><span>{latestWave?.name ?? "—"}</span><span><small>{expected ? `${coverage}%` : "—"}</small>{expected ? <span className="demo-progress"><span style={{ width: `${coverage}%` }} /></span> : <span className="demo-muted-dash">Não prevista</span>}</span><span className={`demo-status-badge ${!expected ? "is-neutral" : observation?.status === "SUBMITTED" ? "is-green" : "is-orange"}`}>{!expected ? "Não prevista" : observation?.status === "SUBMITTED" ? "Em dia" : "Revisar"}</span></Link>; })}</div>;
}

function CohortComparison({ dataset }: { dataset: DemoDataset }) {
  const latest = dataset.waves.at(-1);
  const rows = dataset.ventures.filter((venture) => venture.status === "ACTIVE").map((venture) => ({ venture, value: valueFor(venture, latest?.sequence ?? 0, "paying_customers")?.integerValue ?? null })).filter((item): item is { venture: DemoVenture; value: number } => item.value !== null).sort((a, b) => b.value - a.value).slice(0, 5);
  const max = Math.max(...rows.map((item) => item.value), 1);
  return <div className="demo-comparison" aria-label="Clientes pagantes por empreendimento na última onda">{rows.map(({ venture, value }) => <div className="demo-comparison-row" key={venture.slug}><span>{venture.name}</span><span className="demo-comparison-track"><span style={{ width: `${(value / max) * 100}%` }} /></span><strong>{value}</strong></div>)}{!rows.length ? <p className="demo-chart-empty">Sem observação na última onda.</p> : null}</div>;
}

function CoverageChart({ dataset }: { dataset: DemoDataset }) {
  const total = Math.max(dataset.metrics.ventureCount, 1);
  return <section className="demo-coverage-section" aria-labelledby="cobertura-por-onda"><div className="demo-section-heading"><h2 id="cobertura-por-onda"><span aria-hidden="true" />Cobertura por onda</h2><span className="demo-section-count">denominador explícito</span></div><div className="demo-coverage-legend"><span><i className="is-submitted" />Respondida</span><span><i className="is-pending" />Pendente</span><span><i className="is-missed" />Não respondida</span><span><i className="is-not-expected" />Não prevista</span></div><div className="demo-coverage-list">{dataset.waves.map((wave) => { const segments = [{ label: "Respondidas", value: wave.submitted, tone: "is-submitted" }, { label: "Pendentes", value: wave.pending, tone: "is-pending" }, { label: "Não respondidas", value: wave.missed, tone: "is-missed" }, { label: "Não previstas", value: wave.notExpected, tone: "is-not-expected" }]; return <div className="demo-coverage-row" key={wave.sequence}><div className="demo-coverage-label"><strong>{wave.name}</strong><small>{wave.submitted} respondidas · {wave.expected} esperadas · {wave.notExpected} não previstas</small></div><div className="demo-coverage-bar" role="img" aria-label={`${wave.name}: ${wave.submitted} respondidas, ${wave.pending} pendentes, ${wave.missed} não respondidas e ${wave.notExpected} não previstas`}>{segments.map((segment) => segment.value ? <span className={segment.tone} style={{ width: `${(segment.value / total) * 100}%` }} key={segment.label} /> : null)}</div><strong className="demo-coverage-percent">{wave.coverage}%</strong></div>; })}</div></section>;
}

function FollowUpTable({ dataset }: { dataset: DemoDataset }) {
  return <><div className="demo-followup-desktop" role="table" aria-label="Acompanhamentos por empreendimento"><div className="demo-followup-head" role="row"><span>Empreendimento</span>{dataset.waves.map((wave) => <span key={wave.sequence}>{wave.name}</span>)}<span>Status</span></div>{dataset.ventures.map((venture) => <div className="demo-followup-row" role="row" key={venture.slug}><Link href={`/demo/empreendimentos/${venture.slug}?perspectiva=instituicao`} className="demo-venture-cell"><span className="demo-monogram">{initials(venture.name)}</span><span><strong>{venture.name}</strong><small>{venture.kind === "COMPANY" ? "Empresa" : venture.kind === "PROJECT" ? "Projeto" : "Iniciativa"}</small></span></Link>{dataset.waves.map((wave) => <ObservationCell key={wave.sequence} venture={venture} wave={wave} />)}<span><span className={`demo-status-badge ${venture.status === "ACTIVE" ? "is-green" : "is-neutral"}`}>{venture.status === "ACTIVE" ? "Ativa" : "Encerrada"}</span></span></div>)}</div><div className="demo-followup-mobile">{dataset.ventures.map((venture) => <article className="demo-followup-card" key={venture.slug}><Link href={`/demo/empreendimentos/${venture.slug}?perspectiva=instituicao`} className="demo-venture-cell"><span className="demo-monogram">{initials(venture.name)}</span><span><strong>{venture.name}</strong><small>{venture.status === "ACTIVE" ? "Participação ativa" : "Participação encerrada"}</small></span></Link><div className="demo-followup-card-waves">{dataset.waves.map((wave) => <ObservationCell key={wave.sequence} venture={venture} wave={wave} />)}</div></article>)}</div></>;
}

function ObservationCell({ venture, wave }: { venture: DemoVenture; wave: DemoWave }) {
  const observation = venture.observations.find((item) => item.sequence === wave.sequence);
  const expected = isExpected(venture, wave);
  const label = !expected ? "Não prevista" : observation ? observationLabel(observation.status) : "Pendente";
  const tone = !expected ? "is-neutral" : observation?.status === "SUBMITTED" ? "is-green" : observation?.status === "MISSED" ? "is-orange" : "is-purple";
  return <span className="demo-observation-cell"><span className={`demo-status-dot ${tone}`} aria-hidden="true" /><small><b>{wave.name}</b>{label}</small></span>;
}

function MetricTrajectory({ indicator, venture, waves }: { indicator: DemoDataset["protocol"]["indicators"][number]; venture: DemoVenture; waves: DemoDataset["waves"] }) {
  const values = waves.map((wave) => valueFor(venture, wave.sequence, indicator.key));
  const numericValues = values.map((value) => value?.integerValue ?? (value?.decimalValue ? Number(value.decimalValue) : null));
  const hasNumeric = numericValues.some((value) => value !== null);
  const context = indicator.key === "additional_capital" ? "acumulado até a onda" : indicator.unit === "BRL" ? "valor mensal" : indicator.unit ?? "";
  return <div className="demo-trajectory-metric"><div className="demo-trajectory-heading"><span><strong>{indicator.label}</strong><small>{context}</small></span>{hasNumeric ? <small>{formatTrajectorySummary(numericValues)}</small> : null}</div>{indicator.valueType === "ENUM" ? <StageProgression values={values} waves={waves} /> : <><div className="demo-sparkline-wrap"><AccessibleLineChart values={numericValues} label={indicator.label} /><div className="demo-sparkline-labels">{waves.map((wave) => <span key={wave.sequence}>{wave.name}</span>)}</div></div><div className="demo-value-grid">{waves.map((wave, index) => <div key={wave.sequence}><small>{wave.name}</small><strong>{formatValue(values[index], indicator.valueType)}</strong>{values[index] ? null : <span>Sem observação</span>}</div>)}</div></>}</div>;
}

function StageProgression({ values, waves }: { values: Array<DemoObservationValue | undefined>; waves: DemoDataset["waves"] }) {
  return <div className="demo-stage-row" aria-label="Estágio do produto por onda">{values.map((value, index) => <div className="demo-stage-item" key={waves[index].sequence}><span className={`demo-stage-dot stage-${value?.textValue?.toLowerCase() ?? "empty"}`} aria-hidden="true" /><small>{waves[index].name}</small><strong>{stageLabel(value?.textValue)}</strong></div>)}</div>;
}

function AccessibleLineChart({ values, label }: { values: Array<number | null>; label: string }) {
  const finite = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (!finite.length) return <p className="demo-chart-empty">Sem observação registrada.</p>;
  const max = Math.max(...finite, 1);
  const min = Math.min(...finite, 0);
  const range = Math.max(max - min, 1);
  const xFor = (index: number) => values.length === 1 ? 150 : 10 + (index * 280) / (values.length - 1);
  const yFor = (value: number) => 76 - ((value - min) / range) * 58;
  const segments: string[] = [];
  let current: string[] = [];
  values.forEach((value, index) => {
    if (value === null || !Number.isFinite(value)) { if (current.length) segments.push(current.join(" ")); current = []; return; }
    current.push(`${xFor(index)},${yFor(value)}`);
  });
  if (current.length) segments.push(current.join(" "));
  return <svg className="demo-sparkline" viewBox="0 0 300 92" role="img" aria-label={`${label}: ${values.map((value) => value === null ? "sem observação" : value).join(", ")}`}><title>{label}</title><path d="M10 76 H290" className="demo-sparkline-baseline" />{values.map((value, index) => value === null ? <line key={`missing-${index}`} x1={xFor(index)} x2={xFor(index)} y1="71" y2="81" className="demo-sparkline-missing" aria-hidden="true" /> : null)}{segments.map((points, index) => <polyline key={index} points={points} fill="none" className="demo-sparkline-line" />)}{values.map((value, index) => value === null ? null : <circle key={`point-${index}`} cx={xFor(index)} cy={yFor(value)} r="4" className="demo-sparkline-point" />)}</svg>;
}

function isExpected(venture: DemoVenture, wave: DemoWave) {
  if (new Date(venture.enrolledAt) > new Date(wave.scheduledFor ?? venture.enrolledAt)) return false;
  return !venture.withdrawnAt || !wave.scheduledFor || new Date(venture.withdrawnAt) > new Date(wave.scheduledFor);
}

function SectionHeading({ id, title, action }: { id: string; title: string; action?: React.ReactNode }) { return <div className="demo-section-heading"><h2 id={id}><span aria-hidden="true" />{title}</h2>{action}</div>; }
function Fact({ label, value }: { label: string; value: string }) { return <div className="demo-fact"><small>{label}</small><strong>{value}</strong></div>; }
function valueFor(venture: DemoVenture, sequence: number, key: string) { return venture.observations.find((observation) => observation.sequence === sequence)?.values.find((value) => value.key === key); }
function formatValue(value: DemoObservationValue | undefined, valueType: string) { if (!value) return "—"; if (valueType === "CURRENCY") return formatMoney(value.decimalValue); if (valueType === "INTEGER") return value.integerValue == null ? "—" : new Intl.NumberFormat("pt-BR").format(value.integerValue); return stageLabel(value.textValue); }
function formatTrajectorySummary(values: Array<number | null>) { const first = values.find((value) => value !== null); const last = [...values].reverse().find((value) => value !== null); return first !== undefined && last !== undefined ? `${first} → ${last}` : ""; }
function stageLabel(value: string | null | undefined) { return ({ CONCEPT: "Conceito", PROTOTYPE: "Protótipo", MVP: "MVP", VALIDATION: "Validação", MARKET: "Mercado", SCALE: "Escala" } as Record<string, string>)[value ?? ""] ?? "Sem observação"; }
function observationLabel(status: string) { return ({ SUBMITTED: "Respondida", MISSED: "Não respondida", PENDING: "Pendente", IN_PROGRESS: "Em andamento" } as Record<string, string>)[status] ?? status; }
function formatMoney(value: string | null | undefined) { if (value === null || value === undefined) return "—"; return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Number(value)); }
function formatDate(value: string | null | undefined, pattern: "dd/MM/yyyy" | "dd MMM yyyy" | "MMM yyyy") { if (!value) return "—"; const parsed = new Date(value); if (pattern === "dd/MM/yyyy") return new Intl.DateTimeFormat("pt-BR").format(parsed); if (pattern === "MMM yyyy") return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" }).format(parsed).replace(" de ", " "); return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(parsed).replace(" de ", " "); }
function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
