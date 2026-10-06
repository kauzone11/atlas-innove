import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public-shell";
import { PostCard } from "@/components/social/post-card";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getComments, getPost, getSocialViewerIdentity } from "@/lib/social/read-model";
import { appMetadataUrl } from "@/lib/app-base-url";
import { isProfilePublished } from "@/lib/profiles/service";

type Props = { params: Promise<{ postId: string }>; searchParams: Promise<{ page?: string; parentCommentId?: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { postId } = await params; const post = await getPost(postId);
  if (!post) return { title: "Publicação", robots: { index: false, follow: false } };
  return { title: `Publicação de ${post.author.fullName}`, description: post.body?.slice(0, 160), alternates: { canonical: appMetadataUrl(`/posts/${post.id}`) }, robots: { index: true, follow: true } };
}
export default async function PublicPost({ params, searchParams }: Props) {
  const { postId } = await params; const auth = await getAuthenticatedSession(); const post = await getPost(postId, auth?.user.id); if (!post) notFound();
  const query = await searchParams;
  const [comments, published, viewer] = await Promise.all([getComments(postId, auth?.user.id, { page: query.page, parentCommentId: query.parentCommentId }), isProfilePublished(auth?.user.id), getSocialViewerIdentity(auth?.user.id)]);
  return <PublicShell><div className="mx-auto w-full max-w-3xl space-y-5"><nav aria-label="Publicação"><Link className="button-tertiary" href={auth ? "/app/personal/feed" : post.author.handle ? `/people/${post.author.handle}` : "/opportunities"}>{auth ? "Voltar ao início" : "Ver perfil"}</Link></nav><PostCard key={`${post.id}:${comments.page}:${query.parentCommentId ?? ""}`} post={post} viewerUserId={auth?.user.id} viewer={viewer} detail initialComments={comments} publicProfile={published} publicParentCommentId={query.parentCommentId} />{!auth && (comments.page > 1 || comments.hasNext) ? <nav className="flex gap-2" aria-label="Páginas de comentários públicos">{comments.page > 1 ? <Link className="button-secondary" href={`?page=${comments.page - 1}${query.parentCommentId ? `&parentCommentId=${encodeURIComponent(query.parentCommentId)}` : ""}`}>Comentários anteriores</Link> : null}{comments.hasNext ? <Link className="button-secondary" href={`?page=${comments.page + 1}${query.parentCommentId ? `&parentCommentId=${encodeURIComponent(query.parentCommentId)}` : ""}`}>Próximos comentários</Link> : null}</nav> : null}</div></PublicShell>;
}
