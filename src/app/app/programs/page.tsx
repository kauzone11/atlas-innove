import { redirect } from "next/navigation";

import { ProgramsManager } from "@/components/programs-manager";
import { hasAtLeastRole } from "@/lib/auth/authorization";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { listOrganizationPrograms } from "@/lib/programs/service";

export default async function ProgramsPage() {
  const context = await getActiveOrganizationContext();
  if (!context) redirect("/app/organizations");
  const programs = await listOrganizationPrograms(context.organization.id);
  return <div className="space-y-7"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Estrutura de apoio</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Programas</h1><p className="mt-3 max-w-2xl text-slate">Registre políticas, mecanismos de financiamento e iniciativas institucionais de apoio à inovação.</p></div><ProgramsManager organizationId={context.organization.id} programs={programs} canManage={hasAtLeastRole(context.membership.role, "MANAGER")} /></div>;
}
