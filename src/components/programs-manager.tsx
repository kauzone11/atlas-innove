"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import type { FundingProgramDto } from "@/lib/programs/service";

export function ProgramsManager({ organizationId, programs, canManage }: { organizationId: string; programs: FundingProgramDto[]; canManage: boolean }) {
  return <div className="space-y-6">{canManage ? <CreateProgramForm organizationId={organizationId} /> : null}<section className="rounded-2xl border border-line bg-white shadow-panel"><div className="border-b border-line px-6 py-5"><h2 className="font-semibold text-ink">Programas da organização</h2><p className="mt-1 text-sm text-slate">Cada programa pode reunir várias coortes de apoio.</p></div>{programs.length ? <div className="divide-y divide-line">{programs.map((program) => <Link key={program.id} href={`/app/programs/${program.id}`} className="flex items-center justify-between gap-4 px-6 py-5 hover:bg-canvas"><span className="min-w-0"><span className="block truncate font-medium text-ink">{program.name}</span><span className="mt-1 block text-sm text-slate">{program.code ? `${program.code} · ` : ""}{program.cohortCount} {program.cohortCount === 1 ? "coorte" : "coortes"}</span></span><span className="shrink-0 text-sm font-semibold text-accent">{statusLabel(program.status)}</span></Link>)}</div> : <p className="px-6 py-10 text-sm text-slate">Nenhum programa cadastrado. Crie o primeiro ciclo de apoio desta organização.</p>}</section></div>;
}

function CreateProgramForm({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(null);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/programs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, slug, code: code || null, description: description || null }) });
      const payload = (await response.json()) as { program?: { id: string }; error?: string };
      if (!response.ok || !payload.program) { setError(payload.error ?? "Não foi possível criar o programa."); return; }
      router.push(`/app/programs/${payload.program.id}`);
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }

  return <form onSubmit={submit} className="rounded-2xl border border-line bg-white p-6 shadow-panel"><h2 className="font-semibold text-ink">Criar programa</h2><p className="mt-1 text-sm text-slate">Registre a iniciativa de apoio antes de cadastrar suas coortes.</p><div className="mt-5 grid gap-4 md:grid-cols-2"><Field id="program-name" label="Nome" value={name} onChange={(value) => { setName(value); if (!slugManuallyEdited) setSlug(slugify(value)); }} required /><Field id="program-slug" label="Identificador" value={slug} onChange={(value) => { setSlug(value); setSlugManuallyEdited(true); }} required hint="Gerado a partir do nome; ajuste apenas se precisar." /><Field id="program-code" label="Código" value={code} onChange={setCode} /><label className="block space-y-2 text-sm font-medium text-ink md:col-span-2"><span>Descrição</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={2000} className="w-full rounded-lg border border-line px-3 py-2.5" /></label></div>{error ? <p className="mt-4 text-sm text-red-800" role="alert">{error}</p> : null}<button disabled={pending} className="mt-5 rounded-lg bg-accent px-4 py-2.5 font-semibold text-white hover:bg-accent-dark disabled:opacity-60">{pending ? "Salvando…" : "Criar programa"}</button></form>;
}

function Field({ id, label, value, onChange, required, hint }: { id: string; label: string; value: string; onChange: (value: string) => void; required?: boolean; hint?: string }) {
  return <label htmlFor={id} className="block space-y-2 text-sm font-medium text-ink"><span>{label}</span><input id={id} value={value} onChange={(event) => onChange(event.target.value)} required={required} className="w-full rounded-lg border border-line px-3 py-2.5" />{hint ? <span className="block text-xs font-normal text-slate">{hint}</span> : null}</label>;
}

function statusLabel(status: string) {
  return ({ DRAFT: "Rascunho", ACTIVE: "Ativo", CLOSED: "Encerrado", ARCHIVED: "Arquivado" } as Record<string, string>)[status] ?? status;
}

function slugify(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}
