"use client";

import { Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { Dialog } from "@/components/dialog";
import { CohortCreateForm } from "@/components/cohort-create-form";
import { ProgramEditForm } from "@/components/program-edit-form";
import { StatusBadge, statusTone } from "@/components/ui";
import type { FundingProgramDetailsDto } from "@/lib/programs/service";

export function ProgramDetailActions({ organizationId, program, canManage }: { organizationId: string; program: FundingProgramDetailsDto; canManage: boolean }) {
  const [editOpen, setEditOpen] = useState(false);
  const [cohortOpen, setCohortOpen] = useState(false);
  const label = ({ DRAFT: "Rascunho", ACTIVE: "Ativo", CLOSED: "Encerrado", ARCHIVED: "Arquivado", PLANNED: "Planejada" } as Record<string, string>)[program.status] ?? program.status;
  return <><StatusBadge label={label} tone={statusTone(program.status)} />{canManage ? <><button type="button" className="button-secondary" onClick={() => setEditOpen(true)}><Pencil size={16} aria-hidden="true" /> Editar</button><button type="button" className="button-primary" onClick={() => setCohortOpen(true)}><Plus size={16} aria-hidden="true" /> Nova coorte</button><Dialog open={editOpen} onClose={() => setEditOpen(false)} mode="sheet" title="Editar programa" description="Atualize os dados deste programa sem perder suas coortes."><ProgramEditForm organizationId={organizationId} program={program} canManage={canManage} onSuccess={() => setEditOpen(false)} /></Dialog><Dialog open={cohortOpen} onClose={() => setCohortOpen(false)} title="Nova coorte" description="Crie um ciclo de entrada para acompanhar empreendimentos."><CohortCreateForm organizationId={organizationId} programId={program.id} onSuccess={() => setCohortOpen(false)} /></Dialog></> : null}</>;
}
