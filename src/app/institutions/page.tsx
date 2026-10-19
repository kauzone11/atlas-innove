import type { Metadata } from "next";
import { Search } from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { PublicHero } from "@/components/ui";
import { InstitutionDirectory } from "@/components/institutions/directory";
import { listPublicInstitutions } from "@/lib/institutions/service";
import { institutionDirectoryQuerySchema } from "@/lib/institutions/schemas";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { appMetadataUrl } from "@/lib/app-base-url";

export const metadata: Metadata = { title: "Instituições", description: "Conheça instituições, programas e chamadas públicas de inovação no Atlas Innove.", alternates: { canonical: appMetadataUrl("/institutions") } };

export default async function InstitutionDirectoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams; const query = institutionDirectoryQuerySchema.parse({ q: typeof params.q === "string" ? params.q : undefined, page: typeof params.page === "string" ? params.page : undefined });
  const auth = await getAuthenticatedSession(); const directory = await listPublicInstitutions(auth?.user.id ?? null, query);
  return <PublicShell><div className="space-y-7"><PublicHero eyebrow="Ecossistema de inovação" title="Instituições" description="Conheça quem apoia programas e iniciativas de inovação e acompanhe suas atualizações oficiais." />
    <form action="/institutions" className="flex flex-col gap-3 sm:flex-row"><label className="min-w-0 flex-1 text-sm font-medium"><span className="sr-only">Buscar por instituição ou localização</span><span className="search-field block"><Search size={17} aria-hidden="true" /><input className="field-control" type="search" name="q" maxLength={100} defaultValue={query.q ?? ""} placeholder="Buscar por instituição ou localização" /></span></label><button className="button-secondary w-full sm:w-auto sm:self-end">Buscar</button></form>
    {directory.total ? <p className="text-sm text-slate">{directory.total} {directory.total === 1 ? "instituição pública" : "instituições públicas"}</p> : null}<InstitutionDirectory items={directory.items} viewerUserId={auth?.user.id} />
    <nav className="flex gap-2" aria-label="Páginas de instituições">{query.page > 1 ? <a className="button-secondary" href={`?${query.q ? `q=${encodeURIComponent(query.q)}&` : ""}page=${query.page - 1}`}>Anterior</a> : null}{directory.hasNext ? <a className="button-secondary" href={`?${query.q ? `q=${encodeURIComponent(query.q)}&` : ""}page=${query.page + 1}`}>Próxima</a> : null}</nav>
  </div></PublicShell>;
}
