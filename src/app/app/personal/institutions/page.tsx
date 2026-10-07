import Link from "next/link";
import { ArrowUpRight, Building2 } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { MediaImage } from "@/components/media/media-image";
import { InstitutionFollowButton } from "@/components/institutions/follow-button";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { listFollowedInstitutions } from "@/lib/institutions/service";

export const metadata = { title: "Minhas instituições" };
export default async function FollowedInstitutions({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { user } = await requireAuthenticatedSession(); const query = await searchParams; const result = await listFollowedInstitutions(user.id, query.page);
  return <div className="space-y-6"><PageHeader title="Minhas instituições" description="Acompanhe as instituições que você escolheu seguir." action={<Link className="button-secondary" href="/app/personal/network/institutions">Encontrar instituições</Link>} />
    {result.items.length ? <ul className="divide-y divide-line border-y border-line">{result.items.map((item) => <li key={item.id} className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-start gap-4">{item.logoMedia ? <MediaImage media={item.logoMedia} alt={`${item.name} — logotipo`} className="h-14 w-14 shrink-0 rounded-lg border border-line bg-white object-contain p-1" sizes="56px" /> : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-subtle"><Building2 size={22} aria-hidden="true" /></span>}<div className="min-w-0"><h2 className="break-words font-semibold">{item.active ? <Link className="hover:underline" href={`/institutions/${item.slug}`}>{item.name}<ArrowUpRight className="ml-1 inline" size={14} aria-hidden="true" /></Link> : item.name}</h2>{item.headline ? <p className="mt-1 text-sm leading-6 text-slate">{item.headline}</p> : null}{!item.active ? <p className="mt-1 text-xs text-slate">Página institucional indisponível no momento. Seu acompanhamento histórico foi preservado.</p> : null}</div></div><InstitutionFollowButton organizationId={item.id} following /></li>)}</ul> : <section className="social-feed-empty"><h2 className="text-lg font-semibold">Você ainda não segue instituições</h2><p className="mt-2 text-sm leading-6 text-slate">Explore páginas institucionais para acompanhar programas e atualizações oficiais.</p><Link className="button-primary mt-4" href="/app/personal/network/institutions">Explorar instituições</Link></section>}
    <nav className="flex gap-2" aria-label="Páginas das instituições seguidas">{result.page > 1 ? <Link className="button-secondary" href={`?page=${result.page - 1}`}>Anterior</Link> : null}{result.hasNext ? <Link className="button-secondary" href={`?page=${result.page + 1}`}>Próxima</Link> : null}</nav>
  </div>;
}
