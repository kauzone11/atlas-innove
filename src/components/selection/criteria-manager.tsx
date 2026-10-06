"use client";

import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, LockKeyhole, Pencil, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Dialog } from "@/components/dialog";
import { Panel, PanelHeader } from "@/components/ui";
import { selectionRequest } from "@/components/selection/request";
import type { SelectionCriterion } from "@/components/selection/types";

export function CriteriaManager({ criteria, apiBase, frozen, canManage, editable }: { criteria: SelectionCriterion[]; apiBase: string; frozen: boolean; canManage: boolean; editable: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<SelectionCriterion | null>(null);
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<SelectionCriterion | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [weight, setWeight] = useState("1");
  const [maxScore, setMaxScore] = useState("10");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mutable = canManage && editable && !frozen;
  const totalWeight = criteria.reduce((sum, criterion) => sum + Number(criterion.weight), 0);

  function openEditor(criterion: SelectionCriterion | null) {
    setEditing(criterion); setName(criterion?.name ?? ""); setDescription(criterion?.description ?? ""); setWeight(criterion?.weight ?? "1"); setMaxScore(criterion?.maxScore ?? "10"); setError(null); setOpen(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(null); setNotice(null);
    try {
      await selectionRequest(`${apiBase}/criteria${editing ? `/${editing.id}` : ""}`, editing ? "PUT" : "POST", { name, description: description.trim() || null, weight, maxScore, position: editing?.position ?? (criteria.length ? Math.max(...criteria.map((criterion) => criterion.position)) + 1 : 0) });
      setOpen(false); setNotice(editing ? "Critério atualizado." : "Critério adicionado."); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar o critério."); }
    finally { setPending(false); }
  }

  async function move(index: number, direction: number) {
    const ids = criteria.map((criterion) => criterion.id);
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    setPending(true); setError(null); setNotice(null);
    try { await selectionRequest(`${apiBase}/criteria/reorder`, "POST", { criterionIds: ids }); setNotice("Ordem dos critérios atualizada."); router.refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível reordenar os critérios."); }
    finally { setPending(false); }
  }

  async function remove() {
    if (!removing) return;
    setPending(true); setError(null); setNotice(null);
    try { await selectionRequest(`${apiBase}/criteria/${removing.id}`, "DELETE"); setRemoving(null); setNotice("Critério removido."); router.refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível remover o critério."); }
    finally { setPending(false); }
  }

  return <Panel>
    <PanelHeader title="Plano de avaliação" description="Cada nota é normalizada pelo máximo do critério. Os pesos definem sua contribuição na nota de 0 a 100." action={mutable ? <button type="button" className="button-secondary" disabled={pending} onClick={() => openEditor(null)}><Plus size={16} aria-hidden="true" />Adicionar critério</button> : undefined} />
    <div className="flex flex-col gap-2 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><p className="text-sm text-slate">{criteria.length} {criteria.length === 1 ? "critério" : "critérios"} · peso total <span className="font-medium tabular-nums text-ink">{new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(totalWeight)}</span></p>{frozen ? <p className="flex items-center gap-2 text-sm text-slate"><LockKeyhole size={16} aria-hidden="true" />Plano preservado após o início das avaliações</p> : <p className="text-xs text-slate">O plano será congelado quando a avaliação começar.</p>}</div>
    {criteria.length ? <ol className="divide-y divide-line">{criteria.map((criterion, index) => <li key={criterion.id} className="flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6"><div className="min-w-0"><h3 className="break-words font-medium text-ink"><span className="mr-2 text-sm tabular-nums text-slate">{index + 1}.</span>{criterion.name}</h3>{criterion.description ? <p className="mt-2 max-w-2xl whitespace-pre-wrap break-words text-sm leading-6 text-slate">{criterion.description}</p> : null}<p className="mt-2 text-xs text-slate">Peso {criterion.weight} · nota máxima {criterion.maxScore} · contribuição {totalWeight > 0 ? new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(Number(criterion.weight) / totalWeight * 100) : "0"}%</p></div>{mutable ? <div className="flex shrink-0 flex-wrap gap-2"><button type="button" className="button-secondary px-3" aria-label={`Mover ${criterion.name} para cima`} disabled={pending || index === 0} onClick={() => void move(index, -1)}><ArrowUp size={16} aria-hidden="true" /></button><button type="button" className="button-secondary px-3" aria-label={`Mover ${criterion.name} para baixo`} disabled={pending || index === criteria.length - 1} onClick={() => void move(index, 1)}><ArrowDown size={16} aria-hidden="true" /></button><button type="button" className="button-secondary px-3" aria-label={`Editar ${criterion.name}`} disabled={pending} onClick={() => openEditor(criterion)}><Pencil size={16} aria-hidden="true" /></button><button type="button" className="button-secondary px-3 text-danger" aria-label={`Remover ${criterion.name}`} disabled={pending} onClick={() => { setError(null); setRemoving(criterion); }}><Trash2 size={16} aria-hidden="true" /></button></div> : null}</li>)}</ol> : <div className="px-4 py-8 sm:px-6"><h3 className="font-medium text-ink">Defina os critérios deste edital</h3><p className="mt-2 max-w-xl text-sm leading-6 text-slate">O plano orienta o preenchimento de todas as avaliações e a classificação. {canManage ? "Adicione pelo menos um critério antes de iniciar a avaliação." : "Um gestor precisa configurar o plano antes das avaliações."}</p></div>}
    {notice ? <p role="status" className="border-t border-line px-4 py-4 text-sm text-success sm:px-6">{notice}</p> : null}{error && !open && !removing ? <p role="alert" className="border-t border-line px-4 py-4 text-sm text-danger sm:px-6">{error}</p> : null}
    <Dialog open={open} onClose={() => { if (!pending) setOpen(false); }} title={editing ? "Editar critério" : "Adicionar critério"} description="O critério será usado em todas as candidaturas deste edital."><form onSubmit={save} className="space-y-5"><label className="block space-y-2 text-sm font-medium"><span>Nome do critério</span><input className="field-control" required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} disabled={pending} /></label><label className="block space-y-2 text-sm font-medium"><span>Orientação para o avaliador (opcional)</span><textarea className="field-control min-h-24" maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} disabled={pending} /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-2 text-sm font-medium"><span>Peso</span><input className="field-control" type="number" required min="0.0001" step="0.0001" inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} disabled={pending} /></label><label className="block space-y-2 text-sm font-medium"><span>Nota máxima</span><input className="field-control" type="number" required min="0.0001" step="0.0001" inputMode="decimal" value={maxScore} onChange={(event) => setMaxScore(event.target.value)} disabled={pending} /></label></div>{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}<button className="button-primary w-full" disabled={pending}>{pending ? "Salvando…" : "Salvar critério"}</button></form></Dialog>
    <Dialog open={Boolean(removing)} onClose={() => { if (!pending) setRemoving(null); }} title="Remover critério" description="O plano de avaliação será alterado."><div className="space-y-5"><p className="break-words text-sm leading-6 text-slate">Remover “{removing?.name}”? A contribuição dos critérios restantes será recalculada proporcionalmente aos seus pesos.</p>{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" className="button-secondary" disabled={pending} onClick={() => setRemoving(null)}>Manter critério</button><button type="button" className="button-danger" disabled={pending} onClick={() => void remove()}>{pending ? "Removendo…" : "Remover critério"}</button></div></div></Dialog>
  </Panel>;
}
