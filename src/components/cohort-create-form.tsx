"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function CohortCreateForm({ organizationId, programId, onSuccess }: { organizationId: string; programId: string; onSuccess?: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [referenceYear, setReferenceYear] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [status, setStatus] = useState("PLANNED");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(null);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/programs/${programId}/cohorts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, code: code || null, referenceYear: referenceYear || null, startsAt: startsAt || null, endsAt: endsAt || null, status }) });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) { setError(payload.error ?? "Não foi possível criar a coorte."); return; }
      onSuccess?.();
      setName(""); setCode(""); setReferenceYear(""); setStartsAt(""); setEndsAt(""); setStatus("PLANNED"); router.refresh();
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }

  return <form onSubmit={submit} className="space-y-5"><div className="grid gap-4 md:grid-cols-2"><Field label="Nome" value={name} onChange={setName} required /><Field label="Código" value={code} onChange={setCode} /><Field label="Ano de referência" value={referenceYear} onChange={setReferenceYear} type="number" min="1900" max="2200" /><label className="block space-y-2 text-sm font-medium text-ink"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)} className="field-control"><option value="PLANNED">Planejada</option><option value="ACTIVE">Ativa</option><option value="CLOSED">Encerrada</option><option value="ARCHIVED">Arquivada</option></select></label><Field label="Início" value={startsAt} onChange={setStartsAt} type="date" /><Field label="Fim" value={endsAt} onChange={setEndsAt} type="date" /></div>{error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}<button disabled={pending} className="button-primary w-full">{pending ? "Salvando…" : "Criar coorte"}</button></form>;
}

function Field({ label, value, onChange, type = "text", required, min, max }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; min?: string; max?: string }) {
  return <label className="block space-y-2 text-sm font-medium text-ink"><span>{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} min={min} max={max} className="field-control" /></label>;
}
