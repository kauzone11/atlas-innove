"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { CohortCreateForm, type CohortProtocolChoice } from "@/components/cohort-create-form";
import { Dialog } from "@/components/dialog";
import { Panel, PanelHeader } from "@/components/ui";
import { selectionRequest } from "@/components/selection/request";
import type { SelectionApplication } from "@/components/selection/types";
import type { FundingCallDto } from "@/lib/funding-calls/service";

type VentureKind = "PROJECT" | "COMPANY" | "INITIATIVE" | "OTHER";
type VentureMapping = { ventureId: string | null; kind: VentureKind };
type EnrollmentPreview = { cohort: { id: string; name: string }; applications: Array<{ id: string; projectNameSnapshot: string; teamNameSnapshot: string | null; venture: { id: string; name: string; archivedAt: string | null } | null; enrollmentId: string | null }>; availableVentures: Array<{ id: string; name: string; kind: string; eligibleApplicationIds: string[] }> };

export function CreateSelectionCohort({ organizationId, call, protocols }: { organizationId: string; call: FundingCallDto; protocols: CohortProtocolChoice[] }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className="button-secondary" onClick={() => setOpen(true)}><Plus size={16} aria-hidden="true" />Nova coorte</button><Dialog open={open} onClose={() => setOpen(false)} mode="sheet" title="Nova coorte" description={`Grupo de acompanhamento vinculado ao edital ${call.callNumber}.`}><CohortCreateForm organizationId={organizationId} programId={call.fundingProgramId} fundingCalls={[call]} protocols={protocols} fixedFundingCallId={call.id} onSuccess={() => setOpen(false)} /></Dialog></>;
}

