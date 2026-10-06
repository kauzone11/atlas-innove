import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { StatusBadge } from "@/components/ui";
import type { MonitoringWaveDto } from "@/lib/monitoring/read-model";
import { formatMonitoringDate } from "@/lib/monitoring/format";

const attentionLabels = { OVERDUE: "Em atraso", OPEN: "Aberta", UPCOMING: "Próxima", CLOSED: "Encerrada", ARCHIVED: "Arquivada" } as const;

export function MonitoringWaves({ waves, showPending = true }: { waves: MonitoringWaveDto[]; showPending?: boolean }) {
  return <div className="divide-y divide-line">{waves.map((wave) => <article key={wave.id} className="px-5 py-5 sm:px-6">
    <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(9rem,0.5fr)_auto] md:items-start">
      <div className="min-w-0"><Link href={`/app/programs/${wave.cohort.fundingProgramId}/cohorts/${wave.cohort.id}`} className="inline-flex min-h-11 items-center gap-2 font-semibold text-ink hover:text-accent-hover"><span className="break-words">{wave.name}</span><ArrowRight size={15} className="shrink-0" aria-hidden="true" /></Link><p className="text-sm leading-6 text-slate">{wave.cohort.name} · {wave.cohort.fundingProgram.name}</p></div>
      <div className="text-sm"><p className="text-slate">{wave.closesAt ? "Encerramento previsto" : wave.opensAt ? "Abertura prevista" : "Data prevista"}</p><p className="mt-1 text-ink">{formatMonitoringDate(wave.closesAt ?? wave.opensAt ?? wave.scheduledFor)}</p></div>
      <div className="flex flex-wrap items-center gap-3 md:flex-col md:items-end"><StatusBadge label={attentionLabels[wave.attention]} tone={wave.attention === "OVERDUE" ? "danger" : wave.attention === "OPEN" ? "success" : "neutral"} /><span className="text-xs text-slate">{wave.coverage.submitted}/{wave.coverage.expected} enviadas · {wave.coverage.percentage === null ? "cobertura —" : `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(wave.coverage.percentage)}%`}</span></div>
    </div>
    {wave.coverage.expected ? <div className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-surface-subtle" aria-hidden="true"><span className="bg-success" style={{ width: `${wave.coverage.submitted * 100 / wave.coverage.expected}%` }} /><span className="bg-warning" style={{ width: `${wave.coverage.inProgress * 100 / wave.coverage.expected}%` }} /></div> : null}
    <p className="mt-3 text-xs leading-5 text-slate">{wave.coverage.pending} pendentes · {wave.coverage.inProgress} em preenchimento · {wave.coverage.missed} não respondidas{wave.coverage.ineligibleUnanswered ? ` · ${wave.coverage.ineligibleUnanswered} sem envio fora da vigência na data de referência` : ""}</p>
    {showPending && wave.pendingObservations.length ? <details className="mt-3"><summary className="w-fit cursor-pointer py-2 text-sm font-medium text-accent-hover">Empreendimentos com observações pendentes ({wave.pendingObservations.length})</summary><ul className="mt-2 divide-y divide-line">{wave.pendingObservations.map((observation) => <li key={observation.id}><Link href={`/app/observations/${observation.id}`} className="flex min-h-11 items-center justify-between gap-3 py-3 text-sm text-ink hover:text-accent-hover"><span className="break-words">{observation.venture.name}</span><span className="shrink-0 text-xs text-slate">{observation.status === "IN_PROGRESS" ? "Continuar registro" : "Registrar"}</span></Link></li>)}</ul></details> : null}
  </article>)}</div>;
}
