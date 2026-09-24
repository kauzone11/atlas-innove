"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

import { Dialog } from "@/components/dialog";
import { CohortEditForm } from "@/components/cohort-edit-form";
import { StatusBadge, statusTone } from "@/components/ui";

type Cohort = { id: string; name: string; code: string | null; referenceYear: number | null; startsAt: string | null; endsAt: string | null; status: string };

export function CohortDetailActions({ organizationId, cohort, canManage }: { organizationId: string; cohort: Cohort; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const label = ({ PLANNED: "Planejada", ACTIVE: "Ativa", CLOSED: "Encerrada", ARCHIVED: "Arquivada" } as Record<string, string>)[cohort.status] ?? cohort.status;
  return <><StatusBadge label={label} tone={statusTone(cohort.status)} />{canManage ? <><button type="button" className="button-secondary" onClick={() => setOpen(true)}><Pencil size={16} aria-hidden="true" /> Editar</button><Dialog open={open} onClose={() => setOpen(false)} mode="sheet" title="Editar coorte" description="Atualize os dados deste ciclo de acompanhamento."><CohortEditForm organizationId={organizationId} cohort={cohort} canManage={canManage} onSuccess={() => setOpen(false)} /></Dialog></> : null}</>;
}
