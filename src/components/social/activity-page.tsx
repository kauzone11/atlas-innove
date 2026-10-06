import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { PostCard } from "@/components/social/post-card";
import { getActivity } from "@/lib/social/activity";
import { boundedPage } from "@/lib/communication/schemas";
import { isProfilePublished } from "@/lib/profiles/service";

export async function ActivityPage({ userId, viewerUserId, fullName, path, profileHref, filter: rawFilter, page, publicOnly = false }: { userId: string; viewerUserId?: string | null; fullName: string; path: string; profileHref: string; filter?: string; page?: string; publicOnly?: boolean }) {
  const filter = rawFilter === "comments" || rawFilter === "reposts" ? rawFilter : "posts";
  const [result, published] = await Promise.all([getActivity(userId, viewerUserId, { filter, page: boundedPage(page), publicOnly }), isProfilePublished(viewerUserId)]);
  return <div className="social-surface social-activity-page space-y-5"><PageHeader title="Atividade" description={`Publicações e conversas de ${fullName}.`} action={<Link className="button-secondary" href={profileHref}>Voltar ao perfil</Link>} /><nav className="social-tabs" aria-label="Tipos de atividade">{[["posts", "Publicações"], ["comments", "Comentários"], ["reposts", "Repostagens"]].map(([value, label]) => <Link key={value} href={`${path}?filter=${value}`} aria-current={value === filter ? "page" : undefined}>{label}</Link>)}</nav>{result.items.length ? <div className="space-y-4">{result.items.map((post) => <PostCard key={post.activityComment?.id ?? post.id} post={post} viewerUserId={viewerUserId} publicProfile={published} />)}</div> : <p className="border-y border-line py-7 text-sm text-slate">Nenhuma atividade visível nesta seleção.</p>}<nav className="flex gap-2" aria-label="Páginas de atividade">{result.page > 1 ? <Link className="button-secondary" href={`${path}?filter=${filter}&page=${result.page - 1}`}>Anterior</Link> : null}{result.hasNext ? <Link className="button-secondary" href={`${path}?filter=${filter}&page=${result.page + 1}`}>Próxima</Link> : null}</nav></div>;
}
