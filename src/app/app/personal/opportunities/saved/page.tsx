import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { OpportunityList } from "@/components/opportunities/opportunity-list";
import { SaveOpportunityButton } from "@/components/opportunities/save-button";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { listSavedOpportunities } from "@/lib/opportunities/service";
export default async function SavedOpportunitiesPage() {
  const { user } = await requireAuthenticatedSession(); const saved = await listSavedOpportunities(user.id);
  const opportunities = saved.flatMap((entry) => entry.opportunity ? [entry.opportunity] : []);
  return <div className="min-w-0 space-y-6"><PageHeader title="Oportunidades salvas" description="Sua lista privada. Chamadas encerradas permanecem aqui para consulta." action={<Link className="button-secondary" href="/app/personal/opportunities">Explorar oportunidades</Link>} />{saved.length ? <>{opportunities.length ? <OpportunityList opportunities={opportunities} personal /> : null}{saved.filter((entry) => !entry.opportunity).map((entry) => <div key={`${entry.kind}-${entry.id}`} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-5"><div><h2 className="text-sm font-medium">Oportunidade indisponível</h2><p className="mt-1 text-xs leading-5 text-slate">O registro salvo foi preservado. Suas informações deixaram de estar disponíveis publicamente.</p></div><SaveOpportunityButton id={entry.id} kind={entry.kind} saved /></div>)}</> : <div className="border-y border-line py-10"><h2 className="text-lg font-semibold">Sua lista começa com uma oportunidade</h2><p className="mt-2 text-sm text-slate">Explore as chamadas e use Salvar para retomá-las depois.</p></div>}<p className="text-xs leading-5 text-slate">Sua lista é privada e apresenta até 1.000 registros salvos de cada fonte.</p></div>;
}
