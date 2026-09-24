import { redirect } from "next/navigation";

import { OrganizationSelector } from "@/components/organization-selector";
import { ROLE_LABELS } from "@/lib/domain";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { PageHeader, Panel } from "@/components/ui";

export default async function OrganizationsPage() {
  const auth = await getAuthenticatedSession();
  if (!auth) {
    redirect("/login");
  }
  const organizations = auth.memberships.map((membership) => ({
    id: membership.organizationId,
    name: membership.organization.name,
    role: ROLE_LABELS[membership.role],
  }));

  return (
    <div className="max-w-3xl">
      <PageHeader title="Organizações" />
      {organizations.length ? <OrganizationSelector organizations={organizations} activeId={auth.session.activeOrganizationId} /> : <Panel className="p-6 text-sm text-slate">Sua conta ainda não possui uma organização ativa.</Panel>}
    </div>
  );
}
