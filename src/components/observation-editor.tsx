"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, LockKeyhole, Save, Send } from "lucide-react";

import { Dialog } from "@/components/dialog";
import { VENTURE_OBSERVATION_STATUS_LABELS, type VentureObservationStatus } from "@/lib/domain";
import type { ObservationWorkspaceDto } from "@/lib/observations/service";

export function ObservationEditor({ observation, canManage }: { observation: ObservationWorkspaceDto; canManage: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState(observation);
  const [values, setValues] = useState<Record<string, string>>(() => valueMap(observation));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmMissed, setConfirmMissed] = useState(false);
  const editable = canManage && current.readOnlyReason === null;
  const filledCount = current.indicators.filter((indicator) => values[indicator.id]?.trim()).length;
  const missingCount = current.indicators.length - filledCount;
  const savedValues = valueMap(current);
  const hasUnsavedChanges = current.indicators.some((indicator) => (values[indicator.id] ?? "") !== (savedValues[indicator.id] ?? ""));
  const canMarkMissed = canManage && ["PENDING", "IN_PROGRESS"].includes(current.status) && ["OPEN", "CLOSED"].includes(current.wave.status) && !["ENROLLMENT_NOT_ELIGIBLE", "PROTOCOL_MISSING"].includes(current.readOnlyReason ?? "");

  async function save(submit: boolean) {
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/organizations/${current.organizationId}/observations/${current.id}/values`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedRevision: current.revision, submit, values: current.indicators.map((indicator) => ({ indicatorDefinitionId: indicator.id, value: values[indicator.id]?.trim() || null })) }),
      });
      const payload = await response.json() as { error?: string; code?: string; observation?: ObservationWorkspaceDto };
      if (!response.ok || !payload.observation) {
        setConflict(payload.code === "OBSERVATION_REVISION_CONFLICT");
        setError(payload.error ?? "Não foi possível salvar a observação.");
        setConfirmSubmit(false);
        return;
      }
      setCurrent(payload.observation);
      setValues(valueMap(payload.observation));
      setConflict(false);
      setConfirmSubmit(false);
      setNotice(submit ? "Observação enviada. Os valores foram preservados nesta versão do protocolo." : "Rascunho salvo. Você pode continuar o preenchimento enquanto a onda estiver aberta.");
      router.refresh();
    } catch { setError("Não foi possível conectar ao servidor. O preenchimento permanece nesta página; verifique a versão atual antes de repetir o envio."); setConfirmSubmit(false); }
    finally { setPending(false); }
  }

  async function loadCurrent() {
    if (!window.confirm("Carregar a versão atual? O preenchimento ainda não salvo nesta página será substituído. Copie os valores que deseja preservar antes de continuar.")) return;
    setPending(true);
    try {
      const response = await fetch(`/api/organizations/${current.organizationId}/observations/${current.id}/values`, { cache: "no-store" });
      const payload = await response.json() as { observation?: ObservationWorkspaceDto; error?: string };
      if (!response.ok || !payload.observation) { setError(payload.error ?? "Não foi possível carregar a observação."); return; }
      setCurrent(payload.observation);
      setValues(valueMap(payload.observation));
      setConflict(false);
      setError(null);
      setNotice("Versão atual carregada.");
    } catch { setError("Não foi possível conectar ao servidor."); }
    finally { setPending(false); }
  }

  async function markMissed() {
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/organizations/${current.organizationId}/observations/${current.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "MISSED", expectedRevision: current.revision }) });
      const payload = await response.json() as { error?: string; code?: string; observation?: { revision: number } };
      if (!response.ok || !payload.observation) { setConflict(payload.code === "OBSERVATION_REVISION_CONFLICT"); setError(payload.error ?? "Não foi possível atualizar a observação."); return; }
      setCurrent((state) => ({ ...state, status: "MISSED", revision: payload.observation!.revision, readOnlyReason: "MISSED" }));
      setValues(valueMap(current));
      setNotice("Observação marcada como não respondida. O rascunho salvo foi preservado no histórico.");
      router.refresh();
    } catch { setError("Não foi possível conectar ao servidor."); }
    finally { setPending(false); setConfirmMissed(false); }
  }

  function submitDraft(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void save(false); }

  return <section className="panel">
    <div className="panel-header flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2>Valores da observação</h2><p>{current.protocol ? `${current.protocol.name} · versão ${current.protocol.version}${current.protocol.label ? ` · ${current.protocol.label}` : ""}` : "Esta coorte ainda não possui um protocolo aplicado."}</p></div><span className={`status-badge ${current.status === "SUBMITTED" ? "status-success" : "status-neutral"}`}>{VENTURE_OBSERVATION_STATUS_LABELS[current.status as VentureObservationStatus] ?? current.status}</span></div>
    <div className="px-5 py-5 sm:px-6">
      {current.readOnlyReason ? <p className="mb-5 flex items-start gap-2 text-sm leading-6 text-slate"><LockKeyhole size={17} className="mt-1 shrink-0" aria-hidden="true" />{readOnlyMessage(current)}</p> : !canManage ? <p className="mb-5 text-sm text-slate">Seu perfil permite consultar os dados. Gestores e administradores podem registrar observações.</p> : <p id="observation-value-help" className="mb-5 text-sm leading-6 text-slate">Deixe vazio quando não houver dado. Zero é um valor observado e deve ser informado como 0. O rascunho só será usado nos resultados após o envio.</p>}
      {current.indicators.length ? <form onSubmit={submitDraft} className="space-y-6">
        <div className="divide-y divide-line">{current.indicators.map((indicator) => <div key={indicator.id} className="grid gap-3 py-5 first:pt-0 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,1fr)] sm:items-start"><div><label htmlFor={`observation-${indicator.id}`} className="font-medium text-ink">{indicator.label}</label><p className="mt-1 text-sm text-slate">{indicator.valueType === "INTEGER" ? "Número inteiro" : indicator.valueType === "CURRENCY" ? "Valor monetário · até 2 casas decimais" : "Categoria"}{indicator.unit ? ` · ${indicator.unit}` : ""}</p></div>{editable ? indicator.valueType === "ENUM" ? <select id={`observation-${indicator.id}`} className="field-control" value={values[indicator.id] ?? ""} onChange={(event) => { setValues((state) => ({ ...state, [indicator.id]: event.target.value })); setNotice(null); }} disabled={pending} aria-describedby="observation-value-help"><option value="">Não informado</option>{indicator.allowedValues?.map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input id={`observation-${indicator.id}`} className="field-control" type="number" min="0" max={indicator.valueType === "INTEGER" ? "2147483647" : "999999999999.99"} step={indicator.valueType === "INTEGER" ? "1" : "0.01"} inputMode={indicator.valueType === "INTEGER" ? "numeric" : "decimal"} placeholder="Não informado" value={values[indicator.id] ?? ""} onChange={(event) => { setValues((state) => ({ ...state, [indicator.id]: event.target.value })); setNotice(null); }} disabled={pending} aria-describedby="observation-value-help" /> : <p id={`observation-${indicator.id}`} className={`min-h-11 py-2 text-sm ${values[indicator.id]?.trim() ? "font-medium tabular-nums text-ink" : "text-slate"}`}>{displayValue(values[indicator.id], indicator.valueType, indicator.unit)}</p>}</div>)}</div>
        <div className="border-t border-line pt-5">
          {notice ? <p role="status" className="mb-4 flex items-start gap-2 text-sm leading-6 text-success"><CheckCircle2 size={17} className="mt-1 shrink-0" aria-hidden="true" />{notice}</p> : null}
          {error ? <p role="alert" className="mb-4 text-sm leading-6 text-danger">{error}</p> : null}
          {conflict ? <div className="mb-4 flex flex-wrap gap-3"><button type="button" className="button-secondary" disabled={pending} onClick={() => void loadCurrent()}>Carregar versão atual</button><Link className="button-secondary" href={`/app/observations/${current.id}`} target="_blank" rel="noopener noreferrer">Comparar em outra aba</Link></div> : null}
          {editable && hasUnsavedChanges && !notice ? <p className="mb-4 text-xs text-slate" role="status">Alterações ainda não salvas. Salve o rascunho antes de sair desta página.</p> : null}
          {editable ? <div className="flex flex-col gap-3 sm:flex-row sm:justify-between"><button className="button-secondary" disabled={pending || conflict}><Save size={16} aria-hidden="true" />{pending ? "Salvando…" : "Salvar rascunho"}</button><button type="button" className="button-primary" disabled={pending || conflict || filledCount === 0} onClick={() => setConfirmSubmit(true)}><Send size={16} aria-hidden="true" />Enviar observação</button></div> : null}
          {canMarkMissed ? <button type="button" className="mt-4 text-sm font-medium text-slate underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" disabled={pending || conflict} onClick={() => setConfirmMissed(true)}>Marcar como não respondida</button> : null}
          {current.submittedAt ? <p className="mt-3 text-xs text-slate">Enviada em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(current.submittedAt))}.</p> : null}
        </div>
      </form> : <p className="text-sm leading-6 text-slate">Aplique um protocolo com indicadores antes da primeira onda. <Link href={`/app/programs/${current.cohort.fundingProgram.id}/cohorts/${current.cohort.id}`} className="font-medium text-accent hover:underline">Abrir coorte</Link>.</p>}
    </div>
    <Dialog open={confirmSubmit} onClose={() => { if (!pending) setConfirmSubmit(false); }} title="Enviar observação" description="O envio confirma este ponto da trajetória. Os valores enviados não poderão ser editados."><div className="space-y-5"><p className="text-sm leading-6 text-slate">{filledCount} de {current.indicators.length} indicador(es) informado(s). {missingCount ? `${missingCount} continuará(ão) como não informado(s), sem virar zero ou entrar nas médias.` : "Todos os indicadores foram preenchidos."}</p><div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" className="button-secondary" disabled={pending} onClick={() => setConfirmSubmit(false)}>Revisar preenchimento</button><button type="button" className="button-primary" disabled={pending} onClick={() => void save(true)}>{pending ? "Enviando…" : "Confirmar envio"}</button></div></div></Dialog>
    <Dialog open={confirmMissed} onClose={() => { if (!pending) setConfirmMissed(false); }} title="Marcar como não respondida" description="Esta observação sairá das pendências e continuará no histórico, sem contribuir para os resultados."><div className="space-y-5"><p className="text-sm leading-6 text-slate">O rascunho já salvo será preservado. Alterações ainda não salvas nesta página serão descartadas. Esta ação encerra o registro.</p><div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" className="button-secondary" disabled={pending} onClick={() => setConfirmMissed(false)}>Continuar preenchimento</button><button type="button" className="button-primary" disabled={pending} onClick={() => void markMissed()}>{pending ? "Salvando…" : "Confirmar não respondida"}</button></div></div></Dialog>
  </section>;
}

function valueMap(observation: ObservationWorkspaceDto): Record<string, string> { return Object.fromEntries(observation.values.map((value) => [value.indicatorDefinitionId, value.value ?? ""])); }

function readOnlyMessage(observation: ObservationWorkspaceDto): string {
  return ({ SUBMITTED: "Observação enviada e preservada para comparação histórica.", MISSED: "Esta observação foi encerrada como não respondida. O rascunho salvo permanece no histórico e não contribui para os resultados.", WAVE_NOT_OPEN: "O preenchimento fica disponível somente enquanto a onda está aberta.", ENROLLMENT_NOT_ELIGIBLE: "A participação não estava vigente na data de referência desta onda. O histórico foi preservado.", PROTOCOL_MISSING: "É necessário aplicar um protocolo com indicadores antes de iniciar a coleta." } as Record<string, string>)[observation.readOnlyReason ?? ""] ?? "";
}

function displayValue(value: string | undefined, type: string, unit: string | null): string {
  if (!value?.trim()) return "Não informado";
  if (type === "CURRENCY") return unit === "R$" || !unit ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value)) : `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))} ${unit}`;
  if (type === "INTEGER") return new Intl.NumberFormat("pt-BR").format(Number(value));
  return value;
}
