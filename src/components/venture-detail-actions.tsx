"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

import { Dialog } from "@/components/dialog";
import { VentureEditForm } from "@/components/venture-edit-form";
import { StatusBadge } from "@/components/ui";
import type { VentureDto } from "@/lib/ventures/service";

export function VentureDetailActions({ organizationId, venture, canManage }: { organizationId: string; venture: VentureDto; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  return <><StatusBadge label={`${venture.enrollments.length} ${venture.enrollments.length === 1 ? "participação" : "participações"}`} tone="neutral" />{canManage ? <><button type="button" className="button-secondary" onClick={() => setOpen(true)}><Pencil size={16} aria-hidden="true" /> Editar</button><Dialog open={open} onClose={() => setOpen(false)} mode="sheet" title="Editar empreendimento" description="Atualize apenas a identidade estável desta entidade."><VentureEditForm organizationId={organizationId} venture={venture} canManage={canManage} onSuccess={() => setOpen(false)} /></Dialog></> : null}</>;
}
