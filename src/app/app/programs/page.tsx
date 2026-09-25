import { redirect } from "next/navigation";

import { ProgramsManager } from "@/components/programs-manager";
import { hasAtLeastRole } from "@/lib/auth/authorization";
import { getOrganizationDashboard } from "@/lib/dashboard/service";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui";

export default async function ProgramsPage() {
  const context = await getActiveOrganizationContext();
  if (!context) redirect("/app/organizations");
  const dashboard = await getOrganizationDashboard(context.organization.id);
  const canManage = hasAtLeastRole(context.membership.role, "MANAGER");
  return <div><PageHeader title="Programas" description="Organize iniciativas, coortes e marcos de execução." /><ProgramsManager organizationId={context.organization.id} programs={dashboard.programs} canManage={canManage} /></div>;
}
