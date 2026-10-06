import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell";
import { PageHeader } from "@/components/ui";
import { OpportunityFiltersForm } from "@/components/opportunities/filter-form";
import { OpportunityList } from "@/components/opportunities/opportunity-list";
import { listPublicOpportunities } from "@/lib/opportunities/service";
import { parseOpportunityFilters } from "@/lib/opportunities/schemas";
export const metadata: Metadata = { title: "Oportunidades | Atlas Innove", description: "Editais e oportunidades de inovação publicados pelas instituições, com fonte oficial, território e áreas temáticas.", alternates: { canonical: "/opportunities" } };
export default async function PublicOpportunitiesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseOpportunityFilters(await searchParams); const opportunities = await listPublicOpportunities(filters);
  return <PublicShell><div className="min-w-0 space-y-6"><PageHeader title="Oportunidades de inovação" description="Chamadas publicadas por instituições e fontes externas para apoiar projetos e novas iniciativas." /><OpportunityFiltersForm filters={filters} /><OpportunityList opportunities={opportunities} /><p className="text-xs leading-5 text-slate">Consulte o edital e a fonte oficial para confirmar regras e prazos.</p></div></PublicShell>;
}
