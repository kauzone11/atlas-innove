"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import type { CohortWorkspaceEnrollmentDto } from "@/lib/follow-up/service";
import { Dialog } from "@/components/dialog";

type AvailableVenture = { id: string; name: string; kind: string };

export function CohortEnrollmentManager({ organizationId, cohortId, enrollments, availableVentures, canManage }: { organizationId: string; cohortId: string; enrollments: CohortWorkspaceEnrollmentDto[]; availableVentures: AvailableVenture[]; canManage: boolean }) {
  const router = useRouter();
  const [ventureId, setVentureId] = useState(availableVentures[0]?.id ?? "");
  const [externalReference, setExternalReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);

  async function createEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/cohorts/${cohortId}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ventureId, externalReference: externalReference || null }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Não foi possível registrar a participação.");
        return;
      }
      setExternalReference("");
      setNotice("Participação registrada e observações pendentes provisionadas quando aplicável.");
      setOpen(false);
      router.refresh();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setCreating(false);
    }
  }

  async function withdraw(enrollmentId: string, ventureName: string) {
    if (!window.confirm(`Retirar ${ventureName} desta coorte? O histórico da participação será preservado.`)) return;
    setPendingId(enrollmentId);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/cohorts/${cohortId}/enrollments/${enrollmentId}/withdraw`, { method: "POST" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Não foi possível retirar a participação.");
        return;
      }
      setNotice("Participação retirada. O histórico foi preservado.");
      router.refresh();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="panel">
      <div className="panel-header"><h2>Empreendimentos inscritos</h2><p>A participação pode ser retirada sem apagar seu histórico.</p></div>
      {canManage && availableVentures.length ? <div className="flex justify-end border-b border-line px-6 py-4"><button type="button" className="button-secondary" onClick={() => setOpen(true)}><Plus size={16} aria-hidden="true" /> Adicionar empreendimento</button><Dialog open={open} onClose={() => setOpen(false)} title="Adicionar empreendimento" description="Registre uma participação nesta coorte sem alterar a identidade da entidade."><form onSubmit={createEnrollment} className="space-y-5"><label htmlFor="cohort-venture" className="block space-y-2 text-sm font-medium text-ink"><span>Empreendimento</span><select id="cohort-venture" required value={ventureId} onChange={(event) => setVentureId(event.target.value)} className="field-control"><option value="">Selecione um empreendimento</option>{availableVentures.map((venture) => <option key={venture.id} value={venture.id}>{venture.name} · {kindLabel(venture.kind)}</option>)}</select></label><label htmlFor="cohort-venture-reference" className="block space-y-2 text-sm font-medium text-ink"><span>Referência nesta participação</span><input id="cohort-venture-reference" value={externalReference} onChange={(event) => setExternalReference(event.target.value)} className="field-control" /></label>{error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}<button disabled={creating || !ventureId} className="button-primary w-full">{creating ? "Salvando…" : "Adicionar"}</button></form></Dialog></div> : canManage ? <p className="border-b border-line px-6 py-5 text-sm text-slate">Todos os empreendimentos ativos da organização já estão registrados ou não há entidades disponíveis.</p> : null}
      {enrollments.length ? (
        <div className="divide-y divide-line">
          {enrollments.map((enrollment) => (
            <div key={enrollment.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <Link href={`/app/ventures/${enrollment.venture.id}`} className="font-medium text-ink hover:text-accent-hover">{enrollment.venture.name}</Link>
                <p className="mt-1 text-sm text-slate">{kindLabel(enrollment.venture.kind)} · entrada em {formatDate(enrollment.enrolledAt)}{enrollment.externalReference ? ` · ${enrollment.externalReference}` : ""}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`status-badge ${enrollment.status === "ACTIVE" ? "status-success" : "status-neutral"}`}>{enrollment.status === "ACTIVE" ? "Ativa" : "Retirada"}</span>
                {canManage && enrollment.status === "ACTIVE" ? <button type="button" onClick={() => void withdraw(enrollment.id, enrollment.venture.name)} disabled={pendingId === enrollment.id} className="button-secondary min-h-9 px-3 text-xs">{pendingId === enrollment.id ? "Salvando…" : "Retirar"}</button> : null}
              </div>
            </div>
          ))}
        </div>
      ) : <p className="px-6 py-10 text-sm text-slate">Nenhum empreendimento inscrito nesta coorte.</p>}
      {notice ? <p className="border-t border-line px-6 py-4 text-sm text-success" role="status">{notice}</p> : null}
      {error ? <p className="border-t border-line px-6 py-4 text-sm text-danger" role="alert">{error}</p> : null}
    </section>
  );
}

function kindLabel(kind: string): string {
  return ({ COMPANY: "Empresa", PROJECT: "Projeto tecnológico", INITIATIVE: "Iniciativa", OTHER: "Outro" } as Record<string, string>)[kind] ?? kind;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}
