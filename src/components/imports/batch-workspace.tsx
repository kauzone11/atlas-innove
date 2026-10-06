"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Download, RefreshCw } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { StatusBadge } from "@/components/ui";
import { ImportPagination, importDate, type Serialized } from "@/components/imports/shared";
import { IMPORT_STATUS_LABELS, importFieldLabel, importMessage } from "@/lib/imports/copy";
import { IMPORT_TEMPLATES } from "@/lib/imports/templates";
import type { getImportBatch } from "@/lib/imports/staging";
import type { previewImportRollback } from "@/lib/imports/rollback";
import type { getImportAudit } from "@/lib/imports/audit";
import type { ImportMapping } from "@/lib/imports/mapping";
import type { ImportIssue } from "@/lib/imports/validation";
import type { NormalizedImportRow } from "@/lib/imports/normalization";

type Detail = Serialized<Awaited<ReturnType<typeof getImportBatch>>>;
type Rollback = Awaited<ReturnType<typeof previewImportRollback>>;
type Audit = Serialized<Awaited<ReturnType<typeof getImportAudit>>>;
type Mode = "CREATE_ONLY" | "UPSERT";
type Action = "mapping" | "validate" | "apply" | "rollback";

export function ImportBatchWorkspace({ initial, audit, qualityHref }: { initial: Detail; audit: Audit; qualityHref: string }) {
  const router = useRouter(); const feedback = useRef<HTMLDivElement>(null);
  const [detail, setDetail] = useState(initial);
  const [mapping, setMapping] = useState(initial.batch.mapping as ImportMapping);
  const [mode, setMode] = useState<Mode>((initial.batch.options as { mode: Mode }).mode);
  const [busy, setBusy] = useState(""); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [uncertain, setUncertain] = useState(false); const [invalidField, setInvalidField] = useState("");
  const [confirmation, setConfirmation] = useState<"apply" | "rollback" | null>(null); const [confirmed, setConfirmed] = useState(false);
  const [rollback, setRollback] = useState<Rollback | null>(null);
  const batch = detail.batch; const template = IMPORT_TEMPLATES[batch.type];
  const base = `/api/organizations/${batch.organizationId}/imports/${batch.id}`;
  const mutable = ["UPLOADED", "READY", "FAILED"].includes(batch.status);
  const dirty = JSON.stringify(mapping) !== JSON.stringify(batch.mapping) || mode !== (batch.options as { mode: Mode }).mode;
  const pageHref = (page: number, filter = detail.filter) => `/app/imports/${batch.id}?${new URLSearchParams({ page: String(page), filter })}`;
  useEffect(() => { setDetail(initial); setMapping(initial.batch.mapping as ImportMapping); setMode((initial.batch.options as { mode: Mode }).mode); setRollback(null); }, [initial]);
  useEffect(() => { if (error) feedback.current?.focus(); }, [error]);

  async function refreshState() {
    const response = await fetch(`${base}?page=${detail.page}&filter=${detail.filter}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Não foi possível consultar o estado atual. Recarregue a página antes de repetir a operação.");
    const latest = await response.json() as Detail;
    setDetail(latest); setMapping(latest.batch.mapping as ImportMapping); setMode((latest.batch.options as { mode: Mode }).mode); setRollback(null); setUncertain(false);
    router.refresh();
    return latest;
  }
  async function consultState() {
    if (busy) return; setBusy("consult"); setError("");
    try { const current = await refreshState(); setMessage(`Estado confirmado: ${IMPORT_STATUS_LABELS[current.batch.status]}.`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível consultar o lote."); }
    finally { setBusy(""); }
  }
  async function execute(action: Action) {
    if (busy || uncertain) return;
    setBusy(action); setError(""); setMessage(""); setInvalidField("");
    setUncertain(true);
    try {
      const response = await fetch(`${base}/${action}`, { method: action === "mapping" ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedRevision: batch.revision, ...(action === "mapping" ? { mapping, options: { mode } } : {}), ...(["apply", "rollback"].includes(action) ? { confirmed: true } : {}) }) });
      const result = await response.json() as { error?: string; field?: string; status?: string; code?: string };
      if (!response.ok) {
        setInvalidField(result.field ?? "");
        setUncertain(response.status >= 500 || response.status === 409);
        throw new Error(result.error ?? "Não foi possível concluir a etapa. Revise os dados informados.");
      }
      setConfirmation(null); setConfirmed(false);
      const current = await refreshState();
      setMessage(action === "mapping" ? "Mapeamento salvo. Agora valide os dados." : action === "validate" ? current.batch.status === "READY" ? "Validação concluída. Confira a prévia antes de aplicar." : "A validação encontrou impedimentos. Confira as linhas e corrija o mapeamento ou carregue um arquivo corrigido." : action === "apply" ? "Lote aplicado. Os registros e sua origem foram gravados juntos." : "Lote revertido. O histórico de importação foi preservado.");
    } catch (cause) {
      setConfirmation(null); setConfirmed(false);
      if (cause instanceof TypeError || cause instanceof SyntaxError) setUncertain(true);
      setError(cause instanceof Error && !(cause instanceof TypeError) && !(cause instanceof SyntaxError) ? cause.message : "A conexão foi interrompida. Consulte o estado atual do lote antes de repetir.");
    } finally { setBusy(""); }
  }
  async function loadRollback(page = 1) {
    if (busy) return; setBusy("preview"); setError("");
    try {
      const response = await fetch(`${base}/rollback?page=${page}`, { cache: "no-store" });
      const result = await response.json() as Rollback & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Não foi possível conferir a reversão.");
      setRollback(result); setMessage("Conferência da reversão atualizada. As condições serão verificadas novamente ao confirmar.");
    } catch (cause) { setError(cause instanceof Error && !(cause instanceof TypeError) ? cause.message : "Não foi possível consultar a reversão. Tente consultar novamente."); }
    finally { setBusy(""); }
  }
  const ignored = (batch.headers as string[]).filter((header) => !Object.values(mapping).includes(header));
  const actorName = (id: string | null) => detail.actors.find((actor) => actor.id === id)?.name ?? "Não realizada";
  return <div className="min-w-0 space-y-6" aria-busy={Boolean(busy)}>
    <section className="border-y border-line py-4" aria-label="Estado do lote"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-3"><StatusBadge label={IMPORT_STATUS_LABELS[batch.status]} tone={batch.status === "APPLIED" ? "success" : batch.status === "FAILED" ? "danger" : "neutral"} /><span className="break-all text-sm text-slate">Origem: {batch.namespace}</span></div><button className="button-tertiary" type="button" disabled={Boolean(busy)} onClick={consultState}><RefreshCw size={16} aria-hidden="true" />Consultar estado atual</button></div>
      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">{[["Linhas recebidas", batch.totalRows], ["Linhas válidas", batch.validRows], ["Com impedimentos", batch.invalidRows], ["Com avisos", batch.warningRows]].map(([label, value]) => <div key={label}><dt className="text-slate">{label}</dt><dd className="mt-1 font-semibold tabular-nums">{value}</dd></div>)}</dl>
      {batch.status === "APPLIED" ? <p className="mt-4 text-sm">{batch.appliedRows} linha(s) aplicada(s). <Link href={qualityHref} className="font-semibold text-accent-hover underline">Conferir qualidade das evidências</Link></p> : null}
      {batch.status === "ROLLED_BACK" ? <p className="mt-4 text-sm text-slate">Este lote foi revertido e não pode ser reaplicado. Para uma nova importação, carregue outro arquivo e revise as referências.</p> : null}
    </section>
    <div ref={feedback} tabIndex={-1} role={error ? "alert" : undefined} className={error ? "rounded-md border border-danger/30 p-4 text-sm text-danger" : ""}>{error}{uncertain ? <p className="mt-2">Uma resposta incompleta ou uma revisão desatualizada exige conferir o lote. Use “Consultar estado atual” antes de continuar.</p> : null}</div>
    <p role="status" aria-live="polite" className="text-sm text-slate">{busy ? "Processando. Aguarde a confirmação antes de continuar." : message}</p>
    {batch.failureCode ? <p className="flex items-start gap-2 text-sm text-danger"><AlertCircle size={18} className="shrink-0" aria-hidden="true" />{importMessage(batch.failureCode)}</p> : null}

    {mutable ? <section className="panel" aria-labelledby="mapping-title"><div className="panel-header"><h2 id="mapping-title">1. Revisar o mapeamento</h2><p>Associe cada campo à coluna do arquivo. Campos opcionais sem dados podem ficar sem associação. Use apenas uma referência por vínculo.</p></div>
      <form className="space-y-5 p-5 sm:p-6" onSubmit={(event) => { event.preventDefault(); void execute("mapping"); }}>
        <fieldset disabled={Boolean(busy) || uncertain} className="grid min-w-0 gap-x-6 gap-y-5 lg:grid-cols-2">{template.fields.map((field) => <div key={field.key} className="min-w-0"><label htmlFor={`mapping-${field.key}`} className="block text-sm font-medium">{field.label}{field.required ? " (obrigatório)" : ""}</label><select id={`mapping-${field.key}`} className="field-control mt-2 w-full min-w-0" value={mapping[field.key] ?? ""} required={field.required} aria-invalid={invalidField === field.key || undefined} aria-describedby={`help-${field.key}`} onChange={(event) => { const value = event.target.value; setMapping((previous) => { const next = { ...previous }; if (value) next[field.key] = value; else delete next[field.key]; return next; }); }}><option value="">Não associar</option>{(batch.headers as string[]).map((header) => <option key={header} value={header}>{header}</option>)}</select><p id={`help-${field.key}`} className="mt-1 break-words text-xs leading-5 text-slate">{field.help || "Campo opcional."}</p></div>)}</fieldset>
        <div className="border-t border-line pt-4"><h3 className="text-sm font-semibold">Colunas que serão ignoradas</h3><p className="mt-1 break-words text-sm text-slate">{ignored.length ? ignored.join(" · ") : "Todas as colunas estão associadas."}</p></div>
        {["FUNDING_PROGRAMS", "VENTURES"].includes(batch.type) ? <label className="block text-sm font-medium" htmlFor="import-mode">Registros já conhecidos<select id="import-mode" disabled={Boolean(busy) || uncertain} value={mode} className="field-control mt-2 w-full" onChange={(event) => setMode(event.target.value as Mode)} aria-describedby="mode-help"><option value="CREATE_ONLY">Criar somente novos registros</option><option value="UPSERT">Atualizar também os campos descritivos permitidos</option></select><span id="mode-help" className="mt-2 block text-xs font-normal leading-5 text-slate">A atualização exige o mesmo identificador na origem. Identidade, situação e vínculos não são substituídos. O estado anterior fica auditado.</span></label> : null}
        <button type="submit" disabled={Boolean(busy) || uncertain} className="button-secondary">{busy === "mapping" ? "Salvando…" : "Confirmar mapeamento"}</button>
      </form>
    </section> : null}
    {mutable ? <section className="flex flex-wrap items-start justify-between gap-4 border-y border-line py-5"><div><h2 className="font-semibold">2. Validar e conferir</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate">A validação verifica formatos, referências, duplicidades e regras do protocolo. Nenhum registro institucional é criado nesta etapa.</p>{dirty ? <p className="mt-2 text-sm text-slate">Confirme as alterações do mapeamento antes de validar.</p> : null}</div><button className="button-primary" disabled={Boolean(busy) || uncertain || dirty || !batch.mappingConfirmedAt} onClick={() => execute("validate")}>{busy === "validate" ? "Validando…" : "Validar dados"}</button></section> : null}

    <section aria-labelledby="preview-title"><div className="flex flex-wrap items-center justify-between gap-3"><h2 id="preview-title" className="text-lg font-semibold">Prévia das linhas</h2>{batch.invalidRows || batch.warningRows ? <a className="button-secondary" href={`${base}/errors`}><Download size={16} aria-hidden="true" />Baixar erros e avisos</a> : null}</div><p className="mt-1 text-sm leading-6 text-slate">A numeração corresponde à linha de origem do CSV. Valores vazios continuam ausentes; zero é um valor.</p>
      <nav aria-label="Filtrar linhas" className="my-4 flex flex-wrap gap-2">{(["ALL", "INVALID", "WARNINGS"] as const).map((filter) => <Link key={filter} href={pageHref(1, filter)} className={filter === detail.filter ? "button-primary" : "button-secondary"} aria-current={filter === detail.filter ? "page" : undefined}>{({ ALL: "Todas", INVALID: "Com impedimentos", WARNINGS: "Com avisos" })[filter]}</Link>)}</nav>
      <ul className="mb-4 divide-y divide-line border-y border-line">{detail.rows.map((row) => {
        const errors = row.errors as ImportIssue[]; const warnings = row.warnings as ImportIssue[];
        const raw = row.rawData as Record<string, string>; const mapped = Object.entries(batch.mapping as ImportMapping);
        const normalized = row.normalizedData as (Serialized<NormalizedImportRow> & { operation: "CREATE" | "UPDATE" }) | null;
        return <li key={row.id} className="py-4"><div className="flex flex-wrap items-center gap-3"><h3 className="text-sm font-semibold">Linha {row.rowNumber}</h3><StatusBadge label={({ PENDING: "A validar", VALID: "Válida", INVALID: "Com impedimentos", APPLIED: "Aplicada", SKIPPED: "Ignorada", ROLLED_BACK: "Revertida" })[row.status]} tone={row.status === "INVALID" ? "danger" : "neutral"} /></div>
          {errors.length ? <ul className="mt-3 space-y-2 text-sm text-danger">{errors.map((issue, index) => <li key={index}>{issue.field ? `${importFieldLabel(batch.type, issue.field)}: ` : ""}{importMessage(issue.code)}</li>)}</ul> : null}
          {warnings.length ? <ul className="mt-3 space-y-2 text-sm text-slate">{warnings.map((issue, index) => <li key={index}><span className="font-semibold">Aviso: </span>{issue.field ? `${importFieldLabel(batch.type, issue.field)}: ` : ""}{importMessage(issue.code)}</li>)}</ul> : null}
          {normalized ? <><p className="mt-3 text-sm font-medium">{normalized.operation === "UPDATE" ? "Atualizar registro identificado" : "Criar registro"} · Identificador na origem: <span className="break-all">{normalized.externalId}</span></p><dl className="mt-3 grid min-w-0 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-3">{Object.entries(normalized.data).map(([key, value]) => {
            const field = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
            const label = ({ public_listing_enabled: "Divulgação pública", applications_enabled: "Inscrições habilitadas" } as Record<string, string>)[field] ?? importFieldLabel(batch.type, field);
            return <div key={key} className="min-w-0"><dt className="text-xs text-slate">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{value === null || value === "" ? <span className="text-slate">Não informado</span> : typeof value === "boolean" ? value ? "Sim" : "Não" : String(value)}</dd></div>;
          })}</dl><p className="mt-2 text-xs text-slate">Valores após validação. Datas e horas terminadas em Z estão em UTC e representam o mesmo instante informado na origem.</p></> : <dl className="mt-3 grid min-w-0 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-3">{mapped.map(([field, header]) => <div key={field} className="min-w-0"><dt className="text-xs text-slate">{importFieldLabel(batch.type, field)}</dt><dd className="mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{raw[header] || <span className="text-slate">Não informado</span>}</dd></div>)}</dl>}
          <details className="mt-3"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Conferir linha original</summary><dl className="space-y-2 border-l border-line pl-3 text-xs">{Object.entries(raw).map(([header, value]) => <div key={header} className="min-w-0"><dt className="break-all font-semibold">{header}</dt><dd className="mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{value || "Não informado"}</dd></div>)}</dl></details>
        </li>;
      })}</ul>
      {!detail.rows.length ? <p className="py-5 text-sm text-slate">Nenhuma linha nesta página com o filtro selecionado.</p> : null}
      <ImportPagination page={detail.page} hasNext={detail.hasNext} href={pageHref} />
    </section>

    {batch.status === "READY" ? <section className="border-y border-line py-5"><h2 className="font-semibold">3. Aplicar o lote</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate">Revise todas as páginas e avisos. A aplicação grava o lote completo em uma única operação. Referências alteradas desde a validação exigem uma nova conferência.</p><button className="button-primary mt-4" disabled={Boolean(busy) || uncertain || dirty} onClick={() => { setConfirmed(false); setConfirmation("apply"); }}><Check size={16} aria-hidden="true" />Revisar confirmação de aplicação</button></section> : null}

    <details className="border-y border-line py-1"><summary className="min-h-11 cursor-pointer py-3 font-semibold">Origem e auditoria do lote</summary><dl className="grid gap-4 py-4 text-sm sm:grid-cols-2"><div><dt className="text-slate">Carregado por</dt><dd className="mt-1">{actorName(batch.createdByUserId)} · {importDate(batch.createdAt)}</dd></div><div><dt className="text-slate">Aplicado por</dt><dd className="mt-1">{actorName(batch.appliedByUserId)} · {importDate(batch.appliedAt)}</dd></div><div><dt className="text-slate">Revertido por</dt><dd className="mt-1">{actorName(batch.rolledBackByUserId)} · {importDate(batch.rolledBackAt)}</dd></div><div><dt className="text-slate">Versão do modelo e revisão do lote</dt><dd className="mt-1">{batch.schemaVersion} · {batch.revision}</dd></div><div className="min-w-0 sm:col-span-2"><dt className="text-slate">Impressão digital do arquivo (SHA-256)</dt><dd className="mt-1 break-all font-mono text-xs">{batch.sourceDigest}</dd></div></dl><p className="pb-4 text-xs text-slate">Datas de auditoria no horário de Fortaleza. As datas das evidências permanecem aquelas informadas na origem.</p>
      {audit.items.length ? <><ul className="divide-y divide-line">{audit.items.map((change) => <li key={change.id} className="py-3 text-sm"><p>{change.operation === "CREATE" ? "Criação" : "Atualização"} · {IMPORT_TEMPLATES[change.entityType].label}{change.rolledBackAt ? " · Revertida" : ""}</p><p className="mt-1 break-all text-xs text-slate">Registro: {change.entityId} · {importDate(change.createdAt)}</p></li>)}</ul><ImportPagination page={audit.page} hasNext={audit.hasNext} href={(page) => `/app/imports/${batch.id}?${new URLSearchParams({ page: String(detail.page), filter: detail.filter, auditPage: String(page) })}`} /></> : <p className="pb-4 text-sm text-slate">Nenhuma alteração institucional realizada por este lote.</p>}
    </details>

    {batch.status === "APPLIED" ? <section aria-labelledby="rollback-title"><h2 id="rollback-title" className="font-semibold">Reversão protegida</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate">A reversão exige que todos os registros permaneçam como foram importados e não tenham dependências posteriores. Alterações manuais, outros lotes e relatórios preservados podem impedir a operação.</p><button className="button-secondary mt-4" disabled={Boolean(busy) || uncertain} onClick={() => loadRollback()}>Conferir possibilidade de reversão</button>
      {rollback ? <div className="mt-5 space-y-4"><p className="text-sm font-semibold">{rollback.totalChanges} alteração(ões) · {rollback.blockedCount} impedimento(s)</p>{rollback.reasons.length ? <ul className="space-y-2 text-sm text-danger">{rollback.reasons.map((reason) => <li key={reason}>{importMessage(reason)}</li>)}</ul> : null}<ul className="divide-y divide-line">{rollback.items.map((item) => <li key={item.id} className="py-3 text-sm"><span>{item.operation === "CREATE" ? "Excluir registro criado" : "Restaurar estado anterior"} · {IMPORT_TEMPLATES[item.entityType].label} · {item.safe ? "Sem impedimento identificado" : "Reversão impedida"}</span><span className="mt-1 block break-all text-xs text-slate">{item.entityId}</span></li>)}</ul><div className="flex flex-wrap items-center gap-3"><span className="text-sm text-slate">Página {rollback.page}</span>{rollback.page > 1 ? <button className="button-secondary" disabled={Boolean(busy)} onClick={() => loadRollback(rollback.page - 1)}>Anterior</button> : null}{rollback.hasNext ? <button className="button-secondary" disabled={Boolean(busy)} onClick={() => loadRollback(rollback.page + 1)}>Próxima</button> : null}</div>{rollback.canRollback ? <button className="button-secondary" disabled={Boolean(busy) || uncertain || rollback.revision !== batch.revision} onClick={() => { setConfirmed(false); setConfirmation("rollback"); }}>Revisar confirmação de reversão</button> : <p className="text-sm text-slate">Nenhum registro será revertido enquanto houver impedimentos. Consulte as dependências; o histórico não será apagado.</p>}</div> : null}
    </section> : null}

    <Dialog open={Boolean(confirmation)} onClose={() => { if (!busy) { setConfirmation(null); setConfirmed(false); } }} title={confirmation === "rollback" ? "Reverter este lote?" : "Aplicar este lote?"} description={confirmation === "rollback" ? "A reversão afeta todas as alterações deste lote e preserva sua auditoria. As dependências serão verificadas novamente." : "O lote será aplicado por inteiro. Esta confirmação altera os registros institucionais."}>
      <p className="break-words text-sm">{template.label} · {batch.totalRows} linha(s) · Origem: {batch.namespace}</p>
      <label className="mt-5 flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={confirmed} disabled={Boolean(busy)} onChange={(event) => setConfirmed(event.target.checked)} />{confirmation === "rollback" ? "Conferi a prévia e confirmo a reversão de todas as alterações deste lote." : "Conferi as linhas e os avisos e confirmo a aplicação deste lote."}</label>
      <div className="mt-6 flex flex-wrap gap-3"><button className="button-secondary" disabled={Boolean(busy)} onClick={() => setConfirmation(null)}>Cancelar</button><button className="button-primary" disabled={!confirmed || Boolean(busy)} onClick={() => confirmation && execute(confirmation)}>{busy ? "Processando…" : confirmation === "rollback" ? "Confirmar reversão" : "Confirmar aplicação"}</button></div><p role="status" className="mt-3 text-sm text-slate">{busy ? "Aguarde. Consultaremos o estado gravado ao concluir." : ""}</p>
    </Dialog>
  </div>;
}
