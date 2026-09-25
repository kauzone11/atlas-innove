import { redirect } from "next/navigation";

import { TeamManager } from "@/components/team-manager";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { hasAtLeastRole } from "@/lib/auth/authorization";
import { PageHeader } from "@/components/ui";

export default async function TeamPage() {
  const context = await getActiveOrganizationContext();
  if (!context) redirect("/app/organizations");
  return <div><PageHeader title="Equipe" description="Pessoas, papéis e acesso ao espaço institucional." /><TeamManager organizationId={context.organization.id} canManage={hasAtLeastRole(context.membership.role, "ADMIN")} /></div>;
}
