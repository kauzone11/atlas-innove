"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function CohortCreateForm({ organizationId, programId }: { organizationId: string; programId: string }) {
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
      setName(""); setCode(""); setReferenceYear(""); setStartsAt(""); setEndsAt(""); setStatus("PLANNED"); router.refresh();
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }

  return <form onSubmit={submit} className="rounded-2xl border border-line bg-white p-6 shadow-panel"><h2 className="font-semibold text-ink">Criar coorte</h2><p className="mt-1 text-sm text-slate">Uma coorte reúne empreendimentos que entram em acompanhamento no mesmo ciclo.</p><div className="mt-5 grid gap-4 md:grid-cols-2"><Field label="Nome" value={name} onChange={setName} required /><Field label="Código" value={code} onChange={setCode} /><Field label="Ano de referência" value={referenceYear} onChange={setReferenceYear} type="number" min="1900" max="2200" /><label className="block space-y-2 text-sm font-medium text-ink"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full rounded-lg border border-line px-3 py-2.5"><option value="PLANNED">Planejada</option><option value="ACTIVE">Ativa</option><option value="CLOSED">Encerrada</option><option value="ARCHIVED">Arquivada</option></select></label><Field label="Início" value={startsAt} onChange={setStartsAt} type="date" /><Field label="Fim" value={endsAt} onChange={setEndsAt} type="date" /></div>{error ? <p className="mt-4 text-sm text-red-800" role="alert">{error}</p> : null}<button disabled={pending} className="mt-5 rounded-lg bg-accent px-4 py-2.5 font-semibold text-white hover:bg-accent-dark disabled:opacity-60">{pending ? "Salvando…" : "Criar coorte"}</button></form>;
}

function Field({ label, value, onChange, type = "text", required, min, max }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; min?: string; max?: string }) {
  return <label className="block space-y-2 text-sm font-medium text-ink"><span>{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} min={min} max={max} className="w-full rounded-lg border border-line px-3 py-2.5" /></label>;
}
