import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ResourceNotFoundError } from "@/lib/errors";
import { boundedPage } from "@/lib/communication/schemas";
import { connectedUserWhere, unblockedUserWhere, visiblePostWhere } from "@/lib/social/visibility";
import type { SocialCommentDto, SocialIdentity, SocialPage, SocialPostDto } from "@/lib/social/types";

export const socialIdentitySelect = {
  id: true, profile: { select: { fullName: true } }, innovationProfile: { select: {
    handle: true, headline: true, profileVisibility: true, publishedAt: true, directoryEnabled: true,
  } },
} satisfies Prisma.UserSelect;
type IdentityRow = Prisma.UserGetPayload<{ select: typeof socialIdentitySelect }>;

export function socialIdentity(row: IdentityRow, viewerUserId?: string | null): SocialIdentity {
  const profile = row.innovationProfile;
  const visible = row.id === viewerUserId || (viewerUserId && profile?.profileVisibility === "PLATFORM")
    || (profile?.profileVisibility === "PUBLIC" && Boolean(profile.publishedAt || (viewerUserId && profile.directoryEnabled)));
  return { userId: row.id, fullName: row.profile?.fullName || "Pessoa da plataforma",
    handle: visible ? profile?.handle ?? null : null, headline: visible ? profile?.headline ?? null : null };
}

function postSelect(viewerUserId?: string | null, publicOnly = false) {
  return {
    id: true, authorUserId: true, body: true, externalUrl: true, visibility: true, commentPolicy: true, allowReposts: true,
    createdAt: true, editedAt: true, repostOfPostId: true, author: { select: socialIdentitySelect },
    reactions: { where: { userId: viewerUserId ?? "__anonymous__" }, select: { type: true }, take: 1 },
    saves: { where: { userId: viewerUserId ?? "__anonymous__" }, select: { userId: true }, take: 1 },
    featured: { where: { userId: viewerUserId ?? "__anonymous__" }, select: { userId: true }, take: 1 },
    _count: { select: {
      reactions: { where: { user: unblockedUserWhere(viewerUserId) } },
      comments: { where: { deletedAt: null, hiddenByPostAuthorAt: null, author: unblockedUserWhere(viewerUserId),
        OR: [{ parentCommentId: null }, { parentComment: { hiddenByPostAuthorAt: null, author: unblockedUserWhere(viewerUserId) } }] } },
      reposts: { where: visiblePostWhere(viewerUserId, publicOnly) },
    } },
  } satisfies Prisma.SocialPostSelect;
}

export async function loadPosts(where: Prisma.SocialPostWhereInput, viewerUserId?: string | null, options: {
  take?: number; skip?: number; orderBy?: Prisma.SocialPostOrderByWithRelationInput[]; publicOnly?: boolean;
} = {}): Promise<SocialPostDto[]> {
  const rows = await db.socialPost.findMany({ where: { AND: [visiblePostWhere(viewerUserId, options.publicOnly), where] }, select: postSelect(viewerUserId, options.publicOnly),
    orderBy: options.orderBy ?? [{ createdAt: "desc" }, { id: "desc" }], take: Math.min(options.take ?? 21, 501), skip: options.skip });
  const originalIds = [...new Set(rows.flatMap((row) => row.repostOfPostId ? [row.repostOfPostId] : []))];
  const [originals, connections] = await Promise.all([
    originalIds.length ? db.socialPost.findMany({ where: { AND: [visiblePostWhere(viewerUserId, options.publicOnly), { id: { in: originalIds } }] }, select: postSelect(viewerUserId, options.publicOnly) }) : Promise.resolve([]),
    viewerUserId ? db.networkConnection.findMany({ where: { endedAt: null, OR: [
      { userAId: viewerUserId, userBId: { in: [...rows.map((row) => row.authorUserId)] } },
      { userBId: viewerUserId, userAId: { in: [...rows.map((row) => row.authorUserId)] } },
    ] }, select: { userAId: true, userBId: true } }) : Promise.resolve([]),
  ]);
  const connected = new Set(connections.flatMap((row) => [row.userAId, row.userBId]));
  const dto = (row: typeof rows[number]): SocialPostDto => ({
    id: row.id, author: socialIdentity(row.author, options.publicOnly ? null : viewerUserId), body: row.body, externalUrl: row.externalUrl,
    visibility: row.visibility, commentPolicy: row.commentPolicy, allowReposts: row.allowReposts,
    createdAt: row.createdAt.toISOString(), editedAt: row.editedAt?.toISOString() ?? null, repostOfPostId: row.repostOfPostId,
    original: null, reactionCount: row._count.reactions, commentCount: row._count.comments, repostCount: row._count.reposts,
    viewerReaction: row.reactions[0]?.type ?? null, saved: Boolean(row.saves.length), featured: Boolean(row.featured.length),
    canEdit: row.authorUserId === viewerUserId,
    canComment: Boolean(viewerUserId && row.commentPolicy !== "OFF" && (row.commentPolicy === "EVERYONE" || row.authorUserId === viewerUserId || connected.has(row.authorUserId))),
    canRepost: Boolean(viewerUserId && row.allowReposts && row.visibility !== "CONNECTIONS"),
  });
  const originalsById = new Map(originals.map((row) => [row.id, dto(row)]));
  return rows.map((row) => {
    const result = dto(row);
    if (row.repostOfPostId) {
      result.original = originalsById.get(row.repostOfPostId) ?? null;
      result.canRepost = Boolean(viewerUserId && result.original?.allowReposts && result.original.visibility !== "CONNECTIONS");
    }
    return result;
  });
}

