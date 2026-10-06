import Link from "next/link";

import { Panel, PanelHeader, StatusBadge } from "@/components/ui";
import type { VentureTrajectoryDto } from "@/lib/monitoring/read-model";
import { formatIndicatorValue, formatMonitoringDate, observationStatusLabel } from "@/lib/monitoring/format";

export function VentureTrajectory({ trajectory }: { trajectory: VentureTrajectoryDto[] }) {
  if (!trajectory.length) return <Panel><PanelHeader title="Trajetória longitudinal" /><p className="px-6 pb-6 text-sm text-slate">Adicione uma participação em coorte para acompanhar este empreendimento ao longo do tempo.</p></Panel>;
  return <section className="min-w-0 space-y-5" aria-labelledby="trajectory-title">
    <div><h2 id="trajectory-title" className="text-xl font-semibold tracking-tight text-ink">Trajetória longitudinal</h2><p className="mt-2 text-sm leading-6 text-slate">Cada participação mantém seu contexto de coorte e a versão do protocolo aplicado. Valores ausentes aparecem como —.</p></div>
    {trajectory.map((participation) => <Panel key={participation.enrollmentId} className="min-w-0">
      <PanelHeader title={participation.cohort.name} description={`${participation.cohort.fundingProgram.name} · entrada em ${formatMonitoringDate(participation.enrolledAt)}`} action={<Link className="button-tertiary min-h-9 px-2 text-xs" href={`/app/programs/${participation.cohort.fundingProgramId}/cohorts/${participation.cohort.id}`}>Abrir coorte</Link>} />
      <div className="flex flex-wrap items-center gap-3 border-y border-line px-6 py-3 text-sm text-slate"><StatusBadge label={participation.enrollmentStatus === "ACTIVE" ? "Participação ativa" : "Participação retirada"} tone={participation.enrollmentStatus === "ACTIVE" ? "success" : "neutral"} /><span>{participation.protocol ? `${participation.protocol.name} · versão ${participation.protocol.version}${participation.protocol.label ? ` · ${participation.protocol.label}` : ""}` : "Protocolo ainda não aplicado"}</span>{participation.withdrawnAt ? <span>Retirada em {formatMonitoringDate(participation.withdrawnAt)}</span> : null}</div>
      {!participation.waves.length ? <p className="px-6 py-6 text-sm text-slate">Esta coorte ainda não possui ondas de acompanhamento.</p> : <div className="max-w-full overflow-x-auto"><table className="w-full min-w-[32rem] text-left text-sm">
        <caption className="sr-only">Indicadores deste empreendimento por onda em {participation.cohort.name}</caption>
        <thead><tr className="border-b border-line bg-surface-subtle"><th scope="col" className="px-6 py-4 font-medium text-slate">Indicador</th>{participation.waves.map((wave) => <th key={wave.id} scope="col" className="px-5 py-4 align-top font-medium text-ink"><span className="block">{wave.name}</span><span className="mt-1 block text-xs font-normal text-slate">{formatMonitoringDate(wave.scheduledFor)}</span><span className="mt-1 block text-xs font-normal text-slate">{observationStatusLabel(wave.observationStatus)}</span></th>)}</tr></thead>
        <tbody>{participation.indicators.map((indicator) => <tr key={indicator.id} className="border-b border-line"><th scope="row" className="px-6 py-4 font-medium text-ink">{indicator.label}</th>{participation.waves.map((wave) => <td key={wave.id} className="px-5 py-4 tabular-nums text-ink">{formatIndicatorValue(wave.values.find((value) => value.indicatorId === indicator.id)?.value ?? null, indicator.valueType, indicator.unit)}</td>)}</tr>)}
          <tr><th scope="row" className="px-6 py-4 font-normal text-slate">Registro</th>{participation.waves.map((wave) => <td key={wave.id} className="px-5 py-4">{wave.observationId ? <Link className="inline-flex min-h-11 items-center font-medium text-accent-hover hover:underline" href={`/app/observations/${wave.observationId}`}>{wave.observationStatus === "SUBMITTED" ? "Ver observação" : "Abrir observação"}</Link> : <span className="text-slate">—</span>}</td>)}</tr>
        </tbody>
      </table></div>}
      {participation.waves.length ? <p className="border-t border-line px-6 py-4 text-xs leading-5 text-slate">Exibimos os valores enviados em cada onda, sem preencher lacunas ou combinar participações diferentes. Rascunhos permanecem disponíveis na observação.</p> : null}
    </Panel>)}
  </section>;
}
