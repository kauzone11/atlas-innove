import { redirect } from "next/navigation";

import { TrackingProtocolManager } from "@/components/tracking-protocol-manager";
import { Breadcrumbs, PageHeader } from "@/components/ui";
import { hasAtLeastRole } from "@/lib/auth/authorization";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { listTrackingProtocols } from "@/lib/tracking-protocols/service";

export default async function ProtocolsPage() {
  const context = await getActiveOrganizationContext();
  if (!context) redirect("/app/organizations");
  const protocols = await listTrackingProtocols(context.organization.id);
  return <div className="space-y-6"><PageHeader title="Protocolos de acompanhamento" description="Uma metodologia estável para acompanhar cada coorte ao longo do tempo." breadcrumbs={<Breadcrumbs items={[{ label: "Acompanhamentos", href: "/app/follow-ups" }, { label: "Protocolos" }]} />} /><TrackingProtocolManager organizationId={context.organization.id} protocols={protocols} canManage={hasAtLeastRole(context.membership.role, "ADMIN")} /></div>;
}
