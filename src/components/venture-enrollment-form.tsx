"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Dialog } from "@/components/dialog";
import type { CohortDto } from "@/lib/cohorts/service";
import type { VentureDto } from "@/lib/ventures/service";

export function VentureEnrollmentForm({ organizationId, venture, cohorts, canManage }: { organizationId: string; venture: VentureDto; cohorts: CohortDto[]; canManage: boolean }) {
  const router = useRouter();
  const [cohortId, setCohortId] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const availableCohorts = useMemo(() => cohorts.filter((cohort) => (cohort.status === "PLANNED" || cohort.status === "ACTIVE") && !venture.enrollments.some((enrollment) => enrollment.cohort.id === cohort.id)), [cohorts, venture.enrollments]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(null); setNotice(null);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/cohorts/${cohortId}/enrollments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ventureId: venture.id, externalReference: externalReference || null }) });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) { setError(payload.error ?? "Não foi possível registrar a participação."); return; }
      setCohortId(""); setExternalReference(""); setNotice("Participação registrada."); setOpen(false); router.refresh();
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }

  if (!canManage) return null;
  return <div className="flex flex-wrap items-center justify-between gap-3 border-y border-line py-3"><div><p className="text-sm font-medium text-ink">Participação em coorte</p><p className="mt-1 text-sm text-slate">A participação é registrada separadamente da identidade.</p></div>{availableCohorts.length ? <><button type="button" className="button-secondary" onClick={() => setOpen(true)}><Plus size={16} aria-hidden="true" /> Registrar participação</button><Dialog open={open} onClose={() => setOpen(false)} title="Registrar participação" description="Escolha uma coorte para registrar esta entidade."><form onSubmit={submit} className="space-y-5"><label className="block space-y-2 text-sm font-medium text-ink"><span>Coorte</span><select required value={cohortId} onChange={(event) => setCohortId(event.target.value)} className="field-control"><option value="">Selecione uma coorte</option>{availableCohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name} · {cohort.fundingProgram.name}</option>)}</select></label><label className="block space-y-2 text-sm font-medium text-ink"><span>Referência nesta participação</span><input value={externalReference} onChange={(event) => setExternalReference(event.target.value)} className="field-control" /></label>{notice ? <p className="text-sm text-success" role="status">{notice}</p> : null}{error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}<button disabled={pending} className="button-primary w-full">{pending ? "Salvando…" : "Registrar"}</button></form></Dialog></> : <p className="text-sm text-slate">Não há coortes elegíveis.</p>}{notice && !open ? <p className="basis-full text-sm text-success" role="status">{notice}</p> : null}{error && !open ? <p className="basis-full text-sm text-danger" role="alert">{error}</p> : null}</div>;
}
