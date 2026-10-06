BEGIN;

-- CreateEnum
CREATE TYPE "FollowPolicy" AS ENUM ('EVERYONE', 'CONNECTIONS_ONLY');

-- CreateEnum
CREATE TYPE "PrimaryProfileAction" AS ENUM ('CONNECT', 'FOLLOW');

-- CreateEnum
CREATE TYPE "PostVisibility" AS ENUM ('PUBLIC', 'PLATFORM', 'CONNECTIONS');

-- CreateEnum
CREATE TYPE "PostCommentPolicy" AS ENUM ('EVERYONE', 'CONNECTIONS_ONLY', 'OFF');

-- CreateEnum
CREATE TYPE "ReactionType" AS ENUM ('LIKE', 'CELEBRATE', 'SUPPORT', 'LOVE', 'INSIGHTFUL', 'FUNNY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationKind" ADD VALUE 'NEW_FOLLOWER';
ALTER TYPE "NotificationKind" ADD VALUE 'POST_REACTION';
ALTER TYPE "NotificationKind" ADD VALUE 'POST_COMMENT';
ALTER TYPE "NotificationKind" ADD VALUE 'COMMENT_REPLY';
ALTER TYPE "NotificationKind" ADD VALUE 'COMMENT_REACTION';
ALTER TYPE "NotificationKind" ADD VALUE 'POST_REPOST';

-- AlterTable
ALTER TABLE "InnovationProfile" ADD COLUMN     "followPolicy" "FollowPolicy" NOT NULL DEFAULT 'EVERYONE',
ADD COLUMN     "primaryProfileAction" "PrimaryProfileAction" NOT NULL DEFAULT 'CONNECT';

-- AlterTable
ALTER TABLE "SafetyReport" ADD COLUMN     "commentId" TEXT,
ADD COLUMN     "postId" TEXT;

-- CreateTable
CREATE TABLE "UserFollow" (
    "id" TEXT NOT NULL,
    "followerUserId" TEXT NOT NULL,
    "followedUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "UserFollow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT,
    "visibility" "PostVisibility" NOT NULL DEFAULT 'PLATFORM',
    "commentPolicy" "PostCommentPolicy" NOT NULL DEFAULT 'EVERYONE',
    "allowReposts" BOOLEAN NOT NULL DEFAULT true,
    "externalUrl" TEXT,
    "repostOfPostId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostReaction" (
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ReactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostReaction_pkey" PRIMARY KEY ("postId","userId")
);

-- CreateTable
CREATE TABLE "PostComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "parentCommentId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "hiddenByPostAuthorAt" TIMESTAMP(3),

    CONSTRAINT "PostComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentReaction" (
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ReactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommentReaction_pkey" PRIMARY KEY ("commentId","userId")
);

-- CreateTable
CREATE TABLE "SavedPost" (
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedPost_pkey" PRIMARY KEY ("userId","postId")
);

-- CreateTable
CREATE TABLE "FeaturedPost" (
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeaturedPost_pkey" PRIMARY KEY ("userId","postId")
);

-- CreateTable
CREATE TABLE "SocialRateLimitEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" VARCHAR(32) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialRateLimitEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserFollow_followerUserId_endedAt_createdAt_id_idx" ON "UserFollow"("followerUserId", "endedAt", "createdAt", "id");

-- CreateIndex
CREATE INDEX "UserFollow_followedUserId_endedAt_createdAt_id_idx" ON "UserFollow"("followedUserId", "endedAt", "createdAt", "id");

-- CreateIndex
CREATE INDEX "SocialPost_authorUserId_deletedAt_createdAt_id_idx" ON "SocialPost"("authorUserId", "deletedAt", "createdAt", "id");

-- CreateIndex
CREATE INDEX "SocialPost_visibility_deletedAt_createdAt_id_idx" ON "SocialPost"("visibility", "deletedAt", "createdAt", "id");

-- CreateIndex
CREATE INDEX "SocialPost_repostOfPostId_deletedAt_idx" ON "SocialPost"("repostOfPostId", "deletedAt");

-- CreateIndex
CREATE INDEX "PostReaction_userId_createdAt_idx" ON "PostReaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PostComment_postId_parentCommentId_createdAt_id_idx" ON "PostComment"("postId", "parentCommentId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "PostComment_authorUserId_createdAt_id_idx" ON "PostComment"("authorUserId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PostComment_postId_id_key" ON "PostComment"("postId", "id");

-- CreateIndex
CREATE INDEX "CommentReaction_userId_createdAt_idx" ON "CommentReaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SavedPost_userId_createdAt_postId_idx" ON "SavedPost"("userId", "createdAt", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "FeaturedPost_userId_position_key" ON "FeaturedPost"("userId", "position");

-- CreateIndex
CREATE INDEX "SocialRateLimitEvent_userId_kind_createdAt_idx" ON "SocialRateLimitEvent"("userId", "kind", "createdAt");

-- AddForeignKey
ALTER TABLE "SafetyReport" ADD CONSTRAINT "SafetyReport_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SocialPost"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyReport" ADD CONSTRAINT "SafetyReport_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "PostComment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFollow" ADD CONSTRAINT "UserFollow_followerUserId_fkey" FOREIGN KEY ("followerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFollow" ADD CONSTRAINT "UserFollow_followedUserId_fkey" FOREIGN KEY ("followedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_repostOfPostId_fkey" FOREIGN KEY ("repostOfPostId") REFERENCES "SocialPost"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostReaction" ADD CONSTRAINT "PostReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostReaction" ADD CONSTRAINT "PostReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "PostComment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentReaction" ADD CONSTRAINT "CommentReaction_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "PostComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentReaction" ADD CONSTRAINT "CommentReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedPost" ADD CONSTRAINT "SavedPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedPost" ADD CONSTRAINT "SavedPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturedPost" ADD CONSTRAINT "FeaturedPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturedPost" ADD CONSTRAINT "FeaturedPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialRateLimitEvent" ADD CONSTRAINT "SocialRateLimitEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Active subscriptions are unique while ended periods remain available as history.
CREATE UNIQUE INDEX "UserFollow_active_pair_key" ON "UserFollow" ("followerUserId", "followedUserId") WHERE "endedAt" IS NULL;
ALTER TABLE "UserFollow" ADD CONSTRAINT "UserFollow_period_check" CHECK ("followerUserId" <> "followedUserId" AND ("endedAt" IS NULL OR "endedAt" >= "createdAt"));
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_content_check" CHECK (
  ("body" IS NULL OR char_length(btrim("body")) BETWEEN 1 AND 3000)
  AND ("body" IS NOT NULL OR "externalUrl" IS NOT NULL OR "repostOfPostId" IS NOT NULL)
  AND ("externalUrl" IS NULL OR (char_length("externalUrl") <= 2000 AND "externalUrl" ~ '^https://[^/?#[:space:]@]+([/?#][^[:space:]]*)?$'))
  AND "repostOfPostId" IS DISTINCT FROM "id"
);
CREATE UNIQUE INDEX "SocialPost_active_simple_repost_key" ON "SocialPost" ("authorUserId", "repostOfPostId") WHERE "repostOfPostId" IS NOT NULL AND "body" IS NULL AND "deletedAt" IS NULL;
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_content_check" CHECK (char_length(btrim("body")) BETWEEN 1 AND 1500 AND "parentCommentId" IS DISTINCT FROM "id");
ALTER TABLE "FeaturedPost" ADD CONSTRAINT "FeaturedPost_position_check" CHECK ("position" BETWEEN 0 AND 2);
ALTER TABLE "SocialRateLimitEvent" ADD CONSTRAINT "SocialRateLimitEvent_kind_check" CHECK ("kind" IN ('POST', 'COMMENT', 'REACTION', 'FOLLOW'));
ALTER TABLE "SafetyReport" ADD CONSTRAINT "SafetyReport_social_context_check" CHECK (
  ("commentId" IS NULL OR "postId" IS NOT NULL)
  AND NOT (("postId" IS NOT NULL OR "commentId" IS NOT NULL) AND ("conversationId" IS NOT NULL OR "messageId" IS NOT NULL))
);

CREATE FUNCTION "guard_social_post_identity"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE original "SocialPost";
BEGIN
  IF TG_OP = 'UPDATE' AND ROW(NEW."id", NEW."authorUserId", NEW."createdAt", NEW."repostOfPostId") IS DISTINCT FROM ROW(OLD."id", OLD."authorUserId", OLD."createdAt", OLD."repostOfPostId") THEN
    RAISE EXCEPTION 'SOCIAL_POST_IDENTITY_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."deletedAt" IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'SOCIAL_POST_DELETED' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' AND NEW."repostOfPostId" IS NOT NULL THEN
    SELECT * INTO original FROM "SocialPost" WHERE "id" = NEW."repostOfPostId" FOR SHARE;
    IF original."id" IS NULL OR original."repostOfPostId" IS NOT NULL OR original."deletedAt" IS NOT NULL OR NOT original."allowReposts" OR original."visibility" = 'CONNECTIONS' OR (original."visibility" = 'PLATFORM' AND NEW."visibility" = 'PUBLIC') THEN
      RAISE EXCEPTION 'SOCIAL_REPOST_UNAVAILABLE' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "SocialPost_identity_guard" BEFORE INSERT OR UPDATE ON "SocialPost" FOR EACH ROW EXECUTE FUNCTION "guard_social_post_identity"();

CREATE FUNCTION "guard_social_comment_identity"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND ROW(NEW."id", NEW."postId", NEW."authorUserId", NEW."parentCommentId", NEW."createdAt") IS DISTINCT FROM ROW(OLD."id", OLD."postId", OLD."authorUserId", OLD."parentCommentId", OLD."createdAt") THEN
    RAISE EXCEPTION 'SOCIAL_COMMENT_IDENTITY_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' AND NEW."parentCommentId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "PostComment" WHERE "id" = NEW."parentCommentId" AND "postId" = NEW."postId" AND "parentCommentId" IS NULL) THEN
    RAISE EXCEPTION 'SOCIAL_COMMENT_PARENT_INVALID' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "PostComment_identity_guard" BEFORE INSERT OR UPDATE ON "PostComment" FOR EACH ROW EXECUTE FUNCTION "guard_social_comment_identity"();

CREATE FUNCTION "guard_social_report_target"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."commentId" IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM "PostComment" WHERE "id" = NEW."commentId" AND "postId" = NEW."postId" AND "authorUserId" = NEW."reportedUserId") THEN
      RAISE EXCEPTION 'SAFETY_CONTEXT_UNAVAILABLE' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW."postId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "SocialPost" WHERE "id" = NEW."postId" AND "authorUserId" = NEW."reportedUserId") THEN
    RAISE EXCEPTION 'SAFETY_CONTEXT_UNAVAILABLE' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "SafetyReport_social_target_guard" BEFORE INSERT OR UPDATE ON "SafetyReport" FOR EACH ROW EXECUTE FUNCTION "guard_social_report_target"();

CREATE FUNCTION "guard_featured_post_owner"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "SocialPost" WHERE "id" = NEW."postId" AND "authorUserId" = NEW."userId" AND "deletedAt" IS NULL) THEN
    RAISE EXCEPTION 'SOCIAL_AUTHOR_REQUIRED' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "FeaturedPost_owner_guard" BEFORE INSERT OR UPDATE ON "FeaturedPost" FOR EACH ROW EXECUTE FUNCTION "guard_featured_post_owner"();

COMMIT;
