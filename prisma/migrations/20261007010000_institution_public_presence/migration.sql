BEGIN;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MediaKind" ADD VALUE 'ORGANIZATION_LOGO';
ALTER TYPE "MediaKind" ADD VALUE 'ORGANIZATION_COVER';

-- AlterTable
ALTER TABLE "FundingProgram" ADD COLUMN     "publicPageEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SafetyReport" ADD COLUMN     "reportedOrganizationId" TEXT,
ALTER COLUMN "reportedUserId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SocialPost" ADD COLUMN     "authorOrganizationId" TEXT,
ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "fundingProgramId" TEXT,
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "authorUserId" DROP NOT NULL;
UPDATE "SocialPost" SET "createdByUserId" = "authorUserId" WHERE "createdByUserId" IS NULL;
ALTER TABLE "SocialPost" ALTER COLUMN "createdByUserId" SET NOT NULL;

-- AlterTable
ALTER TABLE "PostComment" ADD COLUMN     "hiddenByUserId" TEXT;

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "ownerOrganizationId" TEXT,
ALTER COLUMN "ownerUserId" DROP NOT NULL;

ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_author_check" CHECK (
  num_nonnulls("authorUserId", "authorOrganizationId") = 1
  AND "createdByUserId" IS NOT NULL
  AND ("authorOrganizationId" IS NOT NULL OR "createdByUserId" = "authorUserId")
  AND ("authorOrganizationId" IS NOT NULL OR "fundingProgramId" IS NULL)
  AND ("authorOrganizationId" IS NULL OR ("repostOfPostId" IS NULL AND "visibility" <> 'CONNECTIONS' AND "commentPolicy" <> 'CONNECTIONS_ONLY'))
  AND "revision" >= 0
);
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_owner_check" CHECK (num_nonnulls("ownerUserId", "ownerOrganizationId") = 1);
ALTER TABLE "SafetyReport" ADD CONSTRAINT "SafetyReport_reported_principal_check" CHECK (num_nonnulls("reportedUserId", "reportedOrganizationId") = 1);

