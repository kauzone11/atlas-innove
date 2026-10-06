import { z } from "zod";
import { db } from "@/lib/db";
import { getVisibleProfile, getPublicProfile } from "@/lib/profiles/service";
import { loadPosts } from "@/lib/social/read-model";
import { unblockedUserWhere, visiblePostWhere } from "@/lib/social/visibility";
import type { SocialPage, SocialPostDto } from "@/lib/social/types";

const activitySchema = z.object({ filter: z.enum(["posts", "comments", "reposts"]).default("posts"), page: z.coerce.number().int().min(1).max(10000).default(1), publicOnly: z.boolean().default(false) });
export async function getActivity(userId: string, viewerUserId?: string | null, value: unknown = {}): Promise<SocialPage<SocialPostDto>> {
  const { page, filter, publicOnly } = activitySchema.parse(value);
  const profile = await db.innovationProfile.findFirst({ where: { userId, user: unblockedUserWhere(viewerUserId) }, select: { handle: true } });
  if ((publicOnly || userId !== viewerUserId) && (!profile?.handle || !(publicOnly ? await getPublicProfile(profile.handle) : await getVisibleProfile(profile.handle, viewerUserId)))) return { items: [], page, hasNext: false };
  if (filter === "comments") {
    const comments = await db.postComment.findMany({ where: { authorUserId: userId, deletedAt: null, hiddenByPostAuthorAt: null,
      author: unblockedUserWhere(viewerUserId), post: visiblePostWhere(viewerUserId, publicOnly),
      OR: [{ parentCommentId: null }, { parentComment: { hiddenByPostAuthorAt: null, author: unblockedUserWhere(viewerUserId) } }],
    }, select: { id: true, postId: true, body: true, createdAt: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 21 });
    const pageComments = comments.slice(0, 20);
    const posts = await loadPosts({ id: { in: pageComments.map((row) => row.postId) } }, viewerUserId, { take: 20, publicOnly });
    const byId = new Map(posts.map((post) => [post.id, post]));
    return { items: pageComments.flatMap((comment) => {
      const post = byId.get(comment.postId);
      return post ? [{ ...post, activityComment: { id: comment.id, body: comment.body, createdAt: comment.createdAt.toISOString() } }] : [];
    }), page, hasNext: comments.length > 20 };
  }
  const posts = await loadPosts({ authorUserId: userId, repostOfPostId: filter === "reposts" ? { not: null } : null }, viewerUserId, { skip: (page - 1) * 20, take: 21, publicOnly });
  return { items: posts.slice(0, 20), page, hasNext: posts.length > 20 };
}