export function CohortBridge({ applications, cohorts, apiBase, programId, callId, canManage, published }: { applications: SelectionApplication[]; cohorts: Array<{ id: string; name: string }>; apiBase: string; programId: string; callId: string; canManage: boolean; published: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [cohortId, setCohortId] = useState(cohorts[0]?.id ?? "");
  const [preview, setPreview] = useState<EnrollmentPreview | null>(null);
  const [mappings, setMappings] = useState<Record<string, VentureMapping>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const available = applications.filter((application) => application.decision === "SELECTED" && application.status === "DECIDED" && !application.enrollmentId);
  const enrolled = applications.filter((application) => application.decision === "SELECTED" && application.enrollmentId);
  const enabled = canManage && published && cohorts.length > 0 && available.length > 0;
  const eligibleSelected = selected.filter((id) => available.some((application) => application.id === id));
  const blockedPreview = Boolean(preview?.applications.some((application) => !application.enrollmentId && application.venture?.archivedAt));

  function toggle(id: string) { setSelected((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]); setPreview(null); setError(null); }
  async function loadPreview() {
    setPending(true); setError(null); setNotice(null);
    try { const payload = await selectionRequest<{ preview: EnrollmentPreview }>(`${apiBase}/enroll?cohortId=${encodeURIComponent(cohortId)}&applicationIds=${encodeURIComponent(eligibleSelected.join(","))}`, "GET"); setMappings(Object.fromEntries(payload.preview.applications.map((application) => [application.id, { ventureId: application.venture?.id ?? null, kind: "PROJECT" }]))); setPreview(payload.preview); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível preparar a conferência."); }
    finally { setPending(false); }
  }
  async function enroll() {
    if (!preview || blockedPreview) return;
    setPending(true); setError(null);
    try { const payload = await selectionRequest<{ enrollments: Array<{ enrollmentId: string }> }>(`${apiBase}/enroll`, "POST", { cohortId: preview.cohort.id, applicationIds: preview.applications.map((application) => application.id), mappings: preview.applications.map((application) => ({ applicationId: application.id, ventureId: mappings[application.id]?.ventureId ?? null, kind: mappings[application.id]?.kind ?? "PROJECT" })) }); setNotice(`${payload.enrollments.length} participação(ões) registrada(s) em ${preview.cohort.name}. A origem de cada candidatura foi preservada.`); setPreview(null); setSelected([]); router.refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível confirmar o ingresso. Consulte o acompanhamento antes de repetir a ação."); }
    finally { setPending(false); }
  }

  return <Panel>
    <PanelHeader title="Da seleção ao acompanhamento" description="Projetos selecionados podem originar entidades acompanhadas pela instituição. A candidatura permanece como referência da participação." />
    {!published ? <p className="border-b border-line px-4 py-5 text-sm leading-6 text-slate sm:px-6">Publique o resultado do edital antes de encaminhar os projetos selecionados ao acompanhamento. <Link className="font-medium text-accent-hover" href={`/app/programs/${programId}/calls/${callId}/ranking`}>Consultar decisões e publicação</Link>.</p> : null}
    {available.length ? <div className="space-y-5 px-4 py-5 sm:px-6"><p className="text-sm leading-6 text-slate">{available.length} candidatura(s) selecionada(s) ainda sem participação no acompanhamento.{!canManage ? " Um gestor pode confirmar o ingresso em uma coorte." : " Selecione os projetos e a coorte para conferir as entidades antes de confirmar."}</p><ul className="divide-y divide-line border-y border-line">{available.map((application) => <li key={application.id} className="flex items-start gap-3 py-4">{canManage ? <label className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center"><span className="sr-only">Encaminhar {application.projectNameSnapshot}</span><input className="h-5 w-5 accent-accent" type="checkbox" checked={eligibleSelected.includes(application.id)} disabled={pending || !published || (!selected.includes(application.id) && eligibleSelected.length >= 200)} onChange={() => toggle(application.id)} /></label> : null}<div className="min-w-0"><Link href={`/app/programs/${programId}/calls/${callId}/applications/${application.id}`} className="break-words font-medium text-ink hover:text-accent-hover">{application.projectNameSnapshot}</Link><p className="mt-1 break-words text-sm text-slate">{application.teamNameSnapshot ?? "Participação individual"}</p></div></li>)}</ul>{canManage && published ? <div className="space-y-4"><label className="block space-y-2 text-sm font-medium"><span>Coorte de destino</span><select className="field-control" value={cohortId} onChange={(event) => { setCohortId(event.target.value); setPreview(null); setError(null); }} disabled={pending || cohorts.length === 0}><option value="">Selecione uma coorte</option>{cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}</select></label>{!cohorts.length ? <p className="text-sm text-slate">Crie uma coorte planejada ou ativa para este edital antes de registrar o ingresso.</p> : null}<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate">{eligibleSelected.length} selecionada(s) para encaminhamento{eligibleSelected.length >= 200 ? " · limite de 200 por confirmação" : ""}</p><button type="button" className="button-primary" disabled={!enabled || !cohortId || eligibleSelected.length === 0 || pending} onClick={() => void loadPreview()}>{pending ? "Preparando…" : "Conferir ingresso"}<ArrowRight size={16} aria-hidden="true" /></button></div></div> : null}</div> : <div className="px-4 py-8 sm:px-6"><h3 className="font-medium text-ink">{enrolled.length ? "As candidaturas selecionadas já estão no acompanhamento" : "Selecione os projetos antes de iniciar o acompanhamento"}</h3><p className="mt-2 max-w-xl text-sm leading-6 text-slate">{enrolled.length ? "As participações preservam sua candidatura de origem e utilizam a identidade acompanhada pela instituição." : "A decisão é registrada na classificação do edital. Após publicar o resultado, um gestor poderá conferir e confirmar o ingresso dos selecionados em uma coorte."}</p></div>}
    {enrolled.length ? <div className="border-t border-line px-4 py-5 sm:px-6"><h3 className="text-sm font-semibold">Participações originadas neste edital</h3><ul className="mt-3 divide-y divide-line">{enrolled.map((application) => <li key={application.id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><Link href={`/app/programs/${programId}/calls/${callId}/applications/${application.id}`} className="break-words font-medium text-ink hover:text-accent-hover">{application.projectNameSnapshot}</Link><span className="text-xs text-success">Ingresso registrado</span></li>)}</ul></div> : null}
    {notice ? <p role="status" className="border-t border-line px-4 py-4 text-sm text-success sm:px-6">{notice}</p> : null}{error && !preview ? <p role="alert" className="border-t border-line px-4 py-4 text-sm text-danger sm:px-6">{error}</p> : null}
    <Dialog open={Boolean(preview)} onClose={() => { if (!pending) setPreview(null); }} mode="sheet" title="Conferir ingresso no acompanhamento" description={`Coorte de destino: ${preview?.cohort.name ?? ""}`}>
      <div className="space-y-5">
        <p className="text-sm leading-6 text-slate">Confira a entidade acompanhada de cada projeto nesta instituição. Você pode criar uma entidade ou vincular uma já existente. O conteúdo enviado e a origem da candidatura serão preservados.</p>
        <ul className="divide-y divide-line border-y border-line">{preview?.applications.map((application) => {
          const mapping = mappings[application.id] ?? { ventureId: null, kind: "PROJECT" };
          const availableVentures = preview.availableVentures.filter((venture) => venture.eligibleApplicationIds.includes(application.id));
          const selectedVenture = availableVentures.find((venture) => venture.id === mapping.ventureId);
          return <li key={application.id} className="space-y-3 py-5">
            <p className="break-words font-medium">{application.projectNameSnapshot}</p>
            <p className="break-words text-sm text-slate">{application.teamNameSnapshot ?? "Participação individual"}</p>
            {application.enrollmentId ? <p className="text-sm leading-6 text-slate">Participação já registrada; será preservada.</p> : application.venture?.archivedAt ? <div className="space-y-2 border-l-2 border-warning pl-3"><p className="break-words text-sm font-medium text-ink">{application.venture.name} · entidade arquivada</p><p className="text-sm leading-6 text-slate">Este projeto já possui uma entidade acompanhada arquivada na instituição. Seu vínculo será preservado; uma nova entidade não pode substituí-la.</p><Link className="inline-flex min-h-11 items-center text-sm font-medium text-accent-hover" href={`/app/ventures/${application.venture.id}`} target="_blank" rel="noopener noreferrer">Consultar entidade e histórico em outra aba</Link></div> : application.venture ? <p className="break-words text-sm leading-6">Reutilizar entidade acompanhada: <strong>{application.venture.name}</strong><span className="mt-1 block text-xs text-slate">O vínculo existente com este projeto será preservado.</span></p> : <>
              <label className="block space-y-2 text-sm font-medium" htmlFor={`venture-mapping-${application.id}`}><span>Entidade acompanhada</span><select id={`venture-mapping-${application.id}`} className="field-control" value={mapping.ventureId ?? ""} disabled={pending} onChange={(event) => setMappings((values) => ({ ...values, [application.id]: { ...mapping, ventureId: event.target.value || null } }))}><option value="">Criar nova entidade a partir deste projeto</option>{availableVentures.map((venture) => <option key={venture.id} value={venture.id} disabled={Object.entries(mappings).some(([id, value]) => id !== application.id && value.ventureId === venture.id)}>{venture.name} · {ventureKindLabel(venture.kind)}</option>)}</select></label>
              {!mapping.ventureId ? <label className="block space-y-2 text-sm font-medium" htmlFor={`venture-kind-${application.id}`}><span>Tipo da nova entidade</span><select id={`venture-kind-${application.id}`} className="field-control" value={mapping.kind} disabled={pending} onChange={(event) => setMappings((values) => ({ ...values, [application.id]: { ...mapping, kind: event.target.value as VentureKind } }))}>{["PROJECT", "COMPANY", "INITIATIVE", "OTHER"].map((kind) => <option key={kind} value={kind}>{ventureKindLabel(kind)}</option>)}</select><span className="block text-xs font-normal leading-5 text-slate">Projeto tecnológico é o tipo inicial. Escolha outro tipo somente quando ele representar a entidade apoiada.</span></label> : <p className="break-words text-sm leading-6 text-slate">Vincular este projeto à entidade <strong className="text-ink">{selectedVenture?.name}</strong>. Sua identidade e seu tipo serão preservados nos acompanhamentos existentes.</p>}
            </>}
          </li>;
        })}</ul>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        {blockedPreview ? <p className="text-sm leading-6 text-warning" role="status">Revise a seleção e retire as candidaturas vinculadas a entidades arquivadas antes de confirmar este lote. Seus vínculos e históricos permanecem preservados.</p> : null}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" className="button-secondary" disabled={pending} onClick={() => setPreview(null)}>Revisar seleção</button><button type="button" className="button-primary" disabled={pending || blockedPreview} onClick={() => void enroll()}>{pending ? "Confirmando…" : "Confirmar ingresso"}</button></div>
      </div>
    </Dialog>
  </Panel>;
}

function ventureKindLabel(kind: string) { return ({ PROJECT: "Projeto tecnológico", COMPANY: "Empresa", INITIATIVE: "Iniciativa", OTHER: "Outro" } as Record<string, string>)[kind] ?? kind; }
