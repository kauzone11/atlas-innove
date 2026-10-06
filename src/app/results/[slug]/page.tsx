import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public-shell";
import { Breadcrumbs } from "@/components/ui";
import { PublicReportContent } from "@/components/analytics/report-content";
import { reportTypeLabels, publicScopeLabel, formatAnalyticsDateTime } from "@/components/analytics/presentation";
import { getPublicResult } from "@/lib/analytics/public-results";
import { appMetadataUrl } from "@/lib/app-base-url";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const publication = await getPublicResult((await params).slug);
  if (!publication) return { title: "Resultado não encontrado · Atlas Innove", robots: { index: false, follow: false } };
  return { title: `${publication.title} · Atlas Innove`, description: (publication.summary ?? `Resultados agregados publicados por ${publication.institutionName}.`).slice(0, 160), alternates: { canonical: appMetadataUrl(`/results/${publication.slug}`) }, robots: { index: true, follow: true } };
}

export default async function PublicResultPage({ params }: Props) {
  const publication = await getPublicResult((await params).slug);
  if (!publication) notFound();
  return <PublicShell><article className="min-w-0 space-y-8"><header className="border-b border-line pb-7"><Breadcrumbs items={[{ label: "Resultados públicos", href: "/results" }, { label: publication.title }]} /><p className="mt-4 text-xs font-semibold uppercase tracking-wider text-accent-hover">{publication.institutionName}</p><h1 className="mt-3 max-w-4xl break-words text-3xl font-semibold tracking-tight sm:text-4xl">{publication.title}</h1>{publication.summary ? <p className="mt-4 max-w-3xl whitespace-pre-wrap break-words text-base leading-7 text-slate">{publication.summary}</p> : null}<dl className="analytics-facts mt-6"><div><dt>Tipo de relatório</dt><dd>{reportTypeLabels[publication.payload.type]}</dd></div><div><dt>Escopo</dt><dd>{publicScopeLabel(publication.payload.scope)}</dd></div><div><dt>Relatório gerado em</dt><dd>{formatAnalyticsDateTime(publication.reportGeneratedAt)}</dd></div><div><dt>Publicado em</dt><dd>{formatAnalyticsDateTime(publication.publishedAt)}</dd></div><div><dt>Dados disponíveis em</dt><dd>{formatAnalyticsDateTime(publication.payload.dataAsOf)}</dd></div></dl></header><PublicReportContent payload={publication.payload} /><footer className="border-t border-line pt-6"><p className="max-w-3xl text-xs leading-6 text-slate">Este conteúdo agregado foi autorizado pela instituição. O relatório e a proteção aprovada permanecem preservados; uma atualização da evidência exige uma nova publicação.</p><Link href="/results" className="analytics-link mt-4 inline-flex min-h-11 items-center">Consultar outros resultados públicos</Link></footer></article></PublicShell>;
}