export async function getPost(id: string, viewerUserId?: string | null) {
  return (await loadPosts({ id }, viewerUserId, { take: 1 }))[0] ?? null;
}

export async function getSocialProfileSummary(userId: string, viewerUserId?: string | null) {
  const profile = await db.innovationProfile.findFirst({ where: { userId, user: unblockedUserWhere(viewerUserId) },
    select: { followPolicy: true, primaryProfileAction: true, profileVisibility: true, publishedAt: true, directoryEnabled: true } });
  if (!profile) throw new ResourceNotFoundError("PROFILE_NOT_FOUND");
  const [followerCount, connectionCount, following, connection] = await Promise.all([
    db.userFollow.count({ where: { followedUserId: userId, endedAt: null, follower: unblockedUserWhere(viewerUserId) } }),
    viewerUserId === userId ? db.networkConnection.count({ where: { endedAt: null, OR: [{ userAId: userId }, { userBId: userId }] } }) : Promise.resolve(null),
    viewerUserId ? db.userFollow.findFirst({ where: { followerUserId: viewerUserId, followedUserId: userId, endedAt: null }, select: { id: true } }) : Promise.resolve(null),
    viewerUserId && viewerUserId !== userId ? db.user.findFirst({ where: { id: userId, ...connectedUserWhere(viewerUserId) }, select: { id: true } }) : Promise.resolve(null),
  ]);
  const visible = profile.profileVisibility === "PLATFORM" || (profile.profileVisibility === "PUBLIC" && Boolean(profile.publishedAt || profile.directoryEnabled));
  return { followerCount, connectionCount, following: Boolean(following),
    canFollow: Boolean(viewerUserId && viewerUserId !== userId && (visible || connection) && (profile.followPolicy === "EVERYONE" || connection)),
    followPolicy: profile.followPolicy, primaryProfileAction: profile.primaryProfileAction };
}

export async function getFollowStates(viewerUserId: string, userIds: string[]): Promise<Record<string, { following: boolean; canFollow: boolean }>> {
  const ids = [...new Set(userIds)].slice(0, 50);
  const [profiles, follows, connections] = await Promise.all([
    db.innovationProfile.findMany({ where: { userId: { in: ids }, user: unblockedUserWhere(viewerUserId), OR: [
      { profileVisibility: "PLATFORM" }, { profileVisibility: "PUBLIC", OR: [{ publishedAt: { not: null } }, { directoryEnabled: true }] },
    ] }, select: { userId: true, followPolicy: true } }),
    db.userFollow.findMany({ where: { followerUserId: viewerUserId, followedUserId: { in: ids }, endedAt: null }, select: { followedUserId: true } }),
    db.user.findMany({ where: { id: { in: ids }, ...connectedUserWhere(viewerUserId) }, select: { id: true } }),
  ]);
  const following = new Set(follows.map((row) => row.followedUserId));
  const connected = new Set(connections.map((row) => row.id));
  const policy = new Map(profiles.map((profile) => [profile.userId, profile.followPolicy]));
  return Object.fromEntries(ids.map((id) => [id, { following: policy.has(id) && following.has(id),
    canFollow: id !== viewerUserId && policy.has(id) && (policy.get(id) === "EVERYONE" || connected.has(id)) }]));
}

export async function getSavedPosts(userId: string, rawPage: unknown = 1): Promise<SocialPage<SocialPostDto>> {
  const page = boundedPage(rawPage);
  const records = await db.savedPost.findMany({ where: { userId, post: visiblePostWhere(userId) }, select: { postId: true },
    orderBy: [{ createdAt: "desc" }, { postId: "desc" }], skip: (page - 1) * 20, take: 21 });
  const ids = records.slice(0, 20).map((row) => row.postId);
  const items = await loadPosts({ id: { in: ids } }, userId, { take: 20 });
  items.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  return { items, page, hasNext: records.length > 20 };
}

