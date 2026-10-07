import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, MapPin } from "lucide-react";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/media/avatar";
import { MediaImage } from "@/components/media/media-image";
import { PublicShell } from "@/components/public-shell";
import { InstitutionFollowButton } from "@/components/institutions/follow-button";
import { PostCard } from "@/components/social/post-card";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getPublicInstitution } from "@/lib/institutions/service";
import { appMetadataUrl } from "@/lib/app-base-url";

const callStatusLabel: Record<string, string> = { OPEN: "Inscrições abertas", IN_REVIEW: "Em avaliação", CLOSED: "Encerrada", RESULT_PUBLISHED: "Resultado publicado" };
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params; const institution = await getPublicInstitution(slug);
  if (!institution) return { title: "Instituição", robots: { index: false, follow: false } };
  return { title: institution.name, description: institution.headline ?? institution.description?.slice(0, 160) ?? "Perfil público de instituição no Atlas Innove.", alternates: { canonical: appMetadataUrl(`/institutions/${institution.slug}`) }, robots: { index: true, follow: true } };
}

export default async function InstitutionPage({ params, searchParams }: Props) {
  const { slug } = await params; const query = await searchParams; const preview = query.preview === "1"; const auth = await getAuthenticatedSession(); const institution = await getPublicInstitution(slug, auth?.user.id, preview);
  if (!institution || (!institution.published && !preview)) notFound();
  const location = [institution.city, institution.state, institution.country].filter(Boolean).join(" · ");
  return <PublicShell><article className="mx-auto w-full max-w-5xl space-y-8 break-words">{preview && !institution.published ? <p className="rounded-md border border-warning/40 bg-warning-soft p-3 text-sm text-ink">Prévia privada para membros da instituição. Esta página ainda não está publicada.</p> : null}
    <header className="overflow-hidden rounded-xl border border-line bg-white shadow-card">
      <div className="relative aspect-[3/1] min-h-24 bg-surface-subtle sm:min-h-40">{institution.coverMedia ? <MediaImage media={institution.coverMedia} alt="" className="h-full w-full object-cover" loading="eager" sizes="(max-width: 767px) 100vw, 1024px" /> : <div className="institution-cover-fallback" aria-hidden="true"><span>Atlas Innove</span></div>}</div>
      <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:items-end sm:p-7">
        {institution.logoMedia ? <MediaImage media={institution.logoMedia} alt={`${institution.name} — logotipo`} className="h-20 w-20 rounded-xl border border-line bg-white object-contain p-2 sm:h-24 sm:w-24" sizes="96px" /> : <Avatar name={institution.name} media={null} size="profile" />}
        <div className="min-w-0"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">{institution.name}</h1>{institution.headline ? <p className="mt-2 max-w-3xl text-base leading-7 text-slate">{institution.headline}</p> : null}{location ? <p className="mt-3 flex items-start gap-2 text-sm text-slate"><MapPin size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{location}</p> : null}</div><div className="flex shrink-0 flex-wrap items-center gap-3">{institution.published ? auth ? <InstitutionFollowButton organizationId={institution.id} following={institution.following} /> : <Link className="button-primary" href="/login">Entrar para seguir</Link> : <p className="text-sm text-slate">Acompanhamento disponível após a publicação.</p>}<span className="text-sm text-slate"><strong className="text-ink">{institution.followerCount}</strong> {institution.followerCount === 1 ? "seguidor" : "seguidores"}</span></div></div>
          {institution.websiteUrl ? <a className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-accent-hover hover:underline" href={institution.websiteUrl} target="_blank" rel="noopener noreferrer">Site institucional<ArrowUpRight size={15} aria-hidden="true" /></a> : null}
        </div>
      </div>
    </header>
    {institution.description || institution.focusAreas.length ? <section className="border-b border-line pb-7"><h2 className="text-xl font-semibold">Sobre a instituição</h2>{institution.description ? <p className="mt-3 max-w-4xl whitespace-pre-line text-sm leading-7 text-slate">{institution.description}</p> : null}{institution.focusAreas.length ? <ul className="mt-4 flex flex-wrap gap-2">{institution.focusAreas.map((area) => <li key={area} className="rounded-md border border-line px-3 py-1.5 text-xs text-slate">{area}</li>)}</ul> : null}</section> : null}
    {institution.programs.length ? <section><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">Programas</h2><p className="mt-1 text-sm text-slate">Programas com presença pública habilitada.</p></div></div><ul className="mt-4 divide-y divide-line border-y border-line">{institution.programs.map((program) => <li key={program.id}><Link className="group block py-4" href={`/institutions/${institution.slug}/programs/${program.slug}`}><h3 className="font-semibold group-hover:text-accent-hover">{program.name}</h3>{program.description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-slate">{program.description}</p> : null}<span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent-hover">Ver programa<ArrowUpRight size={14} aria-hidden="true" /></span></Link></li>)}</ul></section> : null}
    {institution.calls.length ? <section><h2 className="text-xl font-semibold">Chamadas públicas</h2><ul className="mt-3 divide-y divide-line border-y border-line">{institution.calls.map((call) => <li key={call.id} className="py-4"><p className="text-xs text-slate">{callStatusLabel[call.status] ?? "Chamada pública"}{call.callNumber ? ` · ${call.callNumber}` : ""}</p><h3 className="mt-1 font-semibold">{call.title}</h3>{call.objective ? <p className="mt-1 max-w-3xl text-sm leading-6 text-slate">{call.objective}</p> : null}<p className="mt-2 text-xs text-slate">{call.program ? <Link className="hover:underline" href={`/institutions/${institution.slug}/programs/${call.program.slug}`}>{call.program.name}</Link> : "Chamada institucional"}{call.applicationEndsAt ? ` · Prazo: ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(call.applicationEndsAt))}` : ""}</p>{call.sourceUrl ? <a className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-accent-hover hover:underline" href={call.sourceUrl} target="_blank" rel="noopener noreferrer">Consultar fonte oficial<ArrowUpRight size={14} aria-hidden="true" /></a> : null}</li>)}</ul></section> : null}
    {institution.posts.length ? <section><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">Atividade oficial</h2><p className="mt-1 text-sm text-slate">Atualizações publicadas pela instituição.</p></div><Link className="button-tertiary" href={`/institutions/${institution.slug}/activity`}>Ver toda a atividade</Link></div><div className="mt-4 space-y-4">{institution.posts.map((post) => <PostCard key={post.id} post={post} viewerUserId={auth?.user.id} publicProfile />)}</div></section> : null}
    {institution.results.length ? <section><h2 className="text-xl font-semibold">Resultados publicados</h2><ul className="mt-3 divide-y divide-line border-y border-line">{institution.results.map((result) => <li key={result.slug} className="py-4"><Link href={`/results/${result.slug}`} className="font-semibold text-accent-hover hover:underline">{result.title}</Link>{result.summary ? <p className="mt-1 max-w-3xl text-sm leading-6 text-slate">{result.summary}</p> : null}</li>)}</ul></section> : null}
  </article></PublicShell>;
}
