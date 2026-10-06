import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ObservationEditor } from "@/components/observation-editor";
import { Breadcrumbs, PageHeader } from "@/components/ui";
import { hasAtLeastRole } from "@/lib/auth/authorization";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { getObservationWorkspace } from "@/lib/observations/service";

type PageProps = { params: Promise<{ observationId: string }> };

export default async function ObservationPage({ params }: PageProps) {
  const context = await getActiveOrganizationContext();
  if (!context) redirect("/app/organizations");
  const { observationId } = await params;
  const observation = await getObservationWorkspace(context.organization.id, observationId);
  if (!observation) notFound();
  const cohortHref = `/app/programs/${observation.cohort.fundingProgram.id}/cohorts/${observation.cohort.id}`;
  return <div className="space-y-6"><PageHeader title={observation.venture.name} description={`${observation.wave.name} · referência em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(observation.wave.referenceAt))}`} breadcrumbs={<Breadcrumbs items={[{ label: "Programas", href: "/app/programs" }, { label: observation.cohort.fundingProgram.name, href: `/app/programs/${observation.cohort.fundingProgram.id}` }, { label: observation.cohort.name, href: cohortHref }, { label: "Observação" }]} />} action={<Link className="button-secondary" href={`/app/ventures/${observation.venture.id}`}>Ver trajetória</Link>} /><ObservationEditor observation={observation} canManage={hasAtLeastRole(context.membership.role, "MANAGER")} /></div>;
}
