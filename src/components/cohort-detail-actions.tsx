"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

import { Dialog } from "@/components/dialog";
import { CohortEditForm, type EditableCohort } from "@/components/cohort-edit-form";
import type { CohortFundingCallChoice, CohortProtocolChoice } from "@/components/cohort-create-form";
import { StatusBadge, statusTone } from "@/components/ui";

export function CohortDetailActions({ organizationId, cohort, canManage, fundingCalls = [], protocols = [] }: { organizationId: string; cohort: EditableCohort; canManage: boolean; fundingCalls?: CohortFundingCallChoice[]; protocols?: CohortProtocolChoice[] }) {
  const [open, setOpen] = useState(false);
  const label = ({ PLANNED: "Planejada", ACTIVE: "Ativa", CLOSED: "Encerrada", ARCHIVED: "Arquivada" } as Record<string, string>)[cohort.status] ?? cohort.status;
  return <><StatusBadge label={label} tone={statusTone(cohort.status)} />{canManage && cohort.status !== "ARCHIVED" ? <><button type="button" className="button-secondary" onClick={() => setOpen(true)}><Pencil size={16} aria-hidden="true" /> Editar</button><Dialog open={open} onClose={() => setOpen(false)} mode="sheet" title="Editar coorte" description="Atualize os dados deste ciclo de acompanhamento."><CohortEditForm organizationId={organizationId} cohort={cohort} canManage={canManage} fundingCalls={fundingCalls} protocols={protocols} onSuccess={() => setOpen(false)} /></Dialog></> : null}</>;
}
