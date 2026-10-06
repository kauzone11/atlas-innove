import Link from "next/link";
import type { Metadata } from "next";
import { Bookmark, ArrowRight } from "lucide-react";
import { Avatar } from "@/components/media/avatar";
import { PeopleDiscoveryList } from "@/components/network/discovery-list";
import { PostCard } from "@/components/social/post-card";
import { PostComposer } from "@/components/social/post-composer";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { listDiscoverablePeople } from "@/lib/network/people";
import { getOwnProfile } from "@/lib/profiles/service";
import { getFeed } from "@/lib/social/feed";

export const metadata: Metadata = { title: "Início" };
export default async function FeedPage({ searchParams }: { searchParams: Promise<{ mode?: string; cursor?: string }> }) {
  const { user } = await requireAuthenticatedSession(); const query = await searchParams; const mode = query.mode === "RECENT" ? "RECENT" : "HIGHLIGHTS";
  const [feed, profile, suggestions] = await Promise.all([getFeed(user.id, { mode, cursor: query.cursor }), getOwnProfile(user.id), listDiscoverablePeople(user.id, { pageSize: 3 })]);
  const published = profile.profileVisibility === "PUBLIC" && Boolean(profile.publishedAt);
  return <div className="social-surface social-feed-layout">
    <div className="social-feed-main">
      <header className="social-feed-heading"><h1>Início</h1><Link className="button-tertiary" href="/app/personal/saved-posts"><Bookmark size={16} aria-hidden="true" />Publicações salvas</Link></header>
      <PostComposer fullName={profile.fullName} avatarMedia={profile.avatarMedia} ready={Boolean(profile.fullName && profile.handle && profile.headline)} publicProfile={published} />
      <div className="social-feed-order"><nav className="social-tabs" aria-label="Ordenação das publicações"><Link href="/app/personal/feed?mode=HIGHLIGHTS" aria-current={mode === "HIGHLIGHTS" ? "page" : undefined}>Destaques</Link><Link href="/app/personal/feed?mode=RECENT" aria-current={mode === "RECENT" ? "page" : undefined}>Recentes</Link></nav>{mode === "HIGHLIGHTS" ? <details className="social-feed-explanation"><summary>Como funciona</summary><p>Destaques considera a atualidade, suas conexões e as conversas em publicações de quem você segue.</p></details> : null}</div>
      {feed.items.length ? <div className="social-feed-posts">{feed.items.map((post) => <PostCard key={post.id} post={post} viewerUserId={user.id} viewer={{ fullName: profile.fullName, avatarMedia: profile.avatarMedia }} publicProfile={published} />)}</div> : <section className="social-feed-empty"><h2 className="text-xl font-semibold">Sua rede começa com uma conversa</h2><p className="mt-3 max-w-xl text-sm leading-7 text-slate">Siga pessoas para acompanhar o que elas compartilham. Você também pode publicar uma atualização sobre sua atuação.</p><Link className="button-primary mt-5" href="/app/personal/network/people">Encontrar pessoas<ArrowRight size={16} aria-hidden="true" /></Link></section>}
      <nav className="flex flex-wrap gap-2" aria-label="Navegação das publicações">{query.cursor ? <Link className="button-secondary" href={`/app/personal/feed?mode=${mode}`}>Voltar às mais recentes</Link> : null}{feed.nextCursor ? <Link className="button-secondary" href={`/app/personal/feed?mode=${mode}&cursor=${encodeURIComponent(feed.nextCursor)}`}>Ver mais publicações</Link> : null}</nav>
    </div>
    <aside className="social-feed-rail" aria-label="Seu perfil e sua rede"><section className="social-rail-profile"><div className="flex items-start gap-3"><Avatar name={profile.fullName} media={profile.avatarMedia} /><div className="min-w-0"><h2 className="break-words font-semibold">{profile.fullName || "Seu perfil"}</h2>{profile.headline ? <p className="mt-1 break-words text-sm leading-6 text-slate">{profile.headline}</p> : null}</div></div><Link href="/app/personal/profile" className="button-tertiary mt-3">Ver meu perfil<ArrowRight size={15} aria-hidden="true" /></Link></section><section><h2 className="font-semibold">Pessoas para conhecer</h2><PeopleDiscoveryList variant="suggestions" viewerUserId={user.id} people={suggestions.people} /><Link className="button-tertiary mt-2" href="/app/personal/network/people">Explorar a Rede<ArrowRight size={15} aria-hidden="true" /></Link></section></aside>
  </div>;
}