-- CreateTable
CREATE TABLE "OrganizationProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "headline" VARCHAR(180),
    "description" TEXT,
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "country" VARCHAR(100),
    "websiteUrl" VARCHAR(2000),
    "focusAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "logoMediaId" TEXT,
    "coverMediaId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationFollow" (
    "id" TEXT NOT NULL,
    "followerUserId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "OrganizationFollow_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "OrganizationFollow" ADD CONSTRAINT "OrganizationFollow_period_check" CHECK ("endedAt" IS NULL OR "endedAt" >= "createdAt");

-- CreateTable
CREATE TABLE "OrganizationPostRevision" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "action" VARCHAR(16) NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationPostRevision_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "OrganizationPostRevision" ADD CONSTRAINT "OrganizationPostRevision_action_check" CHECK ("action" IN ('CREATE', 'UPDATE', 'DELETE') AND "revision" > 0);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationProfile_organizationId_key" ON "OrganizationProfile"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationProfile_logoMediaId_key" ON "OrganizationProfile"("logoMediaId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationProfile_coverMediaId_key" ON "OrganizationProfile"("coverMediaId");

-- CreateIndex
CREATE INDEX "OrganizationProfile_publishedAt_organizationId_idx" ON "OrganizationProfile"("publishedAt", "organizationId");

-- CreateIndex
CREATE INDEX "OrganizationFollow_followerUserId_endedAt_createdAt_id_idx" ON "OrganizationFollow"("followerUserId", "endedAt", "createdAt", "id");

-- CreateIndex
CREATE INDEX "OrganizationFollow_organizationId_endedAt_createdAt_id_idx" ON "OrganizationFollow"("organizationId", "endedAt", "createdAt", "id");

-- CreateIndex
CREATE INDEX "OrganizationPostRevision_organizationId_changedAt_id_idx" ON "OrganizationPostRevision"("organizationId", "changedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationPostRevision_postId_revision_key" ON "OrganizationPostRevision"("postId", "revision");

-- CreateIndex
CREATE INDEX "SocialPost_authorOrganizationId_deletedAt_createdAt_id_idx" ON "SocialPost"("authorOrganizationId", "deletedAt", "createdAt", "id");
CREATE INDEX "FundingProgram_organizationId_publicPageEnabled_publishedAt_status_idx" ON "FundingProgram"("organizationId", "publicPageEnabled", "publishedAt", "status");

-- CreateIndex
CREATE INDEX "MediaAsset_ownerOrganizationId_status_createdAt_idx" ON "MediaAsset"("ownerOrganizationId", "status", "createdAt");
CREATE UNIQUE INDEX "OrganizationFollow_active_pair_key" ON "OrganizationFollow"("followerUserId", "organizationId") WHERE "endedAt" IS NULL;

-- AddForeignKey
ALTER TABLE "OrganizationProfile" ADD CONSTRAINT "OrganizationProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationProfile" ADD CONSTRAINT "OrganizationProfile_logoMediaId_fkey" FOREIGN KEY ("logoMediaId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationProfile" ADD CONSTRAINT "OrganizationProfile_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationFollow" ADD CONSTRAINT "OrganizationFollow_followerUserId_fkey" FOREIGN KEY ("followerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationFollow" ADD CONSTRAINT "OrganizationFollow_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyReport" ADD CONSTRAINT "SafetyReport_reportedOrganizationId_fkey" FOREIGN KEY ("reportedOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_authorOrganizationId_fkey" FOREIGN KEY ("authorOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_authorOrganizationId_fundingProgramId_fkey" FOREIGN KEY ("authorOrganizationId", "fundingProgramId") REFERENCES "FundingProgram"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationPostRevision" ADD CONSTRAINT "OrganizationPostRevision_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationPostRevision" ADD CONSTRAINT "OrganizationPostRevision_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SocialPost"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationPostRevision" ADD CONSTRAINT "OrganizationPostRevision_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_hiddenByUserId_fkey" FOREIGN KEY ("hiddenByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_ownerOrganizationId_fkey" FOREIGN KEY ("ownerOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "guard_institutional_social_post"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  organization_status "OrganizationStatus";
  profile_published_at TIMESTAMP(3);
  program_public BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' AND ROW(NEW."id", NEW."authorUserId", NEW."authorOrganizationId", NEW."createdByUserId", NEW."createdAt", NEW."repostOfPostId")
    IS DISTINCT FROM ROW(OLD."id", OLD."authorUserId", OLD."authorOrganizationId", OLD."createdByUserId", OLD."createdAt", OLD."repostOfPostId") THEN
    RAISE EXCEPTION 'SOCIAL_POST_IDENTITY_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."deletedAt" IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'SOCIAL_POST_DELETED' USING ERRCODE = '23514';
  END IF;
  IF NEW."authorOrganizationId" IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND NEW."revision" < 1 THEN
    RAISE EXCEPTION 'ORGANIZATION_POST_REVISION_INVALID' USING ERRCODE = '23514';
  END IF;
  SELECT org."status", profile."publishedAt" INTO organization_status, profile_published_at
    FROM "Organization" org
    LEFT JOIN "OrganizationProfile" profile ON profile."organizationId" = org."id"
    WHERE org."id" = NEW."authorOrganizationId" FOR SHARE OF org;
  IF organization_status IS DISTINCT FROM 'ACTIVE' THEN
    RAISE EXCEPTION 'ORGANIZATION_INACTIVE' USING ERRCODE = '23514';
  END IF;
  IF NEW."visibility" = 'PUBLIC' AND profile_published_at IS NULL THEN
    RAISE EXCEPTION 'INSTITUTION_PAGE_NOT_PUBLISHED' USING ERRCODE = '23514';
  END IF;
  IF NEW."fundingProgramId" IS NOT NULL AND NEW."visibility" = 'PUBLIC' THEN
    SELECT "publicPageEnabled" AND "publishedAt" IS NOT NULL INTO program_public
      FROM "FundingProgram" WHERE "organizationId" = NEW."authorOrganizationId" AND "id" = NEW."fundingProgramId" FOR SHARE;
    IF program_public IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'PROGRAM_PAGE_NOT_PUBLISHED' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW."body", NEW."externalUrl", NEW."visibility", NEW."commentPolicy", NEW."allowReposts", NEW."fundingProgramId", NEW."deletedAt")
      IS DISTINCT FROM ROW(OLD."body", OLD."externalUrl", OLD."visibility", OLD."commentPolicy", OLD."allowReposts", OLD."fundingProgramId", OLD."deletedAt") THEN
      IF NEW."revision" <> OLD."revision" + 1 OR NEW."editedAt" IS NULL THEN
        RAISE EXCEPTION 'ORGANIZATION_POST_REVISION_REQUIRED' USING ERRCODE = '23514';
      END IF;
    ELSIF NEW."revision" <> OLD."revision" THEN
      RAISE EXCEPTION 'ORGANIZATION_POST_REVISION_INVALID' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER "SocialPost_identity_guard" ON "SocialPost";
CREATE TRIGGER "SocialPost_identity_guard" BEFORE INSERT OR UPDATE ON "SocialPost" FOR EACH ROW EXECUTE FUNCTION "guard_institutional_social_post"();

CREATE FUNCTION "guard_social_media_attachment_institution"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND ROW(NEW."postId", NEW."mediaId") IS DISTINCT FROM ROW(OLD."postId", OLD."mediaId") THEN
    RAISE EXCEPTION 'MEDIA_ATTACHMENT_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "MediaAsset" asset JOIN "SocialPost" post ON post."id" = NEW."postId"
    WHERE asset."id" = NEW."mediaId" AND asset."kind" = 'POST_IMAGE' AND asset."status" = 'READY'
      AND asset."deletedAt" IS NULL AND post."deletedAt" IS NULL
      AND ((post."authorUserId" IS NOT NULL AND asset."ownerUserId" = post."authorUserId" AND asset."ownerOrganizationId" IS NULL)
        OR (post."authorOrganizationId" IS NOT NULL AND asset."ownerOrganizationId" = post."authorOrganizationId" AND asset."ownerUserId" IS NULL))
  ) THEN RAISE EXCEPTION 'MEDIA_ATTACHMENT_INVALID' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER "SocialPostMedia_attachment_guard" ON "SocialPostMedia";
CREATE TRIGGER "SocialPostMedia_attachment_guard" BEFORE INSERT OR UPDATE ON "SocialPostMedia" FOR EACH ROW EXECUTE FUNCTION "guard_social_media_attachment_institution"();

CREATE FUNCTION "guard_organization_profile_media"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."logoMediaId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "MediaAsset" asset WHERE asset."id" = NEW."logoMediaId" AND asset."ownerOrganizationId" = NEW."organizationId"
      AND asset."ownerUserId" IS NULL AND asset."kind"::text = 'ORGANIZATION_LOGO' AND asset."status" = 'READY' AND asset."deletedAt" IS NULL
  ) THEN RAISE EXCEPTION 'MEDIA_ATTACHMENT_INVALID' USING ERRCODE = '23514'; END IF;
  IF NEW."coverMediaId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "MediaAsset" asset WHERE asset."id" = NEW."coverMediaId" AND asset."ownerOrganizationId" = NEW."organizationId"
      AND asset."ownerUserId" IS NULL AND asset."kind"::text = 'ORGANIZATION_COVER' AND asset."status" = 'READY' AND asset."deletedAt" IS NULL
  ) THEN RAISE EXCEPTION 'MEDIA_ATTACHMENT_INVALID' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "OrganizationProfile_media_guard" BEFORE INSERT OR UPDATE OF "logoMediaId", "coverMediaId", "organizationId" ON "OrganizationProfile" FOR EACH ROW EXECUTE FUNCTION "guard_organization_profile_media"();

CREATE FUNCTION "guard_media_asset_state_institution"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW."id", NEW."ownerUserId", NEW."ownerOrganizationId", NEW."kind", NEW."storageKey", NEW."createdAt") IS DISTINCT FROM ROW(OLD."id", OLD."ownerUserId", OLD."ownerOrganizationId", OLD."kind", OLD."storageKey", OLD."createdAt") THEN
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
    EXISTS (SELECT 1 FROM "OrganizationProfile" WHERE "logoMediaId" = NEW."id" OR "coverMediaId" = NEW."id") OR
    EXISTS (SELECT 1 FROM "SocialPostMedia" media JOIN "SocialPost" post ON post."id" = media."postId" WHERE media."mediaId" = NEW."id" AND post."deletedAt" IS NULL)
  ) THEN RAISE EXCEPTION 'MEDIA_STILL_ATTACHED' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER "MediaAsset_state_guard" ON "MediaAsset";
CREATE TRIGGER "MediaAsset_state_guard" BEFORE UPDATE ON "MediaAsset" FOR EACH ROW EXECUTE FUNCTION "guard_media_asset_state_institution"();

CREATE FUNCTION "guard_organization_post_revision"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'ORGANIZATION_POST_REVISION_IMMUTABLE' USING ERRCODE = '23514'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "SocialPost" WHERE "id" = NEW."postId" AND "authorOrganizationId" = NEW."organizationId" AND "revision" = NEW."revision") THEN
    RAISE EXCEPTION 'ORGANIZATION_POST_REVISION_INVALID' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "OrganizationPostRevision_immutable" BEFORE INSERT OR UPDATE OR DELETE ON "OrganizationPostRevision" FOR EACH ROW EXECUTE FUNCTION "guard_organization_post_revision"();

CREATE OR REPLACE FUNCTION "guard_social_report_target"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."commentId" IS NOT NULL THEN
    IF NEW."reportedOrganizationId" IS NOT NULL OR NOT EXISTS (
      SELECT 1 FROM "PostComment" comment JOIN "SocialPost" post ON post."id" = comment."postId"
      WHERE comment."id" = NEW."commentId" AND comment."postId" = NEW."postId" AND comment."authorUserId" = NEW."reportedUserId"
    ) THEN RAISE EXCEPTION 'SAFETY_CONTEXT_UNAVAILABLE' USING ERRCODE = '23514'; END IF;
  ELSIF NEW."postId" IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM "SocialPost" post WHERE post."id" = NEW."postId"
        AND ((post."authorUserId" IS NOT NULL AND post."authorUserId" = NEW."reportedUserId" AND NEW."reportedOrganizationId" IS NULL)
          OR (post."authorOrganizationId" IS NOT NULL AND post."authorOrganizationId" = NEW."reportedOrganizationId" AND NEW."reportedUserId" IS NULL))
    ) THEN RAISE EXCEPTION 'SAFETY_CONTEXT_UNAVAILABLE' USING ERRCODE = '23514'; END IF;
  ELSIF NEW."reportedUserId" IS NULL THEN
    RAISE EXCEPTION 'SAFETY_CONTEXT_UNAVAILABLE' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;

