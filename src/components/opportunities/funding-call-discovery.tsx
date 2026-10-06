"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Globe2 } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { DiscoveryFields, readDiscoveryForm } from "@/components/opportunities/discovery-fields";
import type { FundingCallDto } from "@/lib/funding-calls/service";
export function FundingCallDiscoveryAction({ organizationId, call }: { organizationId: string; call: FundingCallDto }) {
  const [open, setOpen] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null); const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const input = readDiscoveryForm(new FormData(event.currentTarget)); setPending(true); setError(null);
    try { const response = await fetch(`/api/organizations/${organizationId}/programs/${call.fundingProgramId}/calls/${call.id}/discovery`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); const payload = await response.json() as { error?: string; issues?: Record<string, string[]> }; if (!response.ok) { setError(Object.values(payload.issues ?? {}).flat().join(" ") || payload.error || "Não foi possível salvar a publicação."); return; } setOpen(false); router.refresh(); }
    catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }
  return <><button type="button" className="button-secondary" onClick={() => { setError(null); setOpen(true); }}><Globe2 size={16} aria-hidden="true" />Descoberta e publicação</button><Dialog open={open} onClose={() => { if (!pending) setOpen(false); }} mode="sheet" title="Descoberta e publicação" description="Estruture a chamada e escolha se ela será visível nas oportunidades públicas."><form onSubmit={submit} className="space-y-5">{call.status === "DRAFT" ? <p className="text-sm leading-6 text-slate">Rascunhos permanecem fora da descoberta até que o estado do edital seja atualizado.</p> : null}<DiscoveryFields values={call} />{error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}<button className="button-primary w-full" disabled={pending}>{pending ? "Salvando…" : "Salvar publicação"}</button></form></Dialog></>;
}
export function DocumentVisibilityAction({ organizationId, programId, callId, document }: { organizationId: string; programId: string; callId: string; document: FundingCallDto["documents"][number] }) {
  const [open, setOpen] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null); const router = useRouter();
  async function change(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget);
    setPending(true); setError(null);
    try { const response = await fetch(`/api/organizations/${organizationId}/programs/${programId}/calls/${callId}/documents/${document.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publicListingEnabled: !document.publicListingEnabled, publicationConfirmed: true, ...(document.publicListingEnabled ? {} : { publishedAt: values.get("publishedAt") || null }) }) }); const payload = await response.json() as { error?: string }; if (!response.ok) { setError(payload.error || "Não foi possível alterar a visibilidade."); return; } setOpen(false); router.refresh(); }
    catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }
  return <><button className="button-secondary" type="button" onClick={() => { setError(null); setOpen(true); }}>{document.publicListingEnabled ? "Retirar do público" : "Publicar documento"}</button><Dialog open={open} onClose={() => { if (!pending) setOpen(false); }} title={document.publicListingEnabled ? "Retirar documento do público" : "Publicar documento"} description={document.publicListingEnabled ? "O documento continuará preservado no espaço institucional." : "Qualquer pessoa que consultar o edital público poderá abrir este documento após a data de publicação."}><form className="space-y-4" onSubmit={change}><p className="break-words text-sm font-medium">{document.title}</p>{!document.publicListingEnabled ? <label className="block space-y-2 text-sm font-medium"><span>Data de publicação</span><input className="field-control" name="publishedAt" type="date" defaultValue={document.publishedAt?.slice(0, 10) ?? ""} required /></label> : null}{error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}<button className="button-primary" disabled={pending}>{pending ? "Salvando…" : "Confirmar"}</button></form></Dialog></>;
}
