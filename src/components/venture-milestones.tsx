"use client";

import { Plus, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Dialog } from "@/components/dialog";
import { Panel, PanelHeader } from "@/components/ui";
import { milestoneLabels } from "@/lib/milestones/labels";
import type { MilestoneDto } from "@/lib/milestones/service";
import { formatMonitoringDate } from "@/lib/monitoring/format";

export function VentureMilestones({ organizationId, ventureId, milestones, canManage }: { organizationId: string; ventureId: string; milestones: MilestoneDto[]; canManage: boolean }) {
  const [editing, setEditing] = useState<MilestoneDto | null>(null);
  const [open, setOpen] = useState(false);
  return <Panel>
    <PanelHeader title="Marcos da trajetória" description="Acontecimentos registrados pela instituição, independentes das ondas de acompanhamento." action={canManage ? <button type="button" className="button-secondary" onClick={() => { setEditing(null); setOpen(true); }}><Plus size={16} aria-hidden="true" /> Novo marco</button> : undefined} />
    {milestones.length ? <ol className="divide-y divide-line">{milestones.map((milestone) => <li key={milestone.id} className="flex items-start gap-4 px-6 py-5">
      <div className="min-w-0 flex-1"><p className="text-xs font-medium text-slate">{formatMonitoringDate(milestone.occurredAt)} · {milestoneLabels[milestone.type]}</p><h3 className="mt-2 break-words font-semibold text-ink">{milestone.title}</h3>{milestone.description ? <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate">{milestone.description}</p> : null}</div>
      {canManage ? <button type="button" className="button-tertiary min-h-11 shrink-0 px-3" aria-label={`Editar marco ${milestone.title}`} onClick={() => { setEditing(milestone); setOpen(true); }}><Pencil size={16} aria-hidden="true" /></button> : null}
    </li>)}</ol> : <p className="px-6 pb-6 text-sm leading-6 text-slate">Nenhum marco registrado. {canManage ? "Registre acontecimentos como o lançamento do MVP, o primeiro cliente ou uma formalização." : "Os marcos cadastrados pela instituição aparecerão aqui."}</p>}
    <Dialog open={open} onClose={() => setOpen(false)} title={editing ? "Editar marco" : "Novo marco"} description="Informe o acontecimento e a data em que ocorreu."><MilestoneForm key={editing?.id ?? "new"} organizationId={organizationId} ventureId={ventureId} milestone={editing} onSuccess={() => setOpen(false)} /></Dialog>
  </Panel>;
}

function MilestoneForm({ organizationId, ventureId, milestone, onSuccess }: { organizationId: string; ventureId: string; milestone: MilestoneDto | null; onSuccess: () => void }) {
  const router = useRouter();
  const [type, setType] = useState<keyof typeof milestoneLabels>(milestone?.type ?? "MVP_LAUNCHED");
  const [title, setTitle] = useState(milestone?.title ?? "");
  const [description, setDescription] = useState(milestone?.description ?? "");
  const [occurredAt, setOccurredAt] = useState(milestone?.occurredAt.slice(0, 10) ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(null);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/ventures/${ventureId}/milestones${milestone ? `/${milestone.id}` : ""}`, {
        method: milestone ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, title, description: description || null, occurredAt: new Date(`${occurredAt}T00:00:00.000Z`).toISOString() }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) { setError(payload.error ?? "Não foi possível salvar o marco."); return; }
      onSuccess(); router.refresh();
    } catch { setError("Não foi possível conectar ao servidor. Tente novamente."); }
    finally { setPending(false); }
  }

  return <form className="space-y-5" onSubmit={submit}>
    <label className="block space-y-2 text-sm font-medium text-ink"><span>Tipo de marco</span><select className="field-control" value={type} onChange={(event) => setType(event.target.value as keyof typeof milestoneLabels)}>{Object.entries(milestoneLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label className="block space-y-2 text-sm font-medium text-ink"><span>Título</span><input className="field-control" value={title} onChange={(event) => setTitle(event.target.value)} required minLength={2} maxLength={160} /></label>
    <label className="block space-y-2 text-sm font-medium text-ink"><span>Data do acontecimento</span><input className="field-control" type="date" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} required /></label>
    <label className="block space-y-2 text-sm font-medium text-ink"><span>Descrição <span className="font-normal text-slate">(opcional)</span></span><textarea className="field-control min-h-28" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={3000} /></label>
    {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    <button disabled={pending} className="button-primary w-full">{pending ? "Salvando…" : milestone ? "Salvar alterações" : "Registrar marco"}</button>
  </form>;
}
