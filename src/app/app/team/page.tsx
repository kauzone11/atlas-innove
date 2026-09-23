import { redirect } from "next/navigation";

import { TeamManager } from "@/components/team-manager";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { hasAtLeastRole } from "@/lib/auth/authorization";

export default async function TeamPage() {
  const context = await getActiveOrganizationContext();
  if (!context) redirect("/app/organizations");
  return <div className="space-y-7"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Administração</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Equipe</h1><p className="mt-3 text-slate">Gerencie quem pode acessar {context.organization.name} e com qual papel.</p></div><TeamManager organizationId={context.organization.id} canManage={hasAtLeastRole(context.membership.role, "ADMIN")} /></div>;
}
