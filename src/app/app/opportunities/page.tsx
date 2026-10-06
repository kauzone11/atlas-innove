import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader, Panel, PanelHeader, StatusBadge } from "@/components/ui";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatMonitoringDate } from "@/lib/monitoring/format";

const opportunityLabels = { OPEN: "Aberta", UPCOMING: "Próxima", IN_REVIEW: "Em análise", CLOSED: "Encerrada", RESULT_PUBLISHED: "Resultado publicado", ARCHIVED: "Arquivada" } as const;

function sourceHref(value: string): string | null {
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}

export default async function OpportunitiesPage() {
  const context = await getActiveOrganizationContext();
  if (!context) redirect("/app/organizations");
  const opportunities = await db.opportunity.findMany({ where: { organizationId: context.organization.id, status: { not: "ARCHIVED" } }, orderBy: [{ applicationEndsAt: "asc" }, { publishedAt: "desc" }], select: { id: true, institution: true, callNumber: true, title: true, objective: true, territory: true, audience: true, status: true, applicationEndsAt: true, sourceUrl: true, sourceCheckedAt: true } });
  return <div className="min-w-0 space-y-6">
    <PageHeader title="Oportunidades" description="Chamadas registradas no espaço institucional, com contexto e acesso à fonte de publicação." />
    <Panel><PanelHeader title="Chamadas acompanhadas" />
      {opportunities.length ? <div className="divide-y divide-line">{opportunities.map((opportunity) => {
        const source = sourceHref(opportunity.sourceUrl);
        return <article key={opportunity.id} className="px-6 py-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="text-xs font-medium text-slate">{opportunity.institution} · {opportunity.callNumber}</p><h2 className="mt-2 break-words text-lg font-semibold text-ink">{opportunity.title}</h2></div><StatusBadge label={opportunityLabels[opportunity.status]} tone={opportunity.status === "OPEN" ? "success" : "neutral"} /></div><p className="mt-3 text-sm leading-6 text-slate">{opportunity.objective}</p><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-slate">Território</dt><dd className="mt-1 text-ink">{opportunity.territory}</dd></div><div><dt className="text-xs text-slate">Prazo de inscrição</dt><dd className="mt-1 text-ink">{formatMonitoringDate(opportunity.applicationEndsAt?.toISOString() ?? null)}</dd></div>{opportunity.audience ? <div className="sm:col-span-2"><dt className="text-xs text-slate">Público</dt><dd className="mt-1 text-ink">{opportunity.audience}</dd></div> : null}</dl><div className="mt-4 flex flex-wrap items-center justify-between gap-3">{source ? <a className="button-secondary" href={source} target="_blank" rel="noopener noreferrer">Consultar publicação <ExternalLink size={15} aria-hidden="true" /></a> : <span className="text-xs text-slate">Fonte indisponível</span>}<span className="text-xs text-slate">Fonte consultada em {formatMonitoringDate(opportunity.sourceCheckedAt.toISOString())}</span></div></article>;
      })}</div> : <div className="px-6 pb-8 text-sm leading-6 text-slate"><p>Nenhuma oportunidade registrada neste espaço. Os editais dos programas são administrados em seus respectivos workspaces.</p><Link href="/app/programs" className="mt-4 inline-flex min-h-11 items-center font-semibold text-accent-hover hover:underline">Ver programas e editais</Link></div>}
    </Panel>
  </div>;
}
