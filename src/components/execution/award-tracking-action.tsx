"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/dialog";
import { selectionRequest } from "@/components/selection/request";
import type { getCallEnrollmentPreview } from "@/lib/selection/service";

type Preview = Awaited<ReturnType<typeof getCallEnrollmentPreview>>;
type VentureKind = "PROJECT" | "COMPANY" | "INITIATIVE" | "OTHER";

export function AwardTrackingForm({ organizationId, awardId, cohorts }: {
  organizationId: string; awardId: string; cohorts: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [cohortId, setCohortId] = useState(cohorts[0]?.id ?? "");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [ventureId, setVentureId] = useState("");
  const [kind, setKind] = useState<VentureKind>("PROJECT");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const api = `/api/organizations/${organizationId}/awards/${awardId}/tracking`;
  async function prepare() {
    setPending(true); setError(""); setMessage("");
    try {
      const data = await selectionRequest<{ preview: Preview }>(`${api}?cohortId=${encodeURIComponent(cohortId)}`, "GET");
      setPreview(data.preview); setVentureId(data.preview.applications[0]?.venture?.id ?? "");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível preparar o ingresso."); }
    finally { setPending(false); }
  }
  async function confirm() {
    setPending(true); setError("");
    try {
      const result = await selectionRequest<{ historicalTrackingPreserved: boolean }>(api, "POST", { cohortId, mapping: { ventureId: ventureId || null, kind } });
      setPreview(null); setMessage(result.historicalTrackingPreserved ? "A candidatura já possui acompanhamento histórico. O ingresso anterior foi preservado, sem alterar sua origem." : "Ingresso registrado. A origem da candidatura e do apoio foi preservada."); router.refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível registrar o ingresso."); }
    finally { setPending(false); }
  }
  const application = preview?.applications[0];
  return <div className="space-y-3">
    {cohorts.length ? <div className="flex flex-wrap items-end gap-3"><label className="block min-w-0 flex-1 space-y-2 text-sm font-medium"><span>Coorte de destino</span><select className="field-control" value={cohortId} disabled={pending} onChange={(event) => setCohortId(event.target.value)}>{cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}</select></label><button className="button-secondary" type="button" disabled={pending || !cohortId} onClick={() => void prepare()}>{pending ? "Conferindo…" : "Preparar ingresso"}</button></div> : <p className="text-sm text-slate">Crie uma coorte deste edital quando a metodologia estiver definida.</p>}
    {message ? <p role="status" className="text-sm text-accent-hover">{message}</p> : null}
    {error && !preview ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    <Dialog open={Boolean(preview)} onClose={() => { if (!pending) setPreview(null); }} title="Conferir ingresso no acompanhamento" mode="sheet">
      <div className="space-y-4"><p className="text-sm text-slate">{application?.projectNameSnapshot} · {preview?.cohort.name}</p>
        {application?.enrollmentId ? <p className="text-sm">Esta candidatura já possui ingresso. O vínculo histórico será preservado.</p> : application?.venture ? <p className="text-sm">Reutilizar entidade: <strong>{application.venture.name}</strong>{application.venture.archivedAt ? " · arquivada, ingresso indisponível" : ""}</p> : <><label className="block space-y-2 text-sm font-medium"><span>Entidade acompanhada</span><select className="field-control" value={ventureId} disabled={pending} onChange={(event) => setVentureId(event.target.value)}><option value="">Criar a partir do projeto selecionado</option>{preview?.availableVentures.filter((venture) => application && venture.eligibleApplicationIds.includes(application.id)).map((venture) => <option key={venture.id} value={venture.id}>{venture.name}</option>)}</select></label>{!ventureId ? <label className="block space-y-2 text-sm font-medium"><span>Tipo de entidade</span><select className="field-control" value={kind} disabled={pending} onChange={(event) => setKind(event.target.value as VentureKind)}><option value="PROJECT">Projeto tecnológico</option><option value="COMPANY">Empresa</option><option value="INITIATIVE">Iniciativa</option><option value="OTHER">Outro</option></select></label> : null}</>}
        <p className="text-sm leading-6 text-slate">A identidade e os dados anteriores serão preservados. O acompanhamento não encerra nem substitui a execução do apoio.</p>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        <div className="flex flex-wrap justify-end gap-3"><button type="button" className="button-secondary" disabled={pending} onClick={() => setPreview(null)}>Voltar</button><button type="button" className="button-primary" disabled={pending || Boolean(application?.venture?.archivedAt)} onClick={() => void confirm()}>{pending ? "Registrando…" : "Confirmar ingresso"}</button></div>
      </div>
    </Dialog>
  </div>;
}
