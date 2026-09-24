import { notFound, redirect } from "next/navigation";

import { VenturesManager } from "@/components/ventures-manager";
import { hasAtLeastRole } from "@/lib/auth/authorization";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { getOrganizationCohort } from "@/lib/cohorts/service";
import { listOrganizationVentures } from "@/lib/ventures/service";
import { PageHeader } from "@/components/ui";

type PageProps = { searchParams: Promise<{ cohortId?: string | string[] }> };

export default async function VenturesPage({ searchParams }: PageProps) {
  const context = await getActiveOrganizationContext();
  if (!context) redirect("/app/organizations");
  const params = await searchParams;
  const rawCohortId = params.cohortId;
  const cohortId = typeof rawCohortId === "string" ? rawCohortId : rawCohortId?.[0];
  const cohort = cohortId ? await getOrganizationCohort(context.organization.id, cohortId) : null;
  if (cohortId && !cohort) notFound();
  const ventures = await listOrganizationVentures(context.organization.id, cohortId);
  return <div><PageHeader title="Empreendimentos" /><VenturesManager organizationId={context.organization.id} ventures={ventures} canManage={hasAtLeastRole(context.membership.role, "MANAGER")} cohortFilter={cohort ? { id: cohort.id, name: cohort.name, programName: cohort.fundingProgram.name } : undefined} /></div>;
}
