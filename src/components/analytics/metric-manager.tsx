"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Plus } from "lucide-react";
import { Dialog } from "@/components/dialog";
import type { MetricDefinitionDto, MetricIndicatorDto } from "@/lib/analytics/metrics";
import { areMetricSemanticsCompatible } from "@/lib/analytics/metric-compatibility";

const aggregationLabels = { TOTAL: "Total", MEAN: "Média", MEDIAN: "Mediana", DISTRIBUTION: "Distribuição" };
const typeLabels = { INTEGER: "Número inteiro", CURRENCY: "Valor monetário", ENUM: "Categoria" };
const messages: Record<string, string> = {
  METRIC_DUPLICATE_IN_VERSION: "Esta versão já tem um indicador vinculado à métrica. Cada versão utiliza uma medida por conceito.",
  METRIC_MAPPING_HISTORY_FROZEN: "Este indicador já tem valores registrados. Seu vínculo histórico permanece preservado.",
  METRIC_MAPPING_INCOMPATIBLE: "A métrica precisa ter o mesmo tipo, unidade e opções na mesma ordem.",
  METRIC_IN_USE: "Desvincule os indicadores sem histórico antes de arquivar esta métrica.",
  METRIC_KEY_EXISTS: "Esta chave já está em uso. Escolha uma chave diferente.",
};

