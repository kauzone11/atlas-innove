"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import type { CohortWorkspaceEnrollmentDto } from "@/lib/follow-up/service";

type AvailableVenture = { id: string; name: string; kind: string };

export function CohortEnrollmentManager({ organizationId, cohortId, enrollments, availableVentures, canManage }: { organizationId: string; cohortId: string; enrollments: CohortWorkspaceEnrollmentDto[]; availableVentures: AvailableVenture[]; canManage: boolean }) {
  const router = useRouter();
  const [ventureId, setVentureId] = useState(availableVentures[0]?.id ?? "");
  const [externalReference, setExternalReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

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
      {canManage && availableVentures.length ? (
        <form onSubmit={createEnrollment} className="border-b border-line px-6 py-5">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <label htmlFor="cohort-venture" className="block space-y-2 text-sm font-medium text-ink">
              <span>Adicionar empreendimento</span>
              <select id="cohort-venture" required value={ventureId} onChange={(event) => setVentureId(event.target.value)} className="field-control">
                <option value="">Selecione um empreendimento</option>
                {availableVentures.map((venture) => <option key={venture.id} value={venture.id}>{venture.name} · {kindLabel(venture.kind)}</option>)}
              </select>
            </label>
            <label htmlFor="cohort-venture-reference" className="block space-y-2 text-sm font-medium text-ink">
              <span>Referência nesta participação</span>
              <input id="cohort-venture-reference" value={externalReference} onChange={(event) => setExternalReference(event.target.value)} className="field-control" />
            </label>
            <button disabled={creating || !ventureId} className="button-primary">{creating ? "Salvando…" : "Adicionar"}</button>
          </div>
        </form>
      ) : canManage ? <p className="border-b border-line px-6 py-5 text-sm text-slate">Todos os empreendimentos ativos da organização já estão registrados ou não há entidades disponíveis.</p> : null}
      {enrollments.length ? (
        <div className="divide-y divide-line">
          {enrollments.map((enrollment) => (
            <div key={enrollment.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <Link href={`/app/ventures/${enrollment.venture.id}`} className="font-medium text-ink hover:text-brand">{enrollment.venture.name}</Link>
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
      {notice ? <p className="border-t border-line px-6 py-4 text-sm text-emerald-800" role="status">{notice}</p> : null}
      {error ? <p className="border-t border-line px-6 py-4 text-sm text-red-800" role="alert">{error}</p> : null}
    </section>
  );
}

function kindLabel(kind: string): string {
  return ({ COMPANY: "Empresa", PROJECT: "Projeto tecnológico", INITIATIVE: "Iniciativa", OTHER: "Outro" } as Record<string, string>)[kind] ?? kind;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}
