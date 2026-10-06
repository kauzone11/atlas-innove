import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { PostCard } from "@/components/social/post-card";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { getSavedPosts, getSocialViewerIdentity } from "@/lib/social/read-model";
import { isProfilePublished } from "@/lib/profiles/service";
export const metadata: Metadata = { title: "Publicações salvas" };
export default async function SavedPosts({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { user } = await requireAuthenticatedSession(); const query = await searchParams;
  const [result, viewer, published] = await Promise.all([getSavedPosts(user.id, query.page), getSocialViewerIdentity(user.id), isProfilePublished(user.id)]);
  return <div className="mx-auto w-full max-w-3xl space-y-6"><PageHeader title="Publicações salvas" description="Sua lista é privada. Publicações às quais você perdeu acesso deixam de aparecer." action={<Link href="/app/personal/feed" className="button-secondary">Voltar ao início</Link>} />{result.items.length ? <div className="space-y-4">{result.items.map((post) => <PostCard key={post.id} post={post} viewerUserId={user.id} viewer={viewer} publicProfile={published} />)}</div> : <p className="border-y border-line py-8 text-sm text-slate">Nenhuma publicação salva disponível nesta página.</p>}<nav className="flex gap-2" aria-label="Páginas de publicações salvas">{result.page > 1 ? <Link className="button-secondary" href={`?page=${result.page - 1}`}>Anterior</Link> : null}{result.hasNext ? <Link className="button-secondary" href={`?page=${result.page + 1}`}>Próxima</Link> : null}</nav></div>;
}
