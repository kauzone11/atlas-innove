"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Dialog } from "@/components/dialog";
import type { FollowUpWaveDto } from "@/lib/follow-up/service";

export function FollowUpWaveManager({ organizationId, cohortId, waves, canManage }: { organizationId: string; cohortId: string; waves: FollowUpWaveDto[]; canManage: boolean }) {
  const router = useRouter();
  const defaultKind = waves.some((wave) => wave.kind === "BASELINE") ? "FOLLOW_UP" : "BASELINE";
  const defaultSequence = waves.length ? Math.max(...waves.map((wave) => wave.sequence)) + 1 : 0;
  const [name, setName] = useState("");
  const [kind, setKind] = useState(defaultKind);
  const [sequence, setSequence] = useState(defaultSequence.toString());
  const [offsetMonths, setOffsetMonths] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const nextStatus = useMemo(() => ({ PLANNED: ["OPEN", "ARCHIVED"], OPEN: ["CLOSED"], CLOSED: ["ARCHIVED"], ARCHIVED: [] } as Record<string, string[]>), []);

  async function createWave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/cohorts/${cohortId}/waves`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          kind,
          sequence,
          offsetMonths: offsetMonths || null,
          scheduledFor: toIso(scheduledFor),
          opensAt: toIso(opensAt),
          closesAt: toIso(closesAt),
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Não foi possível criar a onda.");
        return;
      }
      setName("");
      setOffsetMonths("");
      setScheduledFor("");
      setOpensAt("");
      setClosesAt("");
      if (kind === "BASELINE") {
        setKind("FOLLOW_UP");
        setSequence("1");
      } else {
        setSequence(String(Number(sequence) + 1));
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setPending(false);
    }
  }

  async function changeStatus(waveId: string, status: string) {
    setPendingStatus(`${waveId}:${status}`);
    setError(null);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/cohorts/${cohortId}/waves/${waveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Não foi possível atualizar o status da onda.");
        return;
      }
      router.refresh();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setPendingStatus(null);
    }
  }

  return (
    <section className="panel">
      <div className="panel-header"><h2>Ondas de acompanhamento</h2><p>A baseline é a sequência 0; as ondas seguintes podem seguir qualquer agenda definida pela instituição.</p></div>
      {canManage ? <div className="flex justify-end border-b border-line px-6 py-4"><button type="button" className="button-secondary" onClick={() => setOpen(true)}><Plus size={16} aria-hidden="true" /> Nova onda</button><Dialog open={open} onClose={() => setOpen(false)} title="Nova onda de acompanhamento" description="Defina o primeiro ponto ou uma nova etapa de observação."><form onSubmit={createWave} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Field id="wave-name" label="Nome" value={name} onChange={setName} required /><label htmlFor="wave-kind" className="block space-y-2 text-sm font-medium text-ink"><span>Tipo</span><select id="wave-kind" value={kind} onChange={(event) => { setKind(event.target.value); if (event.target.value === "BASELINE") setSequence("0"); else if (sequence === "0") setSequence((defaultSequence || 1).toString()); }} className="field-control"><option value="BASELINE">Baseline</option><option value="FOLLOW_UP">Follow-up</option></select></label><Field id="wave-sequence" label="Sequência" value={sequence} onChange={setSequence} type="number" min="0" required /><Field id="wave-offset" label="Distância em meses" value={offsetMonths} onChange={setOffsetMonths} type="number" min="0" /><Field id="wave-scheduled" label="Data de referência" value={scheduledFor} onChange={setScheduledFor} type="datetime-local" /><Field id="wave-opens" label="Abertura" value={opensAt} onChange={setOpensAt} type="datetime-local" /><Field id="wave-closes" label="Encerramento" value={closesAt} onChange={setClosesAt} type="datetime-local" /></div>{error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}<button disabled={pending} className="button-primary w-full">{pending ? "Salvando…" : "Criar onda"}</button></form></Dialog></div> : null}
      {waves.length ? (
        <ol className="divide-y divide-line">
          {waves.map((wave) => (
            <li key={wave.id} className="px-6 py-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate">{wave.kind === "BASELINE" ? "Baseline" : `Onda ${wave.sequence}`}</p>
                  <h3 className="mt-1 font-medium text-ink">{wave.name}</h3>
                  <p className="mt-1 text-sm text-slate">{timing(wave)}{wave.offsetMonths !== null ? ` · ${wave.offsetMonths} ${wave.offsetMonths === 1 ? "mês" : "meses"}` : ""}</p>
                </div>
                <span className={`status-badge ${wave.status === "OPEN" ? "status-success" : "status-neutral"}`}>{statusLabel(wave.status)}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate">
                <span>{wave.observationCounts.expected} esperada(s)</span>
                {wave.observationCounts.pending ? <span>{wave.observationCounts.pending} pendente(s)</span> : null}
                {wave.observationCounts.inProgress ? <span>{wave.observationCounts.inProgress} em andamento</span> : null}
                {wave.observationCounts.submitted ? <span>{wave.observationCounts.submitted} enviada(s)</span> : null}
                {wave.observationCounts.missed ? <span>{wave.observationCounts.missed} não respondida(s)</span> : null}
              </div>
              {canManage && nextStatus[wave.status]?.length ? <div className="mt-4 flex flex-wrap gap-2">{nextStatus[wave.status].map((status) => <button key={status} type="button" onClick={() => void changeStatus(wave.id, status)} disabled={pendingStatus !== null} className="button-secondary min-h-9 px-3 text-xs">{pendingStatus === `${wave.id}:${status}` ? "Salvando…" : actionLabel(status)}</button>)}</div> : null}
            </li>
          ))}
        </ol>
      ) : <p className="px-6 py-10 text-sm text-slate">Nenhuma onda definida. Crie a baseline para estabelecer o primeiro ponto de observação.</p>}
    </section>
  );
}

function Field({ id, label, value, onChange, type = "text", required, min }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; min?: string }) {
  return <label htmlFor={id} className="block space-y-2 text-sm font-medium text-ink"><span>{label}</span><input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} min={min} className="field-control" /></label>;
}

function toIso(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function timing(wave: FollowUpWaveDto): string {
  if (wave.scheduledFor) return `Referência em ${formatDate(wave.scheduledFor)}`;
  if (wave.opensAt || wave.closesAt) return `${wave.opensAt ? formatDate(wave.opensAt) : "Sem abertura"} – ${wave.closesAt ? formatDate(wave.closesAt) : "sem encerramento"}`;
  return "Timing não informado";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

function statusLabel(status: string): string {
  return ({ PLANNED: "Planejada", OPEN: "Aberta", CLOSED: "Encerrada", ARCHIVED: "Arquivada" } as Record<string, string>)[status] ?? status;
}

function actionLabel(status: string): string {
  return ({ OPEN: "Abrir onda", CLOSED: "Encerrar onda", ARCHIVED: "Arquivar onda" } as Record<string, string>)[status] ?? status;
}
