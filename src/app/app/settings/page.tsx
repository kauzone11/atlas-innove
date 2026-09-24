import { redirect } from "next/navigation";

import { OrganizationSettingsForm } from "@/components/organization-settings-form";
import { hasAtLeastRole } from "@/lib/auth/authorization";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui";

export default async function SettingsPage() {
  const context = await getActiveOrganizationContext();
  if (!context) redirect("/app/organizations");
  return <div><PageHeader title="Configurações" description="Atualize os dados básicos do espaço institucional ativo." /><OrganizationSettingsForm organizationId={context.organization.id} initialName={context.organization.name} initialSlug={context.organization.slug} canManage={hasAtLeastRole(context.membership.role, "ADMIN")} /></div>;
}
