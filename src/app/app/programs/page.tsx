import { redirect } from "next/navigation";

import { ProgramsManager } from "@/components/programs-manager";
import { hasAtLeastRole } from "@/lib/auth/authorization";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { listOrganizationPrograms } from "@/lib/programs/service";
import { PageHeader } from "@/components/ui";

export default async function ProgramsPage() {
  const context = await getActiveOrganizationContext();
  if (!context) redirect("/app/organizations");
  const programs = await listOrganizationPrograms(context.organization.id);
  return <div><PageHeader title="Programas" description="Organize as iniciativas de apoio desta organização." /><ProgramsManager organizationId={context.organization.id} programs={programs} canManage={hasAtLeastRole(context.membership.role, "MANAGER")} /></div>;
}
