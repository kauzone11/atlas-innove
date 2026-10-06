import { Panel, PanelHeader } from "@/components/ui";
import type { CohortResultsDto } from "@/lib/monitoring/read-model";
import { formatIndicatorValue } from "@/lib/monitoring/format";

export function CohortResults({ results }: { results: CohortResultsDto }) {
  const indicators = results.waves[0]?.indicators ?? [];
  return <Panel className="min-w-0">
    <PanelHeader title="Resultados da coorte" description={results.protocol ? `${results.protocol.name} · versão ${results.protocol.version}${results.protocol.label ? ` · ${results.protocol.label}` : ""}` : "Aplique uma versão de protocolo para analisar os indicadores desta coorte."} />
    {!results.protocol ? null : !results.waves.length ? <p className="px-6 pb-6 text-sm text-slate">Crie a baseline e registre observações para iniciar a comparação descritiva.</p> : <>
      <div className="divide-y divide-line border-y border-line">
        {results.waves.map((wave) => <div key={wave.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 text-sm">
          <span className="font-medium text-ink">{wave.name}</span>
          <span className="text-slate">{wave.coverage.submitted} de {wave.coverage.expected} observações enviadas{wave.coverage.percentage === null ? " · cobertura —" : ` · ${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(wave.coverage.percentage)}% de cobertura`}</span>
          {wave.coverage.ineligibleUnanswered > 0 ? <span className="basis-full text-xs text-slate">{wave.coverage.ineligibleUnanswered} {wave.coverage.ineligibleUnanswered === 1 ? "observação sem envio fora da vigência" : "observações sem envio fora da vigência"} na data de referência; histórico preservado.</span> : null}
        </div>)}
      </div>
      {indicators.length ? <div className="max-w-full overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <caption className="sr-only">Comparação descritiva por onda e indicador, com número de valores válidos</caption>
          <thead><tr className="border-b border-line bg-surface-subtle"><th scope="col" className="px-6 py-3 font-medium text-slate">Indicador</th>{results.waves.map((wave) => <th key={wave.id} scope="col" className="px-5 py-3 font-medium text-slate">{wave.name}</th>)}</tr></thead>
          <tbody>{indicators.map((indicator) => <tr key={indicator.id} className="border-b border-line last:border-b-0">
            <th scope="row" className="px-6 py-4 font-medium text-ink">{indicator.label}<span className="mt-1 block text-xs font-normal text-slate">{indicator.valueType === "ENUM" ? "Distribuição" : "Média e total dos valores observados"}</span></th>
            {results.waves.map((wave) => {
              const aggregate = wave.indicators.find((current) => current.id === indicator.id);
              return <td key={wave.id} className="px-5 py-4 align-top text-ink">
                {indicator.valueType === "ENUM" ? <span>{aggregate?.validCount ? aggregate.distribution.filter((item) => item.count > 0).map((item) => `${item.value}: ${item.count}`).join(" · ") : "—"}</span> : <><span className="block font-medium tabular-nums">{formatIndicatorValue(aggregate?.mean ?? null, indicator.valueType, indicator.unit)}</span><span className="mt-1 block text-xs text-slate">Total: {formatIndicatorValue(aggregate?.sum ?? null, indicator.valueType, indicator.unit)}</span></>}
                <span className="mt-2 block text-xs text-slate">{aggregate?.validCount ?? 0} {aggregate?.validCount === 1 ? "valor válido" : "valores válidos"}</span>
                {aggregate?.missingCount ? <span className="mt-1 block text-xs text-slate">{aggregate.missingCount} {aggregate.missingCount === 1 ? "envio sem valor válido" : "envios sem valor válido"}</span> : null}
              </td>;
            })}
          </tr>)}</tbody>
        </table>
      </div> : null}
      <p className="border-t border-line px-6 py-4 text-xs leading-5 text-slate">Somente valores válidos de observações enviadas entram nos resultados. — indica ausência de valor observado; zero permanece zero. A comparação descreve esta coorte e esta versão de protocolo, sem atribuir os resultados ao programa. A composição dos respondentes pode variar entre ondas.</p>
    </>}
  </Panel>;
}
