import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { InstitutionDirectory } from "@/components/institutions/directory";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { listPublicInstitutions } from "@/lib/institutions/service";
import { institutionDirectoryQuerySchema } from "@/lib/institutions/schemas";

export const metadata = { title: "Instituições na Rede" };
export default async function NetworkInstitutions({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user } = await requireAuthenticatedSession(); const params = await searchParams;
  const query = institutionDirectoryQuerySchema.parse({ q: typeof params.q === "string" ? params.q : undefined, page: typeof params.page === "string" ? params.page : undefined });
  const directory = await listPublicInstitutions(user.id, query);
  return <div className="min-w-0 space-y-6"><PageHeader title="Instituições" description="Encontre instituições com páginas públicas e acompanhe suas atualizações oficiais." action={<Link className="button-secondary" href="/app/personal/institutions">Minhas instituições</Link>} /><nav aria-label="Áreas da Rede" className="flex flex-wrap gap-2"><Link className="button-secondary" href="/app/personal/network">Visão geral</Link><Link className="button-secondary" href="/app/personal/network/people">Pessoas</Link><Link className="button-secondary" href="/app/personal/network/projects">Projetos</Link></nav><form action="/app/personal/network/institutions" className="flex flex-col gap-3 sm:flex-row"><label className="min-w-0 flex-1 space-y-1 text-sm font-medium"><span>Buscar por instituição ou localização</span><input className="field-control" type="search" name="q" maxLength={100} defaultValue={query.q ?? ""} placeholder="Nome, cidade ou estado" /></label><button className="button-secondary self-end">Buscar</button></form><InstitutionDirectory items={directory.items} viewerUserId={user.id} /><nav className="flex gap-2" aria-label="Páginas de instituições">{query.page > 1 ? <Link className="button-secondary" href={`?${query.q ? `q=${encodeURIComponent(query.q)}&` : ""}page=${query.page - 1}`}>Anterior</Link> : null}{directory.hasNext ? <Link className="button-secondary" href={`?${query.q ? `q=${encodeURIComponent(query.q)}&` : ""}page=${query.page + 1}`}>Próxima</Link> : null}</nav></div>;
}
