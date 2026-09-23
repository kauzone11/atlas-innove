"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import type { FundingProgramDetailsDto } from "@/lib/programs/service";

export function ProgramEditForm({ organizationId, program, canManage }: { organizationId: string; program: FundingProgramDetailsDto; canManage: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(program.name);
  const [slug, setSlug] = useState(program.slug);
  const [code, setCode] = useState(program.code ?? "");
  const [description, setDescription] = useState(program.description ?? "");
  const [status, setStatus] = useState(program.status);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!canManage) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/programs/${program.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, code: code || null, description: description || null, status }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Não foi possível atualizar o programa.");
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
      <h2 className="font-semibold text-ink">Editar programa</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field id="program-edit-name" label="Nome" value={name} onChange={setName} required />
        <Field id="program-edit-slug" label="Identificador" value={slug} onChange={setSlug} required />
        <Field id="program-edit-code" label="Código" value={code} onChange={setCode} />
        <label className="block space-y-2 text-sm font-medium text-ink">
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full rounded-lg border border-line px-3 py-2.5">
            <option value="DRAFT">Rascunho</option>
            <option value="ACTIVE">Ativo</option>
            <option value="CLOSED">Encerrado</option>
            <option value="ARCHIVED">Arquivado</option>
          </select>
        </label>
        <label className="block space-y-2 text-sm font-medium text-ink md:col-span-2">
          <span>Descrição</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={2000} className="w-full rounded-lg border border-line px-3 py-2.5" />
        </label>
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
