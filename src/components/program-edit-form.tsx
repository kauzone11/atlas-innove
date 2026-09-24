"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import type { FundingProgramDetailsDto } from "@/lib/programs/service";

export function ProgramEditForm({ organizationId, program, canManage, onSuccess }: { organizationId: string; program: FundingProgramDetailsDto; canManage: boolean; onSuccess?: () => void }) {
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
        <Field id="program-edit-name" label="Nome" value={name} onChange={setName} required />
        <Field id="program-edit-slug" label="Identificador" value={slug} onChange={setSlug} required />
        <Field id="program-edit-code" label="Código" value={code} onChange={setCode} />
        <label className="block space-y-2 text-sm font-medium text-ink">
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="field-control">
            <option value="DRAFT">Rascunho</option>
            <option value="ACTIVE">Ativo</option>
            <option value="CLOSED">Encerrado</option>
            <option value="ARCHIVED">Arquivado</option>
          </select>
        </label>
        <label className="block space-y-2 text-sm font-medium text-ink md:col-span-2">
          <span>Descrição</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={2000} className="field-control" />
        </label>
      </div>
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      <button disabled={pending} className="button-primary w-full">
        {pending ? "Salvando…" : "Salvar alterações"}
      </button>
    </form>
  );
}

function Field({ id, label, value, onChange, required }: { id: string; label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label htmlFor={id} className="block space-y-2 text-sm font-medium text-ink">
      <span>{label}</span>
      <input id={id} value={value} onChange={(event) => onChange(event.target.value)} required={required} className="field-control" />
    </label>
  );
}
