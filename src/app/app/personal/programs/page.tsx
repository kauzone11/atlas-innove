import Link from "next/link";
import { PageHeader, Panel } from "@/components/ui";
import { PersonalPrograms } from "@/components/personal/programs";
import { ParticipantEmpty } from "@/components/personal/record-list";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { listPersonalApplications } from "@/lib/selection/service";
import { listPersonalAwards } from "@/lib/awards/service";

export default async function PersonalProgramsPage({ searchParams }: { searchParams: Promise<{ awardPage?: string }> }) {
  const { user } = await requireAuthenticatedSession();
  const params = await searchParams;
  const [applications, awards] = await Promise.all([listPersonalApplications(user.id), listPersonalAwards(user.id, { page: Number(params.awardPage) || 1 })]);
  const pages = Math.max(1, Math.ceil(awards.total / awards.pageSize));
  return <div className="space-y-6"><PageHeader title="Meus programas" description="Sua participação em programas de inovação, da candidatura à execução do apoio e ao acompanhamento longitudinal." action={<Link className="button-secondary" href="/app/personal/opportunities">Explorar oportunidades</Link>} />{applications.length ? <PersonalPrograms applications={applications} awards={awards.awards} /> : <Panel><ParticipantEmpty title="Um programa pode fazer parte da sua próxima etapa" description="Explore oportunidades e prepare uma candidatura com seu projeto. Aqui você acompanhará os envios e resultados de cada programa." action={<Link className="button-primary" href="/app/personal/opportunities">Explorar oportunidades</Link>} /></Panel>}
    {pages > 1 ? <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4" aria-label="Páginas dos apoios">{awards.page > 1 ? <Link className="button-secondary" href={`/app/personal/programs?awardPage=${awards.page - 1}`}>Apoios mais recentes</Link> : <span />}<p className="text-xs text-slate">Apoios · Página {awards.page} de {pages}</p>{awards.page < pages ? <Link className="button-secondary" href={`/app/personal/programs?awardPage=${awards.page + 1}`}>Apoios anteriores</Link> : <span />}</nav> : null}
    <Link className="button-tertiary" href="/app/personal/applications">Consultar todas as candidaturas</Link></div>;
}
