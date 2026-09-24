"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import type { VentureDto } from "@/lib/ventures/service";

export function VenturesManager({ organizationId, ventures, canManage, cohortFilter }: { organizationId: string; ventures: VentureDto[]; canManage: boolean; cohortFilter?: { id: string; name: string; programName: string } }) {
  return <div className="space-y-6">{cohortFilter ? <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-slate">Filtro ativo</p><p className="mt-1 text-sm text-ink">{cohortFilter.name} · {cohortFilter.programName}</p></div><Link href="/app/ventures" className="button-tertiary min-h-9 px-2 text-xs">Limpar filtro</Link></div> : null}{canManage && !cohortFilter ? <CreateVentureForm organizationId={organizationId} /> : null}<section className="panel"><div className="panel-header"><h2>{cohortFilter ? `Empreendimentos de ${cohortFilter.name}` : "Empreendimentos da organização"}</h2><p>A identidade do empreendimento permanece estável entre diferentes coortes e programas.</p></div>{ventures.length ? <div className="divide-y divide-line">{ventures.map((venture) => <Link key={venture.id} href={`/app/ventures/${venture.id}`} className="flex min-h-20 items-center justify-between gap-4 px-6 py-5 transition-colors hover:bg-surface-subtle"><span className="min-w-0"><span className="block truncate font-medium text-ink">{venture.name}</span><span className="mt-1 block text-sm text-slate">{kindLabel(venture.kind)} · {venture.enrollments.length} {venture.enrollments.length === 1 ? "coorte" : "coortes"}</span></span><span className="shrink-0 text-sm font-semibold text-brand">Ver detalhes</span></Link>)}</div> : <p className="px-6 py-10 text-sm text-slate">{cohortFilter ? "Nenhum empreendimento está inscrito nesta coorte." : "Nenhum empreendimento cadastrado. Cadastre uma entidade para acompanhar suas participações."}</p>}</section></div>;
}

function CreateVentureForm({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [kind, setKind] = useState("COMPANY");
  const [externalReference, setExternalReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(null);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/ventures`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, legalName: legalName || null, kind, externalReference: externalReference || null }) });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) { setError(payload.error ?? "Não foi possível criar o empreendimento."); return; }
      setName(""); setLegalName(""); setExternalReference(""); setKind("COMPANY"); router.refresh();
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }

  return <form onSubmit={submit} className="panel p-6"><h2 className="font-semibold text-ink">Criar empreendimento</h2><p className="mt-1 text-sm text-slate">Cadastre a entidade que poderá participar de diferentes programas e coortes.</p><div className="mt-5 grid gap-4 md:grid-cols-2"><Field label="Nome de uso" value={name} onChange={setName} required /><Field label="Razão social ou nome legal" value={legalName} onChange={setLegalName} /><label className="block space-y-2 text-sm font-medium text-ink"><span>Tipo</span><select value={kind} onChange={(event) => setKind(event.target.value)} className="field-control"><option value="COMPANY">Empresa</option><option value="PROJECT">Projeto tecnológico</option><option value="INITIATIVE">Iniciativa</option><option value="OTHER">Outro</option></select></label><Field label="Referência externa" value={externalReference} onChange={setExternalReference} /></div>{error ? <p className="mt-4 text-sm text-danger" role="alert">{error}</p> : null}<button disabled={pending} className="button-primary mt-5">{pending ? "Salvando…" : "Criar empreendimento"}</button></form>;
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return <label className="block space-y-2 text-sm font-medium text-ink"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} required={required} className="field-control" /></label>;
}

function kindLabel(kind: string) {
  return ({ COMPANY: "Empresa", PROJECT: "Projeto tecnológico", INITIATIVE: "Iniciativa", OTHER: "Outro" } as Record<string, string>)[kind] ?? kind;
}
