"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import type { FundingCallDto } from "@/lib/funding-calls/service";

const statuses = [
  ["DRAFT", "Rascunho"], ["OPEN", "Aberto"], ["IN_REVIEW", "Em avaliação"],
  ["CLOSED", "Encerrado"], ["RESULT_PUBLISHED", "Resultado publicado"], ["ARCHIVED", "Arquivado"],
];

export function FundingCallForm({ organizationId, programId, call, onSuccess }: { organizationId: string; programId: string; call?: FundingCallDto; onSuccess?: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const text = (key: string) => String(values.get(key) ?? "").trim();
    const optional = (key: string) => text(key) || null;
    setPending(true); setError(null);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/programs/${programId}/calls${call ? `/${call.id}` : ""}`, {
        method: call ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: text("title"), callNumber: text("callNumber"), shortTitle: optional("shortTitle"),
          status: text("status"), sourceUrl: optional("sourceUrl"), objective: optional("objective"),
          publishedAt: optional("publishedAt"), applicationStartsAt: optional("applicationStartsAt"), applicationEndsAt: optional("applicationEndsAt"),
          totalBudget: optional("totalBudget"), maximumSupport: optional("maximumSupport"), targetProjects: optional("targetProjects"), executionMonths: optional("executionMonths"),
        }),
      });
      const payload = await response.json() as { error?: string; issues?: Record<string, string[]>; call?: { id: string } };
      if (!response.ok) { setError(Object.values(payload.issues ?? {}).flat().join(" ") || payload.error || "Não foi possível salvar o edital."); return; }
      onSuccess?.();
      if (!call && payload.call) router.push(`/app/programs/${programId}/calls/${payload.call.id}`);
      router.refresh();
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }

  return <form onSubmit={submit} className="space-y-5">
    <Field name="title" label="Título do edital" value={call?.title} required maxLength={200} />
    <div className="grid gap-4 sm:grid-cols-2">
      <Field name="callNumber" label="Número do edital" value={call?.callNumber} required maxLength={80} />
      <label className="block space-y-2 text-sm font-medium text-ink"><span>Status</span><select name="status" defaultValue={call?.status ?? "DRAFT"} className="field-control">{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    <Field name="sourceUrl" label="Link da publicação ou fonte oficial (opcional)" value={call?.sourceUrl} type="url" maxLength={2048} />
    <label className="block space-y-2 text-sm font-medium text-ink"><span>Objetivo <span className="font-normal text-slate">(opcional)</span></span><textarea name="objective" defaultValue={call?.objective ?? ""} rows={3} maxLength={4000} className="field-control" /></label>
    <fieldset className="space-y-4 border-t border-line pt-4"><legend className="pr-2 text-sm font-semibold text-ink">Calendário</legend><div className="grid gap-4 sm:grid-cols-2">
      <Field name="publishedAt" label="Publicação" value={dateInput(call?.publishedAt)} type="date" />
      <Field name="applicationStartsAt" label="Abertura das inscrições" value={dateInput(call?.applicationStartsAt)} type="date" />
      <Field name="applicationEndsAt" label="Encerramento das inscrições" value={dateInput(call?.applicationEndsAt)} type="date" />
    </div></fieldset>
    <details className="border-t border-line pt-4"><summary className="cursor-pointer text-sm font-semibold text-ink">Orçamento e informações adicionais</summary><div className="mt-4 grid gap-4 sm:grid-cols-2">
      <Field name="shortTitle" label="Título curto" value={call?.shortTitle} maxLength={100} />
      <Field name="totalBudget" label="Orçamento total (R$)" value={call?.totalBudget} type="number" min="0" step="0.01" />
      <Field name="maximumSupport" label="Apoio máximo por projeto (R$)" value={call?.maximumSupport} type="number" min="0" step="0.01" />
      <Field name="targetProjects" label="Projetos previstos" value={call?.targetProjects?.toString()} type="number" min="1" max="1000000" />
      <Field name="executionMonths" label="Prazo de execução (meses)" value={call?.executionMonths?.toString()} type="number" min="1" max="1200" />
    </div></details>
    <p className="text-sm leading-6 text-slate">Ao arquivar, o edital permanece no histórico e deixa de aceitar alterações e novas coortes.</p>
    {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
    <button disabled={pending} className="button-primary w-full">{pending ? "Salvando…" : call ? "Salvar alterações" : "Criar edital"}</button>
  </form>;
}

function Field({ name, label, value, type = "text", required, min, max, maxLength, step }: { name: string; label: string; value?: string | null; type?: string; required?: boolean; min?: string; max?: string; maxLength?: number; step?: string }) {
  return <label className="block space-y-2 text-sm font-medium text-ink"><span>{label}</span><input name={name} defaultValue={value ?? ""} type={type} required={required} min={min} max={max} maxLength={maxLength} step={step} className="field-control" /></label>;
}

function dateInput(value?: string | null) { return value?.slice(0, 10) ?? ""; }