export function MetricManager({ organizationId, metrics, unmappedIndicators, canManage }: { organizationId: string; metrics: MetricDefinitionDto[]; unmappedIndicators: MetricIndicatorDto[]; canManage: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [valueType, setValueType] = useState<"INTEGER" | "CURRENCY" | "ENUM">("INTEGER");

  async function send(path: string, method: string, body?: unknown) {
    setPending(true); setError(null); setNotice(null);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/analytics/metrics${path}`, { method, headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const payload = await response.json() as { error?: string; code?: string };
      if (!response.ok) { setError(messages[payload.code ?? ""] ?? payload.error ?? "Não foi possível salvar. Confira os valores informados."); return false; }
      router.refresh(); return true;
    } catch { setError("Não foi possível conectar ao servidor. Seu preenchimento permanece disponível."); return false; }
    finally { setPending(false); }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    if (await send("", "POST", { key: form.get("key"), label: form.get("label"), description: form.get("description") || null, valueType, unit: form.get("unit") || null, allowedValues: valueType === "ENUM" ? String(form.get("options") ?? "").split("\n").map((value) => value.trim()).filter(Boolean) : null, primaryAggregation: valueType === "ENUM" ? "DISTRIBUTION" : form.get("primaryAggregation") })) { setOpen(false); setNotice("Métrica criada. Vincule indicadores compatíveis para utilizá-la nas análises."); }
  }
  function indicatorRow(indicator: MetricIndicatorDto, currentId: string | null) {
    return <li className="flex flex-col gap-3 border-t border-line py-3 sm:flex-row sm:items-center sm:justify-between" key={indicator.id}><div><p className="text-sm font-medium text-ink">{indicator.label}</p><p className="mt-1 text-xs leading-5 text-slate">{indicator.protocolName} · versão {indicator.protocolVersion} · {typeLabels[indicator.valueType]}{indicator.unit ? ` · ${indicator.unit}` : ""}</p>{indicator.hasObservations ? <p className="text-xs leading-5 text-slate">Vínculo preservado: existem valores registrados.</p> : null}</div>{canManage ? <label className="block min-w-0 sm:w-72"><span className="sr-only">Métrica de {indicator.label}, {indicator.protocolName}, versão {indicator.protocolVersion}</span><select className="field-control" value={currentId ?? ""} disabled={pending || indicator.hasObservations} onChange={async (event) => { if (await send("/mappings", "POST", { indicatorDefinitionId: indicator.id, metricDefinitionId: event.target.value || null })) setNotice("Vínculo analítico atualizado."); }}><option value="">Sem vínculo analítico</option>{metrics.filter((metric) => !metric.archivedAt && areMetricSemanticsCompatible(indicator, metric)).map((metric) => <option key={metric.id} value={metric.id}>{metric.label} · {metric.key}</option>)}</select></label> : null}</li>;
  }
  return <div className="space-y-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-3xl text-sm leading-6 text-slate">Uma métrica representa um conceito. O indicador registra esse conceito em uma versão de protocolo. Comparações exigem o mesmo tipo, unidade e categorias; vínculos com valores registrados permanecem preservados.</p>{canManage ? <button type="button" className="button-primary shrink-0" onClick={() => { setValueType("INTEGER"); setOpen(true); setError(null); }}><Plus size={16} aria-hidden="true" /> Nova métrica</button> : null}</div>{error && !open ? <p role="alert" className="text-sm text-danger">{error}</p> : null}{notice ? <p role="status" className="text-sm text-success">{notice}</p> : null}
    {unmappedIndicators.length ? <section className="panel"><div className="panel-header"><h2>Indicadores sem vínculo</h2><p>Vincule uma métrica compatível antes de comparar protocolos ou coortes. Indicadores com histórico permanecem separados.</p></div><ul className="px-5 sm:px-6">{unmappedIndicators.map((indicator) => indicatorRow(indicator, null))}</ul></section> : null}
    {metrics.length ? metrics.map((metric) => <section className="panel" key={metric.id}><div className="panel-header flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><h2>{metric.label}{metric.archivedAt ? <span className="ml-2 text-xs font-normal text-slate">Arquivada</span> : null}</h2><p className="break-words">{typeLabels[metric.valueType]}{metric.unit ? ` · ${metric.unit}` : ""} · {aggregationLabels[metric.primaryAggregation]} · {metric.key}</p>{metric.description ? <p>{metric.description}</p> : null}{metric.allowedValues?.length ? <p>{metric.allowedValues.join(" / ")}</p> : null}</div>{canManage && !metric.archivedAt && !metric.indicators.length ? <button type="button" className="button-secondary shrink-0" disabled={pending} onClick={async () => { if (await send(`/${metric.id}`, "DELETE")) setNotice("Métrica sem uso arquivada. Seu registro permanece disponível."); }}><Archive size={16} aria-hidden="true" /> Arquivar sem uso</button> : null}</div>{metric.indicators.length ? <ul className="px-5 sm:px-6">{metric.indicators.map((indicator) => indicatorRow(indicator, metric.id))}</ul> : <p className="px-5 py-4 text-sm text-slate sm:px-6">Nenhum indicador vinculado.</p>}</section>) : <section className="panel px-6 py-10"><h2 className="font-semibold text-ink">Defina as métricas para comparação</h2><p className="mt-2 text-sm leading-6 text-slate">Publique um protocolo para criar identidades analíticas ou crie uma métrica e vincule indicadores compatíveis.</p></section>}
    <Dialog open={open} onClose={() => { if (!pending) setOpen(false); }} title="Nova métrica analítica" description="Defina um conceito estável. Tipos, unidades e categorias precisam preservar seu significado ao longo do tempo."><form className="space-y-5" onSubmit={create}><label className="block space-y-2 text-sm font-medium text-ink"><span>Nome</span><input className="field-control" name="label" required minLength={2} maxLength={160} /></label><label className="block space-y-2 text-sm font-medium text-ink"><span>Chave estável</span><input className="field-control" name="key" required maxLength={160} pattern="[a-z][a-z0-9_]*" placeholder="receita_mensal" /><span className="block text-xs font-normal text-slate">Letras minúsculas, números e sublinhado. A chave permanece preservada.</span></label><label className="block space-y-2 text-sm font-medium text-ink"><span>Descrição (opcional)</span><textarea className="field-control" name="description" maxLength={2000} /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-2 text-sm font-medium text-ink"><span>Tipo de valor</span><select className="field-control" value={valueType} onChange={(event) => setValueType(event.target.value as typeof valueType)}>{Object.entries(typeLabels).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label><label className="block space-y-2 text-sm font-medium text-ink"><span>Unidade (opcional)</span><input className="field-control" name="unit" maxLength={40} placeholder={valueType === "CURRENCY" ? "R$" : "Pessoas"} /></label></div>{valueType === "ENUM" ? <label className="block space-y-2 text-sm font-medium text-ink"><span>Categorias, uma por linha</span><textarea className="field-control min-h-28" name="options" required /><span className="block text-xs font-normal text-slate">A ordem e os nomes devem coincidir com os indicadores. A agregação será a distribuição.</span></label> : <label className="block space-y-2 text-sm font-medium text-ink"><span>Agregação principal</span><select name="primaryAggregation" className="field-control"><option value="TOTAL">Total</option><option value="MEAN">Média</option><option value="MEDIAN">Mediana</option></select></label>}{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}<div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end"><button type="button" className="button-secondary" disabled={pending} onClick={() => setOpen(false)}>Cancelar</button><button className="button-primary" disabled={pending}>{pending ? "Criando…" : "Criar métrica"}</button></div></form></Dialog>
  </div>;
}
