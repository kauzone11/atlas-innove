import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { ProfileRenderer } from "@/components/profiles/profile-renderer";
import { PersonNetworkActions } from "@/components/network/person-actions";
import { FollowButton } from "@/components/social/follow-button";
import { PostCard } from "@/components/social/post-card";
import { PostComposer } from "@/components/social/post-composer";
import { getPersonNetworkState } from "@/lib/network/connections";
import { getInviteOptions } from "@/lib/network/invites";
import { isProfilePublished, type VisibleProfile } from "@/lib/profiles/service";
import { getActivity } from "@/lib/social/activity";
import { getFeaturedPosts, getSocialProfileSummary } from "@/lib/social/read-model";

export async function SocialProfile({ profile, viewerUserId, own = false, publicProfile = false, preview = false, publicOnly = false }: { profile: VisibleProfile; viewerUserId?: string | null; own?: boolean; publicProfile?: boolean; preview?: boolean; publicOnly?: boolean }) {
  const [summary, activity, featured, connection, inviteOptions, viewerPublished] = await Promise.all([
    getSocialProfileSummary(profile.userId, viewerUserId), getActivity(profile.userId, viewerUserId, { publicOnly }), getFeaturedPosts(profile.userId, viewerUserId, publicOnly),
    viewerUserId && !own ? getPersonNetworkState(viewerUserId, profile.userId) : Promise.resolve(null),
    viewerUserId && !own ? getInviteOptions(viewerUserId, profile.userId) : Promise.resolve(undefined),
    isProfilePublished(viewerUserId),
  ]);
  const activityHref = publicOnly ? `/people/${profile.handle}/activity` : own ? "/app/personal/profile/activity" : viewerUserId ? `/app/personal/network/people/${profile.handle}/activity` : `/people/${profile.handle}/activity`;
  const follow = viewerUserId && !own ? <FollowButton userId={profile.userId} following={summary.following} canFollow={summary.canFollow} primary={summary.primaryProfileAction === "FOLLOW" && connection?.state !== "INCOMING"} /> : null;
  const composer = <PostComposer fullName={profile.fullName} avatarMedia={profile.avatarMedia} ready={Boolean(profile.fullName && profile.handle && profile.headline)} publicProfile={viewerPublished || publicProfile} compact />;
  const followerLabel = <><strong>{summary.followerCount}</strong> {summary.followerCount === 1 ? "seguidor" : "seguidores"}</>;
  const connectionLabel = <><strong>{summary.connectionCount}</strong> {summary.connectionCount === 1 ? "conexão" : "conexões"}</>;
  return <ProfileRenderer profile={profile}
    counts={<>
      {own && !publicOnly ? <Link href="/app/personal/profile/followers">{followerLabel}</Link> : <span>{followerLabel}</span>}
      {!publicOnly && summary.connectionCount !== null ? own ? <Link href="/app/personal/network/connections">{connectionLabel}</Link> : <span>{connectionLabel}</span> : null}
      {own && !publicOnly ? <Link href="/app/personal/profile/following">Seguindo</Link> : null}
    </>}
    actions={preview ? undefined : own ? <>
      {composer}<Link className="button-secondary" href="/app/personal/profile/edit">Editar perfil</Link>
      <details className="social-overflow"><summary className="button-secondary" aria-label="Mais ações do perfil"><MoreHorizontal size={19} aria-hidden="true" /><span>Mais</span></summary><div className="social-overflow-panel"><Link className="button-tertiary" href="/app/personal/profile/preview">Visualizar perfil público</Link><Link className="button-tertiary" href="/app/personal/profile/edit#social-settings">Configurações sociais</Link></div></details>
    </> : viewerUserId && connection ? <div className="social-profile-relationship">
      {summary.primaryProfileAction === "FOLLOW" ? follow : null}<PersonNetworkActions userId={profile.userId} connection={connection} inviteOptions={inviteOptions} primaryConnect={summary.primaryProfileAction === "CONNECT"} />{summary.primaryProfileAction !== "FOLLOW" ? follow : null}
    </div> : <Link className="button-primary" href="/login">Entrar para interagir</Link>}
    featured={featured.length ? <section className="social-profile-section"><h2 className="text-lg font-semibold">Em destaque</h2><div className="social-featured-list">{featured.slice(0, 3).map((post) => <PostCard key={post.id} post={post} viewerUserId={viewerUserId} publicProfile={viewerPublished || publicProfile} variant="profile" />)}</div></section> : undefined}
    activity={activity.items.length || own ? <section className="social-profile-section"><div className="social-section-heading"><div><h2 className="text-lg font-semibold">Atividade</h2><p className="mt-1 text-sm text-slate">{summary.followerCount} {summary.followerCount === 1 ? "pessoa acompanha" : "pessoas acompanham"} as publicações</p></div>{own && !preview ? composer : null}</div>{activity.items.length ? <><div className="social-activity-list">{activity.items.slice(0, 3).map((post) => <PostCard key={post.id} post={post} viewerUserId={viewerUserId} publicProfile={viewerPublished || publicProfile} variant="profile" />)}</div><Link className="social-section-link" href={activityHref}>Ver toda a atividade</Link></> : <div className="social-profile-empty"><p className="max-w-2xl text-sm leading-7 text-slate">Compartilhe uma atualização sobre o que você está construindo, pesquisando ou aprendendo.</p><Link className="button-tertiary mt-2" href="/app/personal/feed">Abrir início</Link></div>}</section> : undefined}
  />;
}
