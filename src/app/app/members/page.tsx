import { redirect } from "next/navigation";
import { OrganizationMembersManager } from "@/components/organization-members-manager";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { hasAtLeastRole } from "@/lib/auth/authorization";
import { PageHeader } from "@/components/ui";

export default async function MembersPage() {
  const context = await getActiveOrganizationContext();
  if (!context) redirect("/app/organizations");
  return <div><PageHeader title="Membros" description="Pessoas com acesso à instituição e seus papéis de trabalho." /><OrganizationMembersManager organizationId={context.organization.id} canManage={hasAtLeastRole(context.membership.role, "ADMIN")} /></div>;
}
