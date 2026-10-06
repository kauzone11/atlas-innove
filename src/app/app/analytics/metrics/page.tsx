import { redirect } from "next/navigation";
import { MetricManager } from "@/components/analytics/metric-manager";
import { Breadcrumbs, PageHeader } from "@/components/ui";
import { hasAtLeastRole } from "@/lib/auth/authorization";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { listMetrics } from "@/lib/analytics/metrics";

export default async function MetricsPage() {
  const context = await getActiveOrganizationContext();
  if (!context) redirect("/app/organizations");
  if (!hasAtLeastRole(context.membership.role, "ANALYST")) redirect("/app/analytics");
  const data = await listMetrics({ organizationId: context.organization.id, userId: context.auth.user.id, role: context.membership.role });
  return <div className="space-y-6"><PageHeader title="Métricas analíticas" description="Identidades estáveis para comparar valores entre versões de protocolo e coortes." breadcrumbs={<Breadcrumbs items={[{ label: "Análises", href: "/app/analytics" }, { label: "Métricas" }]} />} /><MetricManager organizationId={context.organization.id} {...data} canManage={hasAtLeastRole(context.membership.role, "MANAGER")} /></div>;
}
