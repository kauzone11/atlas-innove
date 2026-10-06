import Link from "next/link";
import { Breadcrumbs, PageHeader } from "@/components/ui";
import { PeopleDiscoveryFiltersForm } from "@/components/network/discovery-filters";
import { DiscoveryPagination, PeopleDiscoveryList } from "@/components/network/discovery-list";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { listDiscoverablePeople } from "@/lib/network/people";
import { parsePeopleDiscoveryFilters } from "@/lib/network/discovery-schemas";
import { listProjects } from "@/lib/participants/service";

export default async function NetworkPeople({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user } = await requireAuthenticatedSession();
  const filters = parsePeopleDiscoveryFilters(await searchParams);
  const [directory, projects] = await Promise.all([listDiscoverablePeople(user.id, filters), listProjects(user.id)]);
  return <div className="min-w-0 space-y-6"><PageHeader title="Pessoas" description="Encontre pessoas que escolheram compartilhar sua atuação e conversar sobre colaboração." breadcrumbs={<Breadcrumbs items={[{ label: "Rede", href: "/app/personal/network" }, { label: "Pessoas" }]} />} action={<Link className="button-secondary" href="/app/personal/profile">Minha descoberta</Link>} /><PeopleDiscoveryFiltersForm filters={filters} projects={projects.filter((project) => !project.archivedAt && project.status !== "ARCHIVED")} /><PeopleDiscoveryList people={directory.people} /><DiscoveryPagination path="/app/personal/network/people" filters={filters} page={directory.page} hasNext={directory.hasNext} /></div>;
}
