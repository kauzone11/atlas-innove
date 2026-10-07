import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell";
import { InstitutionDirectory } from "@/components/institutions/directory";
import { listPublicInstitutions } from "@/lib/institutions/service";
import { institutionDirectoryQuerySchema } from "@/lib/institutions/schemas";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { appMetadataUrl } from "@/lib/app-base-url";

export const metadata: Metadata = { title: "Instituições", description: "Conheça instituições, programas e chamadas públicas de inovação no Atlas Innove.", alternates: { canonical: appMetadataUrl("/institutions") } };

export default async function InstitutionDirectoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams; const query = institutionDirectoryQuerySchema.parse({ q: typeof params.q === "string" ? params.q : undefined, page: typeof params.page === "string" ? params.page : undefined });
  const auth = await getAuthenticatedSession(); const directory = await listPublicInstitutions(auth?.user.id ?? null, query);
  return <PublicShell><div className="space-y-7"><header className="border-b border-line pb-6"><p className="text-xs font-semibold uppercase tracking-wider text-accent-hover">Ecossistema de inovação</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Instituições</h1><p className="mt-3 max-w-3xl text-base leading-7 text-slate">Conheça quem apoia programas e iniciativas de inovação e acompanhe suas atualizações oficiais.</p></header>
    <form action="/institutions" className="flex flex-col gap-3 sm:flex-row"><label className="min-w-0 flex-1 space-y-1 text-sm font-medium"><span>Buscar por instituição ou localização</span><input className="field-control" type="search" name="q" maxLength={100} defaultValue={query.q ?? ""} placeholder="Nome, cidade ou estado" /></label><button className="button-secondary self-end">Buscar</button></form>
    {directory.total ? <p className="text-sm text-slate">{directory.total} {directory.total === 1 ? "instituição pública" : "instituições públicas"}</p> : null}<InstitutionDirectory items={directory.items} viewerUserId={auth?.user.id} />
    <nav className="flex gap-2" aria-label="Páginas de instituições">{query.page > 1 ? <a className="button-secondary" href={`?${query.q ? `q=${encodeURIComponent(query.q)}&` : ""}page=${query.page - 1}`}>Anterior</a> : null}{directory.hasNext ? <a className="button-secondary" href={`?${query.q ? `q=${encodeURIComponent(query.q)}&` : ""}page=${query.page + 1}`}>Próxima</a> : null}</nav>
  </div></PublicShell>;
}
