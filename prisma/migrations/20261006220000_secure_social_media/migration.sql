BEGIN;

CREATE TYPE "MediaKind" AS ENUM ('PROFILE_AVATAR', 'PROFILE_COVER', 'POST_IMAGE');
CREATE TYPE "MediaStatus" AS ENUM ('PENDING', 'READY', 'DELETED');
CREATE TABLE "MediaAsset" (
  "id" TEXT PRIMARY KEY,
  "ownerUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "kind" "MediaKind" NOT NULL,
  "storageKey" TEXT NOT NULL UNIQUE,
  "mimeType" TEXT NOT NULL DEFAULT 'image/webp',
  "sizeBytes" INTEGER NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "derivatives" JSONB NOT NULL,
  "status" "MediaStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  "physicalDeletedAt" TIMESTAMP(3),
  CONSTRAINT "MediaAsset_dimensions_check" CHECK ("width" BETWEEN 1 AND 10000 AND "height" BETWEEN 1 AND 10000 AND "sizeBytes" > 0 AND "mimeType" = 'image/webp'),
  CONSTRAINT "MediaAsset_deleted_check" CHECK (("status" = 'DELETED') = ("deletedAt" IS NOT NULL) AND ("physicalDeletedAt" IS NULL OR "status" = 'DELETED'))
);
CREATE INDEX "MediaAsset_ownerUserId_status_createdAt_idx" ON "MediaAsset"("ownerUserId", "status", "createdAt");
CREATE INDEX "MediaAsset_status_createdAt_physicalDeletedAt_idx" ON "MediaAsset"("status", "createdAt", "physicalDeletedAt");
ALTER TABLE "InnovationProfile" ADD COLUMN "avatarMediaId" TEXT UNIQUE REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InnovationProfile" ADD COLUMN "coverMediaId" TEXT UNIQUE REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "SocialPostMedia" (
  "postId" TEXT NOT NULL REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "mediaId" TEXT NOT NULL UNIQUE REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "position" INTEGER NOT NULL,
  "altText" TEXT,
  CONSTRAINT "SocialPostMedia_pkey" PRIMARY KEY ("postId", "position"),
  CONSTRAINT "SocialPostMedia_position_check" CHECK ("position" BETWEEN 0 AND 3),
  CONSTRAINT "SocialPostMedia_altText_check" CHECK ("altText" IS NULL OR char_length("altText") <= 500)
);

ALTER TABLE "SocialPost" DROP CONSTRAINT "SocialPost_content_check";
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_content_check" CHECK (
  ("body" IS NULL OR char_length(btrim("body")) BETWEEN 1 AND 3000)
  AND ("externalUrl" IS NULL OR (char_length("externalUrl") <= 2000 AND "externalUrl" ~ '^https://[^/?#[:space:]@]+([/?#][^[:space:]]*)?$'))
  AND "repostOfPostId" IS DISTINCT FROM "id"
);
ALTER TABLE "SocialRateLimitEvent" DROP CONSTRAINT "SocialRateLimitEvent_kind_check";
ALTER TABLE "SocialRateLimitEvent" ADD CONSTRAINT "SocialRateLimitEvent_kind_check" CHECK ("kind" IN ('POST', 'COMMENT', 'REACTION', 'FOLLOW', 'UPLOAD'));

-- The post and its images are created in one transaction; validate content after both exist.
CREATE FUNCTION "guard_social_post_content"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_id TEXT;
BEGIN
  IF TG_TABLE_NAME = 'SocialPost' THEN target_id := COALESCE(NEW."id", OLD."id");
  ELSE target_id := COALESCE(NEW."postId", OLD."postId"); END IF;
  IF EXISTS (SELECT 1 FROM "SocialPost" post WHERE post."id" = target_id AND post."deletedAt" IS NULL
    AND post."body" IS NULL AND post."externalUrl" IS NULL AND post."repostOfPostId" IS NULL
    AND NOT EXISTS (SELECT 1 FROM "SocialPostMedia" media JOIN "MediaAsset" asset ON asset."id" = media."mediaId" WHERE media."postId" = post."id" AND asset."status" = 'READY')) THEN
    RAISE EXCEPTION 'SOCIAL_POST_EMPTY' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER "SocialPost_content_guard" AFTER INSERT OR UPDATE ON "SocialPost" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "guard_social_post_content"();
