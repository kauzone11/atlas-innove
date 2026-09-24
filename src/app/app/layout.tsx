import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getAuthenticatedSession } from "@/lib/auth/session";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const auth = await getAuthenticatedSession();
  if (!auth) {
    redirect("/login");
  }
  const activeOrganization = auth.memberships.find(
    (membership) => membership.organizationId === auth.session.activeOrganizationId,
  ) ?? (auth.memberships.length === 1 ? auth.memberships[0] : null);

  return <AppShell organizationName={activeOrganization?.organization.name} userName={auth.user.profile?.fullName ?? auth.user.email} hasOrganization={Boolean(activeOrganization)}>{children}</AppShell>;
}
