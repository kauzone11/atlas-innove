"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Plus, Trash2 } from "lucide-react";

import { Dialog } from "@/components/dialog";
import type { TrackingProtocolDto } from "@/lib/tracking-protocols/service";

type IndicatorRow = { rowId: string; key: string; label: string; valueType: "INTEGER" | "CURRENCY" | "ENUM"; unit: string; options: string; keyLocked: boolean };
const newRow = (): IndicatorRow => ({ rowId: crypto.randomUUID(), key: "", label: "", valueType: "INTEGER", unit: "", options: "", keyLocked: false });

export function TrackingProtocolManager({ organizationId, protocols, canManage }: { organizationId: string; protocols: TrackingProtocolDto[]; canManage: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [protocolId, setProtocolId] = useState<string | undefined>();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [label, setLabel] = useState("");
  const [rows, setRows] = useState<IndicatorRow[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function start(protocol?: TrackingProtocolDto) {
    setProtocolId(protocol?.id);
    setName(protocol?.name ?? "");
    setDescription(protocol?.description ?? "");
    setLabel("");
    const indicators = protocol?.versions[0]?.indicators;
    setRows(indicators?.length ? indicators.map((indicator) => ({ rowId: crypto.randomUUID(), key: indicator.key, label: indicator.label, valueType: indicator.valueType, unit: indicator.unit ?? "", options: indicator.allowedValues?.join("\n") ?? "", keyLocked: true })) : [newRow()]);
    setError(null);
    setOpen(true);
  }

  function updateRow(rowId: string, patch: Partial<IndicatorRow>) {
    setRows((current) => current.map((row) => row.rowId === rowId ? { ...row, ...patch } : row));
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/protocols`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protocolId, name, description: description || null, label: label || null, indicators: rows.map((row) => ({ key: row.key, label: row.label, valueType: row.valueType, unit: row.unit || null, allowedValues: row.valueType === "ENUM" ? row.options.split("\n").map((value) => value.trim()).filter(Boolean) : null })) }),
      });
      const payload = await response.json() as { error?: string; issues?: Record<string, string[] | undefined> };
      if (!response.ok) { setError(payload.issues ? "Confira os nomes dos indicadores e as opções. Use nomes diferentes e, para categorias, informe opções únicas, uma por linha." : payload.error ?? "Não foi possível publicar o protocolo."); return; }
      setOpen(false);
      setNotice(protocolId ? "Nova versão publicada. As coortes existentes mantêm a versão que já utilizam." : "Protocolo publicado. Você já pode aplicar a versão a uma coorte.");
      router.refresh();
    } catch { setError("Não foi possível conectar ao servidor. Seus dados continuam nesta janela."); }
    finally { setPending(false); }
  }

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-2xl text-sm leading-6 text-slate">Os indicadores definem o que será registrado em cada onda. Cada publicação cria uma versão permanente, preservando a comparação histórica.</p>{canManage ? <button type="button" className="button-primary shrink-0" onClick={() => start()}><Plus size={17} aria-hidden="true" /> Novo protocolo</button> : null}</div>
    {notice ? <p role="status" className="text-sm text-success">{notice}</p> : null}
    {protocols.length ? protocols.map((protocol) => <section className="panel" key={protocol.id}>
      <div className="panel-header flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><h2>{protocol.name}</h2>{protocol.description ? <p>{protocol.description}</p> : null}</div>{canManage ? <button type="button" className="button-secondary shrink-0" onClick={() => start(protocol)}><Plus size={16} aria-hidden="true" /> Nova versão</button> : null}</div>
      <div className="divide-y divide-line">{protocol.versions.map((version) => <details key={version.id} className="group px-5 py-4 sm:px-6" open={version.id === protocol.versions[0]?.id}><summary className="cursor-pointer text-sm font-medium text-ink">Versão {version.version} <span className="font-normal text-slate">· {version.indicators.length} indicador(es){version.label ? ` · ${version.label}` : ""}</span></summary><dl className="mt-4 divide-y divide-line">{version.indicators.map((indicator) => <div key={indicator.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:justify-between"><dt className="text-sm font-medium text-ink">{indicator.label}</dt><dd className="text-sm text-slate sm:max-w-[60%] sm:text-right">{typeLabel(indicator.valueType)}{indicator.unit ? ` · ${indicator.unit}` : ""}{indicator.allowedValues?.length ? ` · ${indicator.allowedValues.join(" / ")}` : ""}</dd></div>)}</dl></details>)}</div>
    </section>) : <section className="panel px-6 py-12 text-center"><BookOpen size={28} className="mx-auto text-slate" aria-hidden="true" /><h2 className="mt-4 font-semibold text-ink">Defina o que acompanhar</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate">Crie um protocolo com indicadores de equipe, clientes, faturamento ou estágio. Depois, aplique uma versão à coorte antes de criar a primeira onda.</p>{!canManage ? <p className="mt-3 text-sm text-slate">Um administrador da organização pode criar o primeiro protocolo.</p> : null}</section>}
    <Dialog open={open} onClose={() => { if (!pending) setOpen(false); }} mode="sheet" title={protocolId ? "Publicar nova versão" : "Novo protocolo"} description="Revise os indicadores antes de publicar. A versão publicada não poderá ser alterada.">
      <form onSubmit={publish} className="space-y-6">
        {protocolId ? <p className="font-medium text-ink">{name}</p> : <><label className="block space-y-2 text-sm font-medium text-ink" htmlFor="protocol-name"><span>Nome do protocolo</span><input id="protocol-name" className="field-control" required minLength={2} maxLength={160} value={name} onChange={(event) => setName(event.target.value)} /></label><label className="block space-y-2 text-sm font-medium text-ink" htmlFor="protocol-description"><span>Descrição <span className="font-normal text-slate">(opcional)</span></span><textarea id="protocol-description" className="field-control min-h-20" maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} /></label></>}
        <label className="block space-y-2 text-sm font-medium text-ink" htmlFor="protocol-version-label"><span>Descrição desta versão <span className="font-normal text-slate">(opcional)</span></span><input id="protocol-version-label" className="field-control" maxLength={300} value={label} onChange={(event) => setLabel(event.target.value)} /></label>
        <fieldset className="space-y-4"><legend className="mb-3 text-sm font-semibold text-ink">Indicadores</legend>{rows.map((row, index) => <div key={row.rowId} className="space-y-4 border-t border-line pt-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-slate">Indicador {index + 1}</p><button type="button" className="button-secondary px-3" disabled={pending || rows.length === 1} aria-label={`Remover indicador ${index + 1}`} onClick={() => setRows((current) => current.filter((item) => item.rowId !== row.rowId))}><Trash2 size={16} aria-hidden="true" /></button></div><label htmlFor={`indicator-label-${row.rowId}`} className="block space-y-2 text-sm font-medium text-ink"><span>Nome</span><input id={`indicator-label-${row.rowId}`} className="field-control" required minLength={2} maxLength={160} value={row.label} onChange={(event) => updateRow(row.rowId, { label: event.target.value, ...(!row.keyLocked ? { key: indicatorKey(event.target.value) } : {}) })} /></label><div className="grid gap-4 sm:grid-cols-2"><label htmlFor={`indicator-type-${row.rowId}`} className="block space-y-2 text-sm font-medium text-ink"><span>Tipo de valor</span><select id={`indicator-type-${row.rowId}`} className="field-control" value={row.valueType} onChange={(event) => updateRow(row.rowId, { valueType: event.target.value as IndicatorRow["valueType"] })}><option value="INTEGER">Número inteiro</option><option value="CURRENCY">Valor monetário</option><option value="ENUM">Categoria</option></select></label><label htmlFor={`indicator-unit-${row.rowId}`} className="block space-y-2 text-sm font-medium text-ink"><span>Unidade <span className="font-normal text-slate">(opcional)</span></span><input id={`indicator-unit-${row.rowId}`} className="field-control" maxLength={40} placeholder={row.valueType === "CURRENCY" ? "R$" : "Pessoas, clientes…"} value={row.unit} onChange={(event) => updateRow(row.rowId, { unit: event.target.value })} /></label></div>{row.valueType === "ENUM" ? <label htmlFor={`indicator-options-${row.rowId}`} className="block space-y-2 text-sm font-medium text-ink"><span>Opções, uma por linha</span><textarea id={`indicator-options-${row.rowId}`} className="field-control min-h-28" required value={row.options} onChange={(event) => updateRow(row.rowId, { options: event.target.value })} /><span className="block text-xs font-normal text-slate">A observação aceitará apenas uma das opções desta versão.</span></label> : null}</div>)}</fieldset>
        <button type="button" className="button-secondary" disabled={pending || rows.length >= 40} onClick={() => setRows((current) => [...current, newRow()])}><Plus size={16} aria-hidden="true" /> Adicionar indicador</button>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end"><button type="button" className="button-secondary" disabled={pending} onClick={() => setOpen(false)}>Cancelar</button><button className="button-primary" disabled={pending}>{pending ? "Publicando…" : "Publicar versão"}</button></div>
      </form>
    </Dialog>
  </div>;
}

function indicatorKey(label: string): string {
  const key = label.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 76);
  return (/^[a-z]/.test(key) ? key : `indicator_${key}`).slice(0, 80);
}

function typeLabel(type: string): string { return ({ INTEGER: "Número inteiro", CURRENCY: "Valor monetário", ENUM: "Categoria" } as Record<string, string>)[type] ?? type; }
