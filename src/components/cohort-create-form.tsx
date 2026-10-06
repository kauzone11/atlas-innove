"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export type CohortFundingCallChoice = { id: string; title: string; callNumber: string; status: string };
export type CohortProtocolChoice = { id: string; name: string; versions: Array<{ id: string; version: number; label: string | null; indicators: Array<{ id: string }> }> };

export function CohortCreateForm({ organizationId, programId, fundingCalls = [], protocols = [], fixedFundingCallId, onSuccess }: { organizationId: string; programId: string; fundingCalls?: CohortFundingCallChoice[]; protocols?: CohortProtocolChoice[]; fixedFundingCallId?: string; onSuccess?: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [referenceYear, setReferenceYear] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [status, setStatus] = useState("PLANNED");
  const [fundingCallId, setFundingCallId] = useState(fixedFundingCallId ?? "");
  const [protocolVersionId, setProtocolVersionId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(null);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/programs/${programId}/cohorts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, code: code || null, referenceYear: referenceYear || null, startsAt: startsAt || null, endsAt: endsAt || null, status, fundingCallId: fundingCallId || null, trackingProtocolVersionId: protocolVersionId || null }) });
      const payload = (await response.json()) as { error?: string; issues?: Record<string, string[]>; cohort?: { id: string } };
      if (!response.ok) { setError(Object.values(payload.issues ?? {}).flat().join(" ") || payload.error || "Não foi possível criar a coorte."); return; }
      onSuccess?.();
      setName(""); setCode(""); setReferenceYear(""); setStartsAt(""); setEndsAt(""); setStatus("PLANNED");
      if (payload.cohort) router.push(`/app/programs/${programId}/cohorts/${payload.cohort.id}`);
      router.refresh();
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }

  return <form onSubmit={submit} className="space-y-5"><div className="grid gap-4 md:grid-cols-2"><Field label="Nome" value={name} onChange={setName} required /><Field label="Código" value={code} onChange={setCode} /><Field label="Ano de referência" value={referenceYear} onChange={setReferenceYear} type="number" min="1900" max="2200" /><label className="block space-y-2 text-sm font-medium text-ink"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)} className="field-control"><option value="PLANNED">Planejada</option><option value="ACTIVE">Ativa</option><option value="CLOSED">Encerrada</option><option value="ARCHIVED">Arquivada</option></select></label><Field label="Início" value={startsAt} onChange={setStartsAt} type="date" /><Field label="Fim" value={endsAt} onChange={setEndsAt} type="date" /></div><CohortConfigurationFields fundingCalls={fundingCalls} protocols={protocols} fundingCallId={fundingCallId} onFundingCallChange={setFundingCallId} protocolVersionId={protocolVersionId} onProtocolChange={setProtocolVersionId} callLocked={Boolean(fixedFundingCallId)} />{error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}<button disabled={pending} className="button-primary w-full">{pending ? "Salvando…" : "Criar coorte"}</button></form>;
}

export function CohortConfigurationFields({ fundingCalls, protocols, fundingCallId, onFundingCallChange, protocolVersionId, onProtocolChange, callLocked = false, protocolLocked = false }: { fundingCalls: CohortFundingCallChoice[]; protocols: CohortProtocolChoice[]; fundingCallId: string; onFundingCallChange: (value: string) => void; protocolVersionId: string; onProtocolChange: (value: string) => void; callLocked?: boolean; protocolLocked?: boolean }) {
  const versions = protocols.flatMap((protocol) => protocol.versions.filter((version) => version.indicators.length > 0 || version.id === protocolVersionId).map((version) => ({ ...version, protocolName: protocol.name })));
  return <fieldset className="space-y-4 border-t border-line pt-4"><legend className="pr-2 text-sm font-semibold text-ink">Contexto do acompanhamento</legend>
    <label className="block space-y-2 text-sm font-medium text-ink"><span>Edital de origem</span><select value={fundingCallId} onChange={(event) => onFundingCallChange(event.target.value)} disabled={callLocked} className="field-control"><option value="">Sem edital de origem</option>{fundingCalls.filter((call) => call.status !== "ARCHIVED" || call.id === fundingCallId).map((call) => <option key={call.id} value={call.id}>{call.callNumber} · {call.title}</option>)}</select></label>
    <label className="block space-y-2 text-sm font-medium text-ink"><span>Versão do protocolo</span><select value={protocolVersionId} onChange={(event) => onProtocolChange(event.target.value)} disabled={protocolLocked} className="field-control"><option value="">Selecionar antes da primeira onda</option>{versions.map((version) => <option key={version.id} value={version.id}>{version.protocolName} · v{version.version}{version.label ? ` · ${version.label}` : ""}</option>)}</select></label>
    <p className="text-sm leading-6 text-slate">{protocolLocked ? "A versão está congelada porque esta coorte já possui ondas. Novas versões não alteram seu histórico." : "Após criar a primeira onda, a versão aplicada fica congelada para preservar a comparação ao longo do tempo."}</p>
    {callLocked ? <p className="text-sm leading-6 text-slate">O vínculo com o edital é preservado neste contexto.</p> : null}
    {!versions.length ? <p className="text-sm leading-6 text-slate">Ainda não há protocolos com indicadores. <Link href="/app/protocols" className="font-medium text-accent-hover underline underline-offset-4">Configure um protocolo</Link> antes da primeira onda. A criação exige perfil de administrador.</p> : null}
  </fieldset>;
}

function Field({ label, value, onChange, type = "text", required, min, max }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; min?: string; max?: string }) {
  return <label className="block space-y-2 text-sm font-medium text-ink"><span>{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} min={min} max={max} className="field-control" /></label>;
}
