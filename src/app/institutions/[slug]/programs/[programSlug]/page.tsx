import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { notFound } from "next/navigation";
import { MediaImage } from "@/components/media/media-image";
import { PublicShell } from "@/components/public-shell";
import { PostCard } from "@/components/social/post-card";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getPublicProgram } from "@/lib/institutions/service";
import { appMetadataUrl } from "@/lib/app-base-url";

const callStatusLabel: Record<string, string> = { OPEN: "Inscrições abertas", IN_REVIEW: "Em avaliação", CLOSED: "Encerrada", RESULT_PUBLISHED: "Resultado publicado" };
type Props = { params: Promise<{ slug: string; programSlug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, programSlug } = await params; const result = await getPublicProgram(slug, programSlug);
  return result ? { title: result.program.name, description: result.program.description?.slice(0, 160) ?? `Programa público de ${result.institution.name}.`, alternates: { canonical: appMetadataUrl(`/institutions/${slug}/programs/${programSlug}`) } } : { title: "Programa", robots: { index: false, follow: false } };
}
export default async function PublicProgramPage({ params }: Props) {
  const { slug, programSlug } = await params; const auth = await getAuthenticatedSession(); const result = await getPublicProgram(slug, programSlug, auth?.user.id);
  if (!result) notFound();
  return <PublicShell><article className="mx-auto w-full max-w-4xl space-y-7 break-words"><nav aria-label="Programa" className="text-sm"><Link className="button-tertiary" href={`/institutions/${result.institution.slug}`}>Voltar para {result.institution.name}</Link></nav><header className="border-b border-line pb-6">{result.institution.logoMedia ? <MediaImage media={result.institution.logoMedia} alt={`${result.institution.name} — logotipo`} className="mb-4 h-14 w-14 rounded-lg border border-line bg-white object-contain p-1" sizes="56px" /> : null}<p className="text-xs font-semibold uppercase tracking-wider text-accent-hover">Programa de {result.institution.name}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{result.program.name}</h1>{result.program.description ? <p className="mt-4 max-w-3xl whitespace-pre-line text-base leading-7 text-slate">{result.program.description}</p> : null}</header>
    {result.calls.length ? <section><h2 className="text-xl font-semibold">Chamadas públicas</h2><ul className="mt-3 divide-y divide-line border-y border-line">{result.calls.map((call) => <li key={call.id} className="py-4"><p className="text-xs text-slate">{callStatusLabel[call.status] ?? "Chamada pública"}{call.callNumber ? ` · ${call.callNumber}` : ""}</p><h3 className="mt-1 font-semibold">{call.title}</h3>{call.objective ? <p className="mt-1 max-w-3xl text-sm leading-6 text-slate">{call.objective}</p> : null}{call.applicationEndsAt ? <p className="mt-2 text-xs text-slate">Prazo: {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(call.applicationEndsAt))}</p> : null}{call.sourceUrl ? <a className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-accent-hover hover:underline" href={call.sourceUrl} target="_blank" rel="noopener noreferrer">Consultar fonte oficial<ArrowUpRight size={14} aria-hidden="true" /></a> : null}</li>)}</ul></section> : null}
    {result.posts.length ? <section><h2 className="text-xl font-semibold">Atualizações do programa</h2><div className="mt-3 space-y-4">{result.posts.map((post) => <PostCard key={post.id} post={post} viewerUserId={auth?.user.id} publicProfile />)}</div></section> : null}
    {result.results.length ? <section><h2 className="text-xl font-semibold">Resultados publicados</h2><ul className="mt-3 divide-y divide-line border-y border-line">{result.results.map((publication) => <li key={publication.slug} className="py-4"><Link className="font-semibold text-accent-hover hover:underline" href={`/results/${publication.slug}`}>{publication.title}</Link>{publication.summary ? <p className="mt-1 max-w-3xl text-sm leading-6 text-slate">{publication.summary}</p> : null}</li>)}</ul></section> : null}
  </article></PublicShell>;
}