export async function getFeaturedPosts(userId: string, viewerUserId?: string | null, publicOnly = false) {
  const records = await db.featuredPost.findMany({ where: { userId, post: visiblePostWhere(viewerUserId, publicOnly) }, select: { postId: true }, orderBy: { position: "asc" }, take: 3 });
  const ids = records.map((row) => row.postId);
  const posts = await loadPosts({ id: { in: ids } }, viewerUserId, { take: 3, publicOnly });
  return posts.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
}

export async function listFollows(userId: string, direction: "followers" | "following", rawPage: unknown = 1): Promise<SocialPage<SocialIdentity>> {
  const page = boundedPage(rawPage);
  const rows = await db.userFollow.findMany({ where: {
    endedAt: null, ...(direction === "followers" ? { followedUserId: userId, follower: unblockedUserWhere(userId) } : { followerUserId: userId, followed: unblockedUserWhere(userId) }),
  }, select: { follower: { select: socialIdentitySelect }, followed: { select: socialIdentitySelect } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 21 });
  return { items: rows.slice(0, 20).map((row) => socialIdentity(direction === "followers" ? row.follower : row.followed, userId)), page, hasNext: rows.length > 20 };
}

export async function getComments(postId: string, viewerUserId?: string | null, options: { page?: unknown; parentCommentId?: string | null } = {}): Promise<SocialPage<SocialCommentDto>> {
  const post = await db.socialPost.findFirst({ where: { AND: [{ id: postId }, visiblePostWhere(viewerUserId)] }, select: { authorUserId: true } });
  if (!post) throw new ResourceNotFoundError("SOCIAL_POST_NOT_FOUND");
  const page = boundedPage(options.page);
  const rows = await db.postComment.findMany({ where: {
    postId, post: visiblePostWhere(viewerUserId), parentCommentId: options.parentCommentId ?? null, author: unblockedUserWhere(viewerUserId),
    ...(options.parentCommentId ? { parentComment: { author: unblockedUserWhere(viewerUserId), hiddenByPostAuthorAt: null } } : {}),
  }, select: { id: true, postId: true, parentCommentId: true, authorUserId: true, body: true, createdAt: true, editedAt: true, deletedAt: true, hiddenByPostAuthorAt: true,
    author: { select: socialIdentitySelect },
    reactions: { where: { userId: viewerUserId ?? "__anonymous__" }, select: { type: true }, take: 1 },
    _count: { select: { reactions: { where: { user: unblockedUserWhere(viewerUserId) } } } },
  }, orderBy: options.parentCommentId ? [{ createdAt: "asc" }, { id: "asc" }] : [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 15, take: 16 });
  return { page, hasNext: rows.length > 15, items: rows.slice(0, 15).map((row) => ({
    id: row.id, postId: row.postId, parentCommentId: row.parentCommentId, author: socialIdentity(row.author, viewerUserId),
    body: row.deletedAt || row.hiddenByPostAuthorAt ? null : row.body,
    createdAt: row.createdAt.toISOString(), editedAt: row.editedAt?.toISOString() ?? null,
    deleted: Boolean(row.deletedAt), hidden: Boolean(row.hiddenByPostAuthorAt),
    reactionCount: row.deletedAt || row.hiddenByPostAuthorAt ? 0 : row._count.reactions,
    viewerReaction: row.deletedAt || row.hiddenByPostAuthorAt ? null : row.reactions[0]?.type ?? null,
    canEdit: row.authorUserId === viewerUserId && !row.deletedAt && !row.hiddenByPostAuthorAt,
    canHide: post.authorUserId === viewerUserId && row.authorUserId !== viewerUserId && !row.hiddenByPostAuthorAt && !row.deletedAt,
    isPostAuthor: row.authorUserId === post.authorUserId,
  })) };
}

export async function getReactionList(postId: string, viewerUserId?: string | null, rawPage: unknown = 1) {
  if (!await getPost(postId, viewerUserId)) throw new ResourceNotFoundError("SOCIAL_POST_NOT_FOUND");
  const page = boundedPage(rawPage);
  const rows = await db.postReaction.findMany({ where: { postId, post: visiblePostWhere(viewerUserId), user: { ...unblockedUserWhere(viewerUserId),
    ...(!viewerUserId ? { innovationProfile: { is: { profileVisibility: "PUBLIC", publishedAt: { not: null } } } } : {}),
  } }, select: { type: true, user: { select: socialIdentitySelect } }, orderBy: [{ createdAt: "desc" }, { userId: "desc" }], skip: (page - 1) * 20, take: 21 });
  return { items: rows.slice(0, 20).map((row) => ({ ...socialIdentity(row.user, viewerUserId), type: row.type })), page, hasNext: rows.length > 20 };
}
