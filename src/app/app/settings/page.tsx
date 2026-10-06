import { redirect } from "next/navigation";
import Link from "next/link";

import { OrganizationSettingsForm } from "@/components/organization-settings-form";
import { hasAtLeastRole } from "@/lib/auth/authorization";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui";

export default async function SettingsPage() {
  const context = await getActiveOrganizationContext();
  if (!context) redirect("/app/organizations");
  return <div className="space-y-6"><PageHeader title="Configurações" /><section className="panel"><div className="panel-header"><h2>Metodologia de acompanhamento</h2><p>Defina indicadores e preserve as versões aplicadas a cada coorte.</p></div><div className="p-6"><Link href="/app/protocols" className="button-secondary">Protocolos de acompanhamento</Link></div></section><OrganizationSettingsForm organizationId={context.organization.id} initialName={context.organization.name} initialSlug={context.organization.slug} canManage={hasAtLeastRole(context.membership.role, "ADMIN")} /></div>;
}
