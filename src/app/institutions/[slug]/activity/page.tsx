import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public-shell";
import { PostCard } from "@/components/social/post-card";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getInstitutionActivity, getPublicInstitution } from "@/lib/institutions/service";
import { appMetadataUrl } from "@/lib/app-base-url";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params; const institution = await getPublicInstitution(slug);
  return institution ? { title: `Atividade de ${institution.name}`, alternates: { canonical: appMetadataUrl(`/institutions/${institution.slug}/activity`) } } : { title: "Atividade institucional", robots: { index: false, follow: false } };
}
export default async function InstitutionActivityPage({ params, searchParams }: Props) {
  const { slug } = await params; const query = await searchParams; const auth = await getAuthenticatedSession();
  const [institution, activity] = await Promise.all([getPublicInstitution(slug), getInstitutionActivity(slug, query.page, auth?.user.id)]);
  if (!institution || !activity) notFound();
  return <PublicShell><div className="mx-auto w-full max-w-3xl space-y-5"><nav aria-label="Instituição"><Link className="button-tertiary" href={`/institutions/${institution.slug}`}>Voltar para {institution.name}</Link></nav><header className="border-b border-line pb-5"><h1 className="text-2xl font-semibold">Atividade oficial</h1><p className="mt-2 text-sm text-slate">Publicações compartilhadas por {institution.name}.</p></header>{activity.items.length ? <div className="space-y-4">{activity.items.map((post) => <PostCard key={post.id} post={post} viewerUserId={auth?.user.id} publicProfile />)}</div> : <p className="py-8 text-sm text-slate">Esta instituição ainda não publicou atualizações.</p>}<nav className="flex gap-2" aria-label="Páginas da atividade">{activity.page > 1 ? <Link className="button-secondary" href={`?page=${activity.page - 1}`}>Anterior</Link> : null}{activity.hasNext ? <Link className="button-secondary" href={`?page=${activity.page + 1}`}>Próxima</Link> : null}</nav></div></PublicShell>;
}
