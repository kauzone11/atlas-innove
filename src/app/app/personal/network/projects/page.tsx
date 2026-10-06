import { Breadcrumbs, PageHeader } from "@/components/ui";
import { ProjectDiscoveryFiltersForm } from "@/components/network/discovery-filters";
import { DiscoveryPagination, ProjectDiscoveryList } from "@/components/network/discovery-list";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { listDiscoverableProjects } from "@/lib/network/projects";
import { parseProjectDiscoveryFilters } from "@/lib/network/discovery-schemas";

export default async function NetworkProjects({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user } = await requireAuthenticatedSession();
  const filters = parseProjectDiscoveryFilters(await searchParams);
  const directory = await listDiscoverableProjects(user.id, filters);
  return <div className="min-w-0 space-y-6"><PageHeader title="Projetos na Rede" description="Conheça iniciativas e encontre projetos aos quais você pode contribuir." breadcrumbs={<Breadcrumbs items={[{ label: "Rede", href: "/app/personal/network" }, { label: "Projetos" }]} />} /><ProjectDiscoveryFiltersForm filters={filters} /><ProjectDiscoveryList projects={directory.projects} /><DiscoveryPagination path="/app/personal/network/projects" filters={filters} page={directory.page} hasNext={directory.hasNext} /></div>;
}
