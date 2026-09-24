"use client";

import { FormEvent, useState } from "react";

export function OrganizationSettingsForm({ organizationId, initialName, initialSlug, canManage }: { organizationId: string; initialName: string; initialSlug: string; canManage: boolean }) {
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(initialSlug);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice(null); setError(null);
    const response = await fetch(`/api/organizations/${organizationId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, slug }) });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) { setError(payload.error ?? "Não foi possível salvar."); return; }
    setNotice("Configurações salvas.");
  }

  return <form onSubmit={save} className="panel max-w-2xl space-y-5 p-6"><label className="block space-y-2 text-sm font-medium text-ink"><span>Nome da organização</span><input disabled={!canManage} value={name} onChange={(event) => setName(event.target.value)} className="field-control" /></label><label className="block space-y-2 text-sm font-medium text-ink"><span>Identificador</span><input disabled={!canManage} value={slug} onChange={(event) => setSlug(event.target.value)} className="field-control" /><span className="block text-xs font-normal text-slate">Use letras minúsculas, números e hífens.</span></label>{notice ? <p className="text-sm text-success" role="status">{notice}</p> : null}{error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}{canManage ? <button className="button-primary">Salvar alterações</button> : <p className="text-sm text-slate">Você pode consultar as configurações, mas apenas administradores podem alterá-las.</p>}</form>;
}
