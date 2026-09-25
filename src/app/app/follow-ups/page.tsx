import { redirect } from "next/navigation";

import { FollowUpsManager } from "@/components/follow-ups-manager";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { getOrganizationDashboard } from "@/lib/dashboard/service";
import { PageHeader } from "@/components/ui";

export default async function FollowUpsPage() {
  const context = await getActiveOrganizationContext();
  if (!context) redirect("/app/organizations");
  const dashboard = await getOrganizationDashboard(context.organization.id);
  return <div><PageHeader title="Acompanhamentos" description="Organize ondas, respostas e pendências do acompanhamento longitudinal." /><FollowUpsManager queue={dashboard.queue} coverage={dashboard.metrics.coverage} /></div>;
}
