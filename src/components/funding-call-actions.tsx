"use client";

import { FilePlus2, Pencil, Plus } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Dialog } from "@/components/dialog";
import { CohortCreateForm, type CohortProtocolChoice } from "@/components/cohort-create-form";
import { FundingCallForm } from "@/components/funding-call-form";
import { FundingCallDiscoveryAction } from "@/components/opportunities/funding-call-discovery";
import { StatusBadge, statusTone } from "@/components/ui";
import type { FundingCallDto } from "@/lib/funding-calls/service";
import { fundingCallDocumentTypeLabels, fundingCallStatusLabels } from "@/lib/funding-calls/presentation";

export function FundingCallActions({ organizationId, call, protocols, canManage, canCreateCohort }: { organizationId: string; call: FundingCallDto; protocols: CohortProtocolChoice[]; canManage: boolean; canCreateCohort: boolean }) {
  const [editOpen, setEditOpen] = useState(false);
  const [editPending, setEditPending] = useState(false);
  const [cohortOpen, setCohortOpen] = useState(false);
  return <><StatusBadge label={fundingCallStatusLabels[call.status] ?? call.status} tone={statusTone(call.status)} />
    {canManage ? <FundingCallDiscoveryAction organizationId={organizationId} call={call} /> : null}
    {canManage && call.status !== "ARCHIVED" ? <><button type="button" className="button-secondary" onClick={() => setEditOpen(true)}><Pencil size={16} aria-hidden="true" /> Editar</button><Dialog open={editOpen} onClose={() => { if (!editPending) setEditOpen(false); }} mode="sheet" title="Editar edital" description="Atualize a chamada e preserve suas coortes e documentos."><FundingCallForm organizationId={organizationId} programId={call.fundingProgramId} call={call} onSuccess={() => setEditOpen(false)} onPendingChange={setEditPending} /></Dialog></> : null}
    {canManage && canCreateCohort && call.status !== "ARCHIVED" ? <><button type="button" className="button-primary" onClick={() => setCohortOpen(true)}><Plus size={16} aria-hidden="true" /> Nova coorte</button><Dialog open={cohortOpen} onClose={() => setCohortOpen(false)} mode="sheet" title="Nova coorte" description={`Grupo de acompanhamento vinculado ao edital ${call.callNumber}.`}><CohortCreateForm organizationId={organizationId} programId={call.fundingProgramId} fundingCalls={[call]} protocols={protocols} fixedFundingCallId={call.id} onSuccess={() => setCohortOpen(false)} /></Dialog></> : null}
  </>;
}

export function FundingCallDocumentAction({ organizationId, call, canManage }: { organizationId: string; call: FundingCallDto; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  if (!canManage || call.status === "ARCHIVED") return null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setPending(true); setError(null);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/programs/${call.fundingProgramId}/calls/${call.id}/documents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: values.get("title"), externalUrl: values.get("externalUrl"), type: values.get("type"), publishedAt: values.get("publishedAt") || null, publicListingEnabled: values.get("publicListingEnabled") === "on" }) });
      const payload = await response.json() as { error?: string; issues?: Record<string, string[]> };
      if (!response.ok) { setError(Object.values(payload.issues ?? {}).flat().join(" ") || payload.error || "Não foi possível adicionar o documento."); return; }
      setOpen(false); router.refresh();
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }
  return <><button type="button" className="button-secondary" onClick={() => { setError(null); setOpen(true); }}><FilePlus2 size={16} aria-hidden="true" /> Adicionar documento</button><Dialog open={open} onClose={() => { if (!pending) setOpen(false); }} title="Adicionar documento" description="Vincule uma publicação externa ao histórico do edital."><form onSubmit={submit} className="space-y-4">
    <label className="block space-y-2 text-sm font-medium text-ink"><span>Título</span><input name="title" required minLength={2} maxLength={200} className="field-control" /></label>
    <label className="block space-y-2 text-sm font-medium text-ink"><span>Tipo</span><select name="type" defaultValue="NOTICE" className="field-control">{Object.entries(fundingCallDocumentTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label className="block space-y-2 text-sm font-medium text-ink"><span>Link do documento</span><input name="externalUrl" type="url" required maxLength={2048} className="field-control" /></label>
    <label className="block space-y-2 text-sm font-medium text-ink"><span>Data da publicação (opcional)</span><input name="publishedAt" type="date" className="field-control" /></label>
    <label className="flex min-h-11 items-start gap-3 text-sm"><input name="publicListingEnabled" type="checkbox" className="mt-1 h-5 w-5 shrink-0" /><span>Disponibilizar este documento no edital público. Qualquer pessoa poderá abrir o link após a data de publicação.</span></label>
    {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}<button className="button-primary w-full" disabled={pending}>{pending ? "Salvando…" : "Adicionar documento"}</button>
  </form></Dialog></>;
}
