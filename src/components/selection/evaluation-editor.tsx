"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LockKeyhole, Save, Send } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Dialog } from "@/components/dialog";
import { Panel, PanelHeader, StatusBadge } from "@/components/ui";
import { selectionRequest } from "@/components/selection/request";
import { auditDateLabel, scoreLabel, type SelectionCriterion, type SelectionEvaluation } from "@/components/selection/types";

export function EvaluationEditor({ criteria, evaluation, apiUrl, pageHref, canEvaluate, phaseEligible }: { criteria: SelectionCriterion[]; evaluation: SelectionEvaluation | null; apiUrl: string; pageHref: string; canEvaluate: boolean; phaseEligible: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState(evaluation);
  const [scores, setScores] = useState<Record<string, string>>(() => Object.fromEntries(evaluation?.scores.map((item) => [item.criterionId, item.score]) ?? []));
  const [comments, setComments] = useState<Record<string, string>>(() => Object.fromEntries(evaluation?.scores.map((item) => [item.criterionId, item.comment ?? ""]) ?? []));
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const editable = canEvaluate && phaseEligible && current?.status !== "SUBMITTED";
  const completed = criteria.filter((criterion) => scores[criterion.id]?.trim()).length;
  const valid = criteria.every((criterion) => scores[criterion.id]?.trim() && Number.isFinite(Number(scores[criterion.id])) && Number(scores[criterion.id]) >= 0 && Number(scores[criterion.id]) <= Number(criterion.maxScore));
  const totalWeight = criteria.reduce((sum, criterion) => sum + Number(criterion.weight), 0);
  const preview = valid && totalWeight > 0 ? criteria.reduce((sum, criterion) => sum + Number(scores[criterion.id]) / Number(criterion.maxScore) * Number(criterion.weight), 0) / totalWeight * 100 : null;
  const changed = criteria.some((criterion) => (scores[criterion.id] ?? "") !== (current?.scores.find((score) => score.criterionId === criterion.id)?.score ?? "") || (comments[criterion.id] ?? "") !== (current?.scores.find((score) => score.criterionId === criterion.id)?.comment ?? ""));

  async function save(submit: boolean) {
    const commentWithoutScore = criteria.find((criterion) => comments[criterion.id]?.trim() && !scores[criterion.id]?.trim());
    if (commentWithoutScore) {
      setError(`Informe a nota de “${commentWithoutScore.name}” para salvar seu comentário. O texto permanece nesta página.`);
      setConfirm(false);
      document.getElementById(`score-${commentWithoutScore.id}`)?.focus();
      return;
    }
    setPending(true); setError(null); setNotice(null);
    try {
      const payload = await selectionRequest<{ evaluation: SelectionEvaluation }>(apiUrl, "POST", { revision: current?.revision ?? 0, scores: criteria.filter((criterion) => scores[criterion.id]?.trim()).map((criterion) => ({ criterionId: criterion.id, score: scores[criterion.id], comment: comments[criterion.id]?.trim() || null })), submit });
      setCurrent(payload.evaluation); setScores(Object.fromEntries(payload.evaluation.scores.map((score) => [score.criterionId, score.score]))); setComments(Object.fromEntries(payload.evaluation.scores.map((score) => [score.criterionId, score.comment ?? ""]))); setConfirm(false); setNotice(submit ? "Avaliação enviada e preservada. Ela agora compõe a nota agregada." : "Rascunho salvo. Ele ainda não compõe a nota agregada."); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar a avaliação."); if (reason instanceof Error && "code" in reason && String(reason.code).includes("REVISION")) setConflict(true); setConfirm(false); }
    finally { setPending(false); }
  }

  function submitDraft(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void save(false); }

  return <Panel className="scroll-mt-6">
    <div id="evaluation"><PanelHeader title="Minha avaliação" description="Avalie o conteúdo enviado nesta candidatura segundo o plano do edital." action={<StatusBadge label={current?.status === "SUBMITTED" ? "Enviada" : "Rascunho"} tone={current?.status === "SUBMITTED" ? "success" : "neutral"} />} /></div>
    <div className="px-4 py-5 sm:px-6">
      {current?.status === "SUBMITTED" ? <p className="mb-5 flex items-start gap-2 text-sm leading-6 text-slate"><LockKeyhole size={17} className="mt-1 shrink-0" aria-hidden="true" />Avaliação enviada em {auditDateLabel(current.submittedAt)} (horário de Brasília). As notas e os comentários foram preservados.</p> : !canEvaluate ? <p className="mb-5 text-sm leading-6 text-slate">Analistas e gestores podem avaliar candidaturas. Seu acesso permite consultar o contexto da seleção.</p> : !phaseEligible ? <p className="mb-5 text-sm leading-6 text-slate">O preenchimento fica disponível durante a fase de avaliação do edital, para candidaturas vigentes.</p> : <p className="mb-5 text-sm leading-6 text-slate">Informe todas as notas antes do envio. Uma nota vazia permanece ausente; use 0 somente quando essa for a nota atribuída.</p>}
      {criteria.length ? <form onSubmit={submitDraft} className="space-y-5"><div className="divide-y divide-line">{criteria.map((criterion) => <fieldset key={criterion.id} className="grid min-w-0 gap-4 py-5 first:pt-0 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,22rem)]"><legend className="sr-only">{criterion.name}</legend><div><label htmlFor={`score-${criterion.id}`} className="break-words font-medium text-ink">{criterion.name}</label>{criterion.description ? <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate">{criterion.description}</p> : null}<p id={`score-help-${criterion.id}`} className="mt-2 text-xs text-slate">Nota de 0 a {criterion.maxScore} · peso {criterion.weight}</p></div><div className="space-y-3">{editable ? <input id={`score-${criterion.id}`} className="field-control" type="number" min="0" max={criterion.maxScore} step="0.0001" inputMode="decimal" placeholder="Nota não informada" value={scores[criterion.id] ?? ""} onChange={(event) => { setScores((values) => ({ ...values, [criterion.id]: event.target.value })); setNotice(null); }} disabled={pending || conflict} aria-describedby={`score-help-${criterion.id}`} /> : <p className="min-h-11 py-2 text-sm tabular-nums">{scores[criterion.id]?.trim() ? `${scores[criterion.id]} / ${criterion.maxScore}` : "Não informada"}</p>}<label className="block space-y-2 text-xs font-medium text-slate" htmlFor={`comment-${criterion.id}`}><span>Comentário interno (opcional)</span>{editable ? <textarea id={`comment-${criterion.id}`} className="field-control min-h-24" maxLength={3000} value={comments[criterion.id] ?? ""} onChange={(event) => { setComments((values) => ({ ...values, [criterion.id]: event.target.value })); setNotice(null); }} disabled={pending || conflict} /> : <p className="whitespace-pre-wrap break-words text-sm font-normal leading-6">{comments[criterion.id]?.trim() || "Sem comentário"}</p>}</label></div></fieldset>)}</div><div className="border-t border-line pt-5"><div className="flex flex-col gap-2 sm:flex-row sm:justify-between"><p className="text-sm text-slate" role="status">{completed} de {criteria.length} critérios preenchidos</p><p className="text-sm">{preview === null ? "Prévia disponível após preencher todas as notas" : <>Prévia ponderada <strong className="tabular-nums">{scoreLabel(preview)} / 100</strong></>}</p></div><p className="mt-2 text-xs leading-5 text-slate">Prévia para conferência. A nota oficial é calculada no servidor: soma de (nota ÷ máximo × peso), dividida pelo peso total, × 100.</p>{notice ? <p role="status" className="mt-4 text-sm text-success">{notice}</p> : null}{error ? <p role="alert" className="mt-4 text-sm text-danger">{error}</p> : null}{conflict ? <div className="mt-4 space-y-3"><p className="text-sm leading-6 text-slate">Este rascunho mudou em outra sessão. O preenchimento desta página foi preservado. Compare a versão atual antes de continuar.</p><Link className="button-secondary" target="_blank" rel="noopener noreferrer" href={`${pageHref}#evaluation`}>Consultar versão atual em outra aba</Link><button type="button" className="button-secondary ml-0 sm:ml-3" onClick={() => { if (window.confirm("Recarregar a página? Copie as notas ainda não salvas antes de continuar.")) window.location.reload(); }}>Recarregar versão atual</button></div> : null}{editable && changed ? <p className="mt-4 text-xs text-slate">Alterações ainda não salvas.</p> : null}{editable ? <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-between"><button className="button-secondary" disabled={pending || conflict}><Save size={16} aria-hidden="true" />{pending ? "Salvando…" : "Salvar rascunho"}</button><button type="button" className="button-primary" disabled={pending || conflict || !valid} onClick={() => setConfirm(true)}><Send size={16} aria-hidden="true" />Enviar avaliação</button></div> : null}</div></form> : <p className="text-sm leading-6 text-slate">O gestor precisa configurar os critérios para este edital antes de iniciar uma avaliação.</p>}
    </div>
    <Dialog open={confirm} onClose={() => { if (!pending) setConfirm(false); }} title="Enviar avaliação" description="As notas e os comentários enviados não poderão ser editados."><div className="space-y-5"><p className="text-sm leading-6 text-slate">{completed} critérios preenchidos. Prévia ponderada: <strong className="tabular-nums text-ink">{scoreLabel(preview)} / 100</strong>. Esta avaliação passará a compor a nota agregada da candidatura.</p><div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" className="button-secondary" disabled={pending} onClick={() => setConfirm(false)}>Revisar notas</button><button type="button" className="button-primary" disabled={pending || !valid} onClick={() => void save(true)}>{pending ? "Enviando…" : "Confirmar envio"}</button></div></div></Dialog>
  </Panel>;
}
