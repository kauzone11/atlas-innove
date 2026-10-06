import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, FileText } from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { AnalyticsEmpty, ScopeNote, formatAnalyticsDateTime } from "@/components/analytics/presentation";
import { listPublicResults } from "@/lib/analytics/public-results";
import { appMetadataUrl } from "@/lib/app-base-url";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return { title: "Resultados públicos · Atlas Innove", description: "Resultados agregados de programas e coortes, publicados por suas instituições a partir de relatórios preservados.", alternates: { canonical: appMetadataUrl("/results") }, robots: { index: true, follow: true } };
}

export default async function PublicResultsPage() {
  const publications = await listPublicResults();
  return <PublicShell><div className="space-y-8"><header className="border-b border-line pb-7"><p className="text-xs font-semibold uppercase tracking-wider text-accent-hover">Evidências compartilhadas</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Resultados públicos</h1><p className="mt-4 max-w-3xl text-base leading-7 text-slate">Resultados agregados publicados pelas instituições a partir de relatórios preservados, com contexto metodológico e proteção de informações individuais.</p></header><ScopeNote>As publicações descrevem evidências registradas. Os resultados não demonstram, por si só, atribuição causal aos programas.</ScopeNote>{publications.length ? <ul className="divide-y divide-line border-y border-line">{publications.map((publication) => <li key={publication.slug}><Link href={`/results/${publication.slug}`} className="group flex items-start gap-4 py-6"><FileText size={20} strokeWidth={1.5} className="mt-1 hidden shrink-0 text-accent-hover sm:block" aria-hidden="true" /><div className="min-w-0 flex-1"><p className="text-xs text-slate">{publication.institutionName}</p><h2 className="mt-1 break-words text-lg font-semibold group-hover:text-accent-hover">{publication.title}</h2>{publication.summary ? <p className="mt-2 max-w-3xl whitespace-pre-wrap break-words text-sm leading-6 text-slate">{publication.summary}</p> : null}<p className="mt-3 text-xs text-slate">Publicado em {formatAnalyticsDateTime(publication.publishedAt)} · Relatório gerado em {formatAnalyticsDateTime(publication.reportGeneratedAt)}</p></div><ArrowRight size={18} className="mt-2 shrink-0 text-accent-hover" aria-hidden="true" /></Link></li>)}</ul> : <AnalyticsEmpty title="Nenhum resultado publicado neste momento" description="As instituições podem compartilhar resultados agregados após revisar um relatório e autorizar sua publicação." />}</div></PublicShell>;
}
