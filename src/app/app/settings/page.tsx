import { redirect } from "next/navigation";

import { OrganizationSettingsForm } from "@/components/organization-settings-form";
import { hasAtLeastRole } from "@/lib/auth/authorization";
import { getActiveOrganizationContext } from "@/lib/auth/session";

export default async function SettingsPage() {
  const context = await getActiveOrganizationContext();
  if (!context) redirect("/app/organizations");
  return <div className="space-y-7"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Administração</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Configurações</h1><p className="mt-3 text-slate">Atualize os dados básicos do espaço institucional ativo.</p></div><OrganizationSettingsForm organizationId={context.organization.id} initialName={context.organization.name} initialSlug={context.organization.slug} canManage={hasAtLeastRole(context.membership.role, "ADMIN")} /></div>;
}
