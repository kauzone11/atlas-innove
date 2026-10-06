import Link from "next/link";
import { Bookmark } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { OpportunityFiltersForm } from "@/components/opportunities/filter-form";
import { OpportunityList } from "@/components/opportunities/opportunity-list";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { listPersonalOpportunities } from "@/lib/opportunities/service";
import { parseOpportunityFilters } from "@/lib/opportunities/schemas";
import { listProjects } from "@/lib/participants/service";
export default async function PersonalOpportunities({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user } = await requireAuthenticatedSession(); const filters = parseOpportunityFilters(await searchParams);
  const [opportunities, projects] = await Promise.all([listPersonalOpportunities(user.id, filters), listProjects(user.id)]);
  return <div className="min-w-0 space-y-6"><PageHeader title="Oportunidades" description="Explore chamadas e entenda sua relação com os temas do seu perfil e dos seus projetos." action={<Link className="button-secondary" href="/app/personal/opportunities/saved"><Bookmark size={16} aria-hidden="true" />Oportunidades salvas</Link>} /><OpportunityFiltersForm filters={filters} projects={projects} personal /><p className="text-xs leading-5 text-slate">Ordem: situação de inscrições, salvas, compatibilidade e prazo. A compatibilidade usa os dados atuais do seu perfil{filters.projectId ? " e do projeto escolhido" : ""}.</p><OpportunityList opportunities={opportunities} personal /><p className="text-xs leading-5 text-slate">Consulte o edital e a fonte oficial para confirmar regras e prazos.</p></div>;
}
