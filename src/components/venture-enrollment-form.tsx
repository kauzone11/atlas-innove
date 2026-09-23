"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { CohortDto } from "@/lib/cohorts/service";
import type { VentureDto } from "@/lib/ventures/service";

export function VentureEnrollmentForm({ organizationId, venture, cohorts, canManage }: { organizationId: string; venture: VentureDto; cohorts: CohortDto[]; canManage: boolean }) {
  const router = useRouter();
  const [cohortId, setCohortId] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const availableCohorts = useMemo(() => cohorts.filter((cohort) => (cohort.status === "PLANNED" || cohort.status === "ACTIVE") && !venture.enrollments.some((enrollment) => enrollment.cohort.id === cohort.id)), [cohorts, venture.enrollments]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(null); setNotice(null);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/cohorts/${cohortId}/enrollments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ventureId: venture.id, externalReference: externalReference || null }) });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) { setError(payload.error ?? "Não foi possível registrar a participação."); return; }
      setCohortId(""); setExternalReference(""); setNotice("Participação registrada."); router.refresh();
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }

  if (!canManage) return null;
  return <form onSubmit={submit} className="rounded-2xl border border-line bg-white p-6 shadow-panel"><h2 className="font-semibold text-ink">Registrar em uma coorte</h2><p className="mt-1 text-sm text-slate">A participação é registrada separadamente da identidade do empreendimento.</p>{availableCohorts.length ? <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end"><label className="block space-y-2 text-sm font-medium text-ink"><span>Coorte</span><select required value={cohortId} onChange={(event) => setCohortId(event.target.value)} className="w-full rounded-lg border border-line px-3 py-2.5"><option value="">Selecione uma coorte</option>{availableCohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name} · {cohort.fundingProgram.name}</option>)}</select></label><label className="block space-y-2 text-sm font-medium text-ink"><span>Referência nesta participação</span><input value={externalReference} onChange={(event) => setExternalReference(event.target.value)} className="w-full rounded-lg border border-line px-3 py-2.5" /></label><button disabled={pending} className="rounded-lg bg-accent px-4 py-2.5 font-semibold text-white hover:bg-accent-dark disabled:opacity-60">{pending ? "Salvando…" : "Registrar"}</button></div> : <p className="mt-5 text-sm text-slate">Não há coortes elegíveis para este empreendimento.</p>}{notice ? <p className="mt-4 text-sm text-emerald-800" role="status">{notice}</p> : null}{error ? <p className="mt-4 text-sm text-red-800" role="alert">{error}</p> : null}</form>;
}
