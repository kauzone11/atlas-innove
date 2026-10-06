"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/dialog";
import { selectionRequest } from "@/components/selection/request";
import { decisionLabels } from "@/components/selection/types";

export function DecisionAction({ apiBase, applicationIds, currentDecision = "SELECTED", currentNote = "", onSuccess }: { apiBase: string; applicationIds: string[]; currentDecision?: string; currentNote?: string; onSuccess?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState(currentDecision === "PENDING" ? "SELECTED" : currentDecision);
  const [note, setNote] = useState(currentNote);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function save() {
    setPending(true); setError(null); setNotice(null);
    try { await selectionRequest(`${apiBase}/decisions`, "POST", { applicationIds, decision, decisionNote: note.trim() || null }); setOpen(false); setNotice("Decisão registrada. A publicação do resultado continua sendo uma ação separada."); onSuccess?.(); router.refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível registrar a decisão."); }
    finally { setPending(false); }
  }

  return <div className="space-y-3"><button type="button" className="button-secondary w-full sm:w-auto" disabled={applicationIds.length === 0} onClick={() => { setError(null); setNotice(null); setDecision(currentDecision === "PENDING" ? "SELECTED" : currentDecision); setNote(currentNote); setOpen(true); }}>Registrar decisão{applicationIds.length > 1 ? ` · ${applicationIds.length}` : ""}</button>{notice ? <p role="status" className="text-sm leading-6 text-success">{notice}</p> : null}<Dialog open={open} onClose={() => { if (!pending) setOpen(false); }} title="Registrar decisão" description="A decisão é uma deliberação explícita da instituição, independente da posição na classificação."><div className="space-y-5"><p className="text-sm text-slate">Esta decisão será aplicada a {applicationIds.length} candidatura(s).</p><label className="block space-y-2 text-sm font-medium"><span>Decisão</span><select className="field-control" value={decision} onChange={(event) => setDecision(event.target.value)} disabled={pending}>{Object.entries(decisionLabels).filter(([value]) => value !== "PENDING").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="block space-y-2 text-sm font-medium"><span>Nota interna (opcional)</span><textarea className="field-control min-h-28" maxLength={3000} value={note} onChange={(event) => setNote(event.target.value)} disabled={pending} /><span className="block text-xs font-normal leading-5 text-slate">Esta nota fica restrita à instituição. O participante verá sua decisão após a publicação do resultado.</span></label>{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" className="button-secondary" disabled={pending} onClick={() => setOpen(false)}>Voltar</button><button type="button" className="button-primary" disabled={pending || applicationIds.length === 0} onClick={() => void save()}>{pending ? "Registrando…" : "Confirmar decisão"}</button></div></div></Dialog></div>;
}
