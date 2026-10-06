"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { CohortConfigurationFields, type CohortFundingCallChoice, type CohortProtocolChoice } from "@/components/cohort-create-form";

export type EditableCohort = {
  id: string;
  name: string;
  code: string | null;
  referenceYear: number | null;
  startsAt: string | null;
  endsAt: string | null;
  status: string;
  fundingCallId?: string | null;
  trackingProtocolVersionId?: string | null;
  waveCount?: number;
  ventureCount?: number;
};

export function CohortEditForm({ organizationId, cohort, canManage, fundingCalls = [], protocols = [], onSuccess }: { organizationId: string; cohort: EditableCohort; canManage: boolean; fundingCalls?: CohortFundingCallChoice[]; protocols?: CohortProtocolChoice[]; onSuccess?: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(cohort.name);
  const [code, setCode] = useState(cohort.code ?? "");
  const [referenceYear, setReferenceYear] = useState(cohort.referenceYear?.toString() ?? "");
  const [startsAt, setStartsAt] = useState(dateInput(cohort.startsAt));
  const [endsAt, setEndsAt] = useState(dateInput(cohort.endsAt));
  const [status, setStatus] = useState(cohort.status);
  const [fundingCallId, setFundingCallId] = useState(cohort.fundingCallId ?? "");
  const [protocolVersionId, setProtocolVersionId] = useState(cohort.trackingProtocolVersionId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!canManage || cohort.status === "ARCHIVED") return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/cohorts/${cohort.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          code: code || null,
          referenceYear: referenceYear || null,
          startsAt: startsAt || null,
          endsAt: endsAt || null,
          status,
          ...(fundingCallId !== (cohort.fundingCallId ?? "") ? { fundingCallId: fundingCallId || null } : {}),
          ...(protocolVersionId !== (cohort.trackingProtocolVersionId ?? "") ? { trackingProtocolVersionId: protocolVersionId || null } : {}),
        }),
      });
      const payload = (await response.json()) as { error?: string; issues?: Record<string, string[]> };
      if (!response.ok) {
        setError(Object.values(payload.issues ?? {}).flat().join(" ") || payload.error || "Não foi possível atualizar a coorte.");
        return;
      }
      onSuccess?.();
      router.refresh();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="cohort-edit-name" label="Nome" value={name} onChange={setName} required />
        <Field id="cohort-edit-code" label="Código" value={code} onChange={setCode} />
        <Field id="cohort-edit-year" label="Ano de referência" value={referenceYear} onChange={setReferenceYear} type="number" min="1900" max="2200" />
        <label className="block space-y-2 text-sm font-medium text-ink">
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="field-control">
            <option value="PLANNED">Planejada</option>
            <option value="ACTIVE">Ativa</option>
            <option value="CLOSED">Encerrada</option>
            <option value="ARCHIVED">Arquivada</option>
          </select>
        </label>
        <Field id="cohort-edit-start" label="Início" value={startsAt} onChange={setStartsAt} type="date" />
        <Field id="cohort-edit-end" label="Fim" value={endsAt} onChange={setEndsAt} type="date" />
      </div>
      <CohortConfigurationFields fundingCalls={fundingCalls} protocols={protocols} fundingCallId={fundingCallId} onFundingCallChange={setFundingCallId} protocolVersionId={protocolVersionId} onProtocolChange={setProtocolVersionId} protocolLocked={(cohort.waveCount ?? 0) > 0} callLocked={(cohort.waveCount ?? 0) > 0 || (cohort.ventureCount ?? 0) > 0} />
      <p className="text-sm leading-6 text-slate">Ao arquivar, a coorte permanece no histórico e deixa de aceitar alterações, participações e ondas.</p>
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      <button disabled={pending} className="button-primary w-full">
        {pending ? "Salvando…" : "Salvar alterações"}
      </button>
    </form>
  );
}

function Field({ id, label, value, onChange, type = "text", required, min, max }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; min?: string; max?: string }) {
  return (
    <label htmlFor={id} className="block space-y-2 text-sm font-medium text-ink">
      <span>{label}</span>
      <input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} min={min} max={max} className="field-control" />
    </label>
  );
}

function dateInput(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}