CREATE CONSTRAINT TRIGGER "SocialPostMedia_content_guard" AFTER INSERT OR UPDATE OR DELETE ON "SocialPostMedia" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "guard_social_post_content"();

CREATE FUNCTION "guard_social_media_attachment"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND ROW(NEW."postId", NEW."mediaId") IS DISTINCT FROM ROW(OLD."postId", OLD."mediaId") THEN
    RAISE EXCEPTION 'MEDIA_ATTACHMENT_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "MediaAsset" asset JOIN "SocialPost" post ON post."id" = NEW."postId"
    WHERE asset."id" = NEW."mediaId" AND asset."ownerUserId" = post."authorUserId" AND asset."kind" = 'POST_IMAGE'
    AND asset."status" = 'READY' AND asset."deletedAt" IS NULL AND post."deletedAt" IS NULL) THEN
    RAISE EXCEPTION 'MEDIA_ATTACHMENT_INVALID' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "SocialPostMedia_attachment_guard" BEFORE INSERT OR UPDATE ON "SocialPostMedia" FOR EACH ROW EXECUTE FUNCTION "guard_social_media_attachment"();

CREATE FUNCTION "guard_profile_media_attachment"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."avatarMediaId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "MediaAsset" WHERE "id" = NEW."avatarMediaId" AND "ownerUserId" = NEW."userId" AND "kind" = 'PROFILE_AVATAR' AND "status" = 'READY' AND "deletedAt" IS NULL) THEN
    RAISE EXCEPTION 'MEDIA_ATTACHMENT_INVALID' USING ERRCODE = '23514';
  END IF;
  IF NEW."coverMediaId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "MediaAsset" WHERE "id" = NEW."coverMediaId" AND "ownerUserId" = NEW."userId" AND "kind" = 'PROFILE_COVER' AND "status" = 'READY' AND "deletedAt" IS NULL) THEN
    RAISE EXCEPTION 'MEDIA_ATTACHMENT_INVALID' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "InnovationProfile_media_guard" BEFORE INSERT OR UPDATE OF "avatarMediaId", "coverMediaId", "userId" ON "InnovationProfile" FOR EACH ROW EXECUTE FUNCTION "guard_profile_media_attachment"();

CREATE FUNCTION "guard_media_asset_state"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW."id", NEW."ownerUserId", NEW."kind", NEW."storageKey", NEW."createdAt") IS DISTINCT FROM ROW(OLD."id", OLD."ownerUserId", OLD."kind", OLD."storageKey", OLD."createdAt") THEN
    RAISE EXCEPTION 'MEDIA_IDENTITY_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF OLD."status" = 'DELETED' AND NEW."status" <> 'DELETED' OR OLD."status" = 'READY' AND NEW."status" = 'PENDING' THEN
    RAISE EXCEPTION 'MEDIA_STATE_INVALID' USING ERRCODE = '23514';
  END IF;
  IF OLD."status" <> 'PENDING' AND ROW(NEW."derivatives", NEW."width", NEW."height", NEW."sizeBytes", NEW."mimeType") IS DISTINCT FROM ROW(OLD."derivatives", OLD."width", OLD."height", OLD."sizeBytes", OLD."mimeType") THEN
    RAISE EXCEPTION 'MEDIA_CONTENT_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF NEW."status" = 'DELETED' AND (
    EXISTS (SELECT 1 FROM "InnovationProfile" WHERE "avatarMediaId" = NEW."id" OR "coverMediaId" = NEW."id") OR
    EXISTS (SELECT 1 FROM "SocialPostMedia" media JOIN "SocialPost" post ON post."id" = media."postId" WHERE media."mediaId" = NEW."id" AND post."deletedAt" IS NULL)
  ) THEN RAISE EXCEPTION 'MEDIA_STILL_ATTACHED' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "MediaAsset_state_guard" BEFORE UPDATE ON "MediaAsset" FOR EACH ROW EXECUTE FUNCTION "guard_media_asset_state"();

COMMIT;
