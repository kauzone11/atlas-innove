import type { PostCommentPolicy, PostVisibility, ReactionType } from "@prisma/client";

export type SocialIdentity = { userId: string; fullName: string; handle: string | null; headline: string | null };
export type SocialPostDto = {
  id: string; author: SocialIdentity; body: string | null; externalUrl: string | null;
  visibility: PostVisibility; commentPolicy: PostCommentPolicy; allowReposts: boolean;
  createdAt: string; editedAt: string | null; repostOfPostId: string | null;
  original: SocialPostDto | null; reactionCount: number; commentCount: number; repostCount: number;
  viewerReaction: ReactionType | null; saved: boolean; featured: boolean;
  canEdit: boolean; canComment: boolean; canRepost: boolean;
  activityComment?: { id: string; body: string; createdAt: string };
};
export type SocialCommentDto = {
  id: string; postId: string; parentCommentId: string | null; author: SocialIdentity;
  body: string | null; createdAt: string; editedAt: string | null; deleted: boolean; hidden: boolean;
  reactionCount: number; viewerReaction: ReactionType | null;
  canEdit: boolean; canHide: boolean; isPostAuthor: boolean;
};
export type SocialPage<T> = { items: T[]; page: number; hasNext: boolean };
export type FeedPage = { items: SocialPostDto[]; nextCursor: string | null; mode: "RECENT" | "HIGHLIGHTS" };
