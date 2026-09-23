"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type EditableCohort = {
  id: string;
  name: string;
  code: string | null;
  referenceYear: number | null;
  startsAt: string | null;
  endsAt: string | null;
  status: string;
};

export function CohortEditForm({ organizationId, cohort, canManage }: { organizationId: string; cohort: EditableCohort; canManage: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(cohort.name);
  const [code, setCode] = useState(cohort.code ?? "");
  const [referenceYear, setReferenceYear] = useState(cohort.referenceYear?.toString() ?? "");
  const [startsAt, setStartsAt] = useState(dateInput(cohort.startsAt));
  const [endsAt, setEndsAt] = useState(dateInput(cohort.endsAt));
  const [status, setStatus] = useState(cohort.status);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!canManage) return null;

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
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Não foi possível atualizar a coorte.");
        return;
      }
      router.refresh();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-line bg-white p-6 shadow-panel">
      <h2 className="font-semibold text-ink">Dados da coorte</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field id="cohort-edit-name" label="Nome" value={name} onChange={setName} required />
        <Field id="cohort-edit-code" label="Código" value={code} onChange={setCode} />
        <Field id="cohort-edit-year" label="Ano de referência" value={referenceYear} onChange={setReferenceYear} type="number" min="1900" max="2200" />
        <label className="block space-y-2 text-sm font-medium text-ink">
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full rounded-lg border border-line px-3 py-2.5">
            <option value="PLANNED">Planejada</option>
            <option value="ACTIVE">Ativa</option>
            <option value="CLOSED">Encerrada</option>
            <option value="ARCHIVED">Arquivada</option>
          </select>
        </label>
        <Field id="cohort-edit-start" label="Início" value={startsAt} onChange={setStartsAt} type="date" />
        <Field id="cohort-edit-end" label="Fim" value={endsAt} onChange={setEndsAt} type="date" />
      </div>
      {error ? <p className="mt-4 text-sm text-red-800" role="alert">{error}</p> : null}
      <button disabled={pending} className="mt-5 rounded-lg bg-accent px-4 py-2.5 font-semibold text-white hover:bg-accent-dark disabled:opacity-60">
        {pending ? "Salvando…" : "Salvar alterações"}
      </button>
    </form>
  );
}

function Field({ id, label, value, onChange, type = "text", required, min, max }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; min?: string; max?: string }) {
  return (
    <label htmlFor={id} className="block space-y-2 text-sm font-medium text-ink">
      <span>{label}</span>
      <input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} min={min} max={max} className="w-full rounded-lg border border-line px-3 py-2.5" />
    </label>
  );
}

function dateInput(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}
