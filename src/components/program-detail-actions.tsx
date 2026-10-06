"use client";

import { Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { Dialog } from "@/components/dialog";
import { CohortCreateForm, type CohortFundingCallChoice, type CohortProtocolChoice } from "@/components/cohort-create-form";
import { FundingCallForm } from "@/components/funding-call-form";
import { ProgramEditForm } from "@/components/program-edit-form";
import { StatusBadge, statusTone } from "@/components/ui";
import type { FundingProgramDetailsDto } from "@/lib/programs/service";

export function ProgramDetailActions({ organizationId, program, canManage, fundingCalls = [], protocols = [] }: { organizationId: string; program: FundingProgramDetailsDto; canManage: boolean; fundingCalls?: CohortFundingCallChoice[]; protocols?: CohortProtocolChoice[] }) {
  const [editOpen, setEditOpen] = useState(false);
  const [cohortOpen, setCohortOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const label = ({ DRAFT: "Rascunho", ACTIVE: "Ativo", CLOSED: "Encerrado", ARCHIVED: "Arquivado", PLANNED: "Planejada" } as Record<string, string>)[program.status] ?? program.status;
  const canCreate = ["DRAFT", "ACTIVE"].includes(program.status);
  return <><StatusBadge label={label} tone={statusTone(program.status)} />{canManage && program.status !== "ARCHIVED" ? <><button type="button" className="button-secondary" onClick={() => setEditOpen(true)}><Pencil size={16} aria-hidden="true" /> Editar</button><Dialog open={editOpen} onClose={() => setEditOpen(false)} mode="sheet" title="Editar programa" description="Atualize os dados deste programa sem perder suas coortes."><ProgramEditForm organizationId={organizationId} program={program} canManage={canManage} onSuccess={() => setEditOpen(false)} /></Dialog></> : null}{canManage && canCreate ? <><button type="button" className="button-secondary" onClick={() => setCohortOpen(true)}><Plus size={16} aria-hidden="true" /> Nova coorte</button><button type="button" className="button-primary" onClick={() => setCallOpen(true)}><Plus size={16} aria-hidden="true" /> Novo edital</button><Dialog open={callOpen} onClose={() => setCallOpen(false)} mode="sheet" title="Novo edital" description="Registre uma chamada específica deste programa."><FundingCallForm organizationId={organizationId} programId={program.id} onSuccess={() => setCallOpen(false)} /></Dialog><Dialog open={cohortOpen} onClose={() => setCohortOpen(false)} mode="sheet" title="Nova coorte" description="Crie um grupo comparável para acompanhar empreendimentos."><CohortCreateForm organizationId={organizationId} programId={program.id} fundingCalls={fundingCalls} protocols={protocols} onSuccess={() => setCohortOpen(false)} /></Dialog></> : null}</>;
}
