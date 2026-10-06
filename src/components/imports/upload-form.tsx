"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Download, Upload } from "lucide-react";
import { IMPORT_TEMPLATES, IMPORT_TYPES, type ImportEntityType } from "@/lib/imports/templates";

export function ImportUploadForm({ organizationId }: { organizationId: string }) {
  const router = useRouter(); const feedback = useRef<HTMLDivElement>(null);
  const [type, setType] = useState<ImportEntityType>("FUNDING_PROGRAMS");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [uncertain, setUncertain] = useState(false);
  const template = IMPORT_TEMPLATES[type];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || uncertain) return;
    const form = new FormData(event.currentTarget); const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > 2 * 1024 * 1024) { setError("Escolha um CSV preenchido de até 2 MiB."); requestAnimationFrame(() => feedback.current?.focus()); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/organizations/${organizationId}/imports`, { method: "POST", body: form });
      const result = await response.json() as { id?: string; error?: string };
      if (!response.ok) { if (response.status >= 500) setUncertain(true); throw new Error(result.error ?? "Não foi possível carregar o arquivo."); }
      if (!result.id) { setUncertain(true); throw new Error("A resposta não confirmou o lote. Consulte o histórico antes de enviar novamente."); }
      router.push(`/app/imports/${result.id}`); router.refresh();
    } catch (cause) {
      if (cause instanceof TypeError || cause instanceof SyntaxError) setUncertain(true);
      setError(cause instanceof Error && !(cause instanceof TypeError) && !(cause instanceof SyntaxError) ? cause.message : "A conexão foi interrompida. Consulte o histórico para verificar se o lote foi criado.");
      requestAnimationFrame(() => feedback.current?.focus());
    } finally { setBusy(false); }
  }
  return <section className="panel"><div className="panel-header"><h2>Carregar dados históricos</h2><p>O carregamento prepara uma prévia. A aplicação exige revisão e confirmação.</p></div>
    <form className="space-y-5 p-5 sm:p-6" onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy || uncertain} className="grid min-w-0 gap-5 sm:grid-cols-2">
        <label className="min-w-0 text-sm font-medium" htmlFor="import-type">Tipo de registro<select id="import-type" name="type" className="field-control mt-2 w-full min-w-0" value={type} onChange={(event) => setType(event.target.value as ImportEntityType)}>{IMPORT_TYPES.map((value) => <option key={value} value={value}>{IMPORT_TEMPLATES[value].label}</option>)}</select></label>
        <label className="min-w-0 text-sm font-medium" htmlFor="import-namespace">Identificador da origem<input id="import-namespace" name="namespace" required maxLength={80} pattern="[a-z0-9][a-z0-9._-]*" placeholder="ex.: arquivo-institucional-2024" className="field-control mt-2 w-full" aria-describedby="namespace-help" /><span id="namespace-help" className="mt-2 block text-xs font-normal leading-5 text-slate">Use o mesmo identificador em todos os arquivos relacionados. Letras minúsculas, números, ponto, hífen e sublinhado.</span></label>
        <label className="min-w-0 text-sm font-medium" htmlFor="import-file">Arquivo CSV<input id="import-file" name="file" type="file" accept=".csv,text/csv" required className="mt-2 block min-h-11 w-full min-w-0 max-w-full text-sm file:mr-3 file:min-h-11 file:rounded-md file:border file:border-line file:bg-white file:px-3" aria-describedby="file-help" /><span id="file-help" className="mt-2 block text-xs font-normal leading-5 text-slate">UTF-8, até 2 MiB, 1.000 linhas de dados, 64 colunas e 4.000 caracteres por célula. Arquivos XLSX precisam ser salvos como CSV.</span></label>
        <div className="min-w-0 space-y-4"><label className="block text-sm font-medium" htmlFor="import-delimiter">Separador<select id="import-delimiter" name="delimiter" className="field-control mt-2 w-full" defaultValue="auto"><option value="auto">Detectar pelo cabeçalho</option><option value=",">Vírgula</option><option value=";">Ponto e vírgula</option></select></label><input type="hidden" name="mode" value="CREATE_ONLY" /><p className="text-xs leading-5 text-slate">Inicialmente, somente novos registros. Atualizações descritivas de programas e empreendimentos podem ser habilitadas na revisão do mapeamento.</p></div>
      </fieldset>
      <div className="border-y border-line py-4"><p className="text-sm text-slate">{template.description}</p><a className="button-tertiary mt-2" href={`/api/organizations/${organizationId}/imports/templates?type=${type}`}><Download size={16} aria-hidden="true" />Baixar modelo de {template.label.toLowerCase()}</a><p className="mt-2 text-xs leading-5 text-slate">Modelo versão 1, sem dados de exemplo. Importe programas e empreendimentos antes dos seus vínculos; configure o protocolo antes das ondas. Modelos usam identificadores da origem. Na revisão, você pode mapear IDs do Atlas em seu lugar.</p></div>
      <div ref={feedback} tabIndex={-1} className={error ? "rounded-md border border-danger/30 p-3 text-sm text-danger" : ""} role={error ? "alert" : undefined}>{error}{uncertain ? <p className="mt-2"><Link className="underline" href="/app/imports" onClick={() => router.refresh()}>Conferir os lotes recebidos antes de repetir</Link></p> : null}</div>
      <div className="flex flex-wrap items-center gap-3"><button className="button-primary" disabled={busy || uncertain} type="submit"><Upload size={16} aria-hidden="true" />{busy ? "Carregando…" : "Carregar e revisar"}</button><span role="status" className="text-sm text-slate">{busy ? "Aguarde a confirmação do carregamento." : ""}</span></div>
    </form>
  </section>;
}
