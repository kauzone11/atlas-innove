"use client";

import { useState, type FormEvent } from "react";
import { Dialog } from "@/components/dialog";
import { personalRequest } from "@/components/personal/record-form";
import { safetyReasonLabels } from "@/lib/communication/presentation";

export function SocialReport({ postId, commentId }: { postId?: string; commentId?: string }) {
  const [open, setOpen] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null); const [sent, setSent] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setPending(true); setError(null); const data = new FormData(event.currentTarget); try { await personalRequest("/api/personal/social/reports", "POST", { ...(commentId ? { commentId } : { postId }), reason: data.get("reason"), details: data.get("details") || null }); setSent(true); setOpen(false); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível enviar a denúncia."); } finally { setPending(false); } }
  return <><button type="button" className="button-tertiary" disabled={sent} onClick={() => setOpen(true)}>{sent ? "Denúncia enviada" : `Denunciar ${commentId ? "comentário" : "publicação"}`}</button>{sent ? <span role="status" className="sr-only">Denúncia encaminhada para análise.</span> : null}<Dialog open={open} title={`Denunciar ${commentId ? "comentário" : "publicação"}`} description="A equipe da plataforma recebe a denúncia. Sua identidade não é exibida à pessoa denunciada." onClose={() => { if (!pending) setOpen(false); }}><form noValidate className="space-y-4" onSubmit={submit}><label className="block space-y-2 text-sm"><span>Motivo</span><select name="reason" className="field-control" disabled={pending}>{Object.entries(safetyReasonLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="block space-y-2 text-sm"><span>Detalhes (opcional)</span><textarea name="details" className="field-control resize-none" rows={4} maxLength={2000} disabled={pending} /></label>{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}<button className="button-primary" disabled={pending} aria-busy={pending}>Enviar denúncia</button></form></Dialog></>;
}

