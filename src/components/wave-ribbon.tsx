import { CoverageBar } from "@/components/ui";
import { formatMonitoringDate } from "@/lib/monitoring/format";
import type { MonitoringWaveDto } from "@/lib/monitoring/read-model";

const stateClass = { OVERDUE: "late", OPEN: "open", CLOSED: "done", UPCOMING: "", ARCHIVED: "" } as const;

/** Waves of one cohort as a timeline. Coverage is submitted over expected; future waves show no percentage. */
export function WaveRibbon({ waves }: { waves: MonitoringWaveDto[] }) {
  return (
    <ol className="ribbon" style={{ ["--n" as string]: waves.length }} aria-label="Ondas de acompanhamento">
      {waves.map((wave) => {
        const started = wave.attention !== "UPCOMING" && wave.coverage.expected > 0;
        return (
          <li key={wave.id} className={`rb ${stateClass[wave.attention]}`}>
            <span className="nd" />
            <b className="nm">{wave.name}</b>
            <small>{formatMonitoringDate(wave.closesAt ?? wave.scheduledFor ?? wave.opensAt)}</small>
            {started ? <>
              <div className="pc">{Math.round(wave.coverage.percentage ?? 0)}%</div>
              <CoverageBar submitted={wave.coverage.submitted} inProgress={wave.coverage.inProgress} pending={wave.coverage.pending} missed={wave.coverage.missed} />
              <span className="ct">{wave.coverage.submitted} de {wave.coverage.expected} enviadas</span>
            </> : <><div className="pc" style={{ color: "var(--faint)" }}>—</div><span className="ct">{wave.coverage.expected ? `Prevista · ${wave.coverage.expected} esperadas` : "Sem observações previstas"}</span></>}
          </li>
        );
      })}
    </ol>
  );
}
