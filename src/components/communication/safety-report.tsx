"use client";

import { useState, type FormEvent } from "react";
import { Flag } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { personalRequest } from "@/components/personal/record-form";
import { safetyReasonLabels } from "@/lib/communication/presentation";

export function ReportContact({ reportedUserId, conversationId, messageId }: { reportedUserId: string; conversationId?: string; messageId?: string }) {
  const [open, setOpen] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null); const [sent, setSent] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setPending(true); setError(null);
    try { await personalRequest("/api/network/safety-reports", "POST", { reportedUserId, ...(conversationId ? { conversationId } : {}), ...(messageId ? { messageId } : {}), reason: data.get("reason"), details: String(data.get("details") ?? "") }); setSent(true); setOpen(false); }
    catch (error) { setError(error instanceof Error ? error.message : "Não foi possível enviar a denúncia."); }
    finally { setPending(false); }
  }
  return <div><button type="button" className="button-tertiary" disabled={sent} onClick={() => setOpen(true)}><Flag size={14} aria-hidden="true" />{sent ? "Denúncia enviada" : "Denunciar"}</button>{sent ? <p className="text-xs leading-6 text-slate" role="status">Recebemos sua denúncia para análise da plataforma.</p> : null}<Dialog open={open} onClose={() => { if (!pending) setOpen(false); }} title={messageId ? "Denunciar mensagem" : "Denunciar contato"} description="A denúncia é encaminhada à equipe da plataforma. A pessoa denunciada não recebe sua identidade por este fluxo."><form onSubmit={submit} className="space-y-4"><label className="block space-y-2 text-sm font-medium"><span>Motivo</span><select name="reason" className="field-control" required>{Object.entries(safetyReasonLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="block space-y-2 text-sm font-medium"><span>Detalhes (opcional)</span><textarea name="details" className="field-control" rows={4} maxLength={2000} /></label>{error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}<button className="button-primary w-full" disabled={pending}>{pending ? "Enviando…" : "Enviar denúncia"}</button></form></Dialog></div>;
}
