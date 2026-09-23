"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import type { VentureDto } from "@/lib/ventures/service";

export function VentureEditForm({ organizationId, venture, canManage }: { organizationId: string; venture: VentureDto; canManage: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(venture.name);
  const [legalName, setLegalName] = useState(venture.legalName ?? "");
  const [kind, setKind] = useState(venture.kind);
  const [externalReference, setExternalReference] = useState(venture.externalReference ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!canManage) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/ventures/${venture.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, legalName: legalName || null, kind, externalReference: externalReference || null }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Não foi possível atualizar o empreendimento.");
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
      <h2 className="font-semibold text-ink">Editar identidade</h2>
      <p className="mt-1 text-sm text-slate">Estes são os dados estáveis do empreendimento. Resultados longitudinais pertencem às observações.</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field id="venture-edit-name" label="Nome de uso" value={name} onChange={setName} required />
        <Field id="venture-edit-legal-name" label="Razão social ou nome legal" value={legalName} onChange={setLegalName} />
        <label htmlFor="venture-edit-kind" className="block space-y-2 text-sm font-medium text-ink">
          <span>Tipo</span>
          <select id="venture-edit-kind" value={kind} onChange={(event) => setKind(event.target.value)} className="w-full rounded-lg border border-line px-3 py-2.5">
            <option value="COMPANY">Empresa</option>
            <option value="PROJECT">Projeto tecnológico</option>
            <option value="INITIATIVE">Iniciativa</option>
            <option value="OTHER">Outro</option>
          </select>
        </label>
        <Field id="venture-edit-reference" label="Referência externa" value={externalReference} onChange={setExternalReference} />
      </div>
      {error ? <p className="mt-4 text-sm text-red-800" role="alert">{error}</p> : null}
      <button disabled={pending} className="mt-5 rounded-lg bg-accent px-4 py-2.5 font-semibold text-white hover:bg-accent-dark disabled:opacity-60">
        {pending ? "Salvando…" : "Salvar alterações"}
      </button>
    </form>
  );
}

function Field({ id, label, value, onChange, required }: { id: string; label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label htmlFor={id} className="block space-y-2 text-sm font-medium text-ink">
      <span>{label}</span>
      <input id={id} value={value} onChange={(event) => onChange(event.target.value)} required={required} className="w-full rounded-lg border border-line px-3 py-2.5" />
    </label>
  );
}
