BEGIN;
-- CreateEnum
CREATE TYPE "VisibilityScope" AS ENUM ('PUBLIC', 'PLATFORM', 'TEAM', 'PRIVATE');

-- CreateEnum
CREATE TYPE "ProfileTopicType" AS ENUM ('SKILL', 'INTEREST');

-- CreateEnum
CREATE TYPE "ProfileLinkType" AS ENUM ('WEBSITE', 'LINKEDIN', 'GITHUB', 'ORCID', 'PORTFOLIO', 'OTHER');

-- CreateEnum
CREATE TYPE "OpportunitySupportType" AS ENUM ('SUBVENTION', 'SCHOLARSHIP', 'CREDIT', 'RESIDENCY', 'ACCELERATION', 'PRIZE', 'SERVICES', 'OTHER');

-- CreateEnum
CREATE TYPE "OpportunityTerritoryScope" AS ENUM ('MUNICIPAL', 'STATE', 'REGIONAL', 'NATIONAL', 'INTERNATIONAL', 'UNSPECIFIED');

-- AlterTable
ALTER TABLE "FundingCall" ADD COLUMN     "audienceTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "eligibleStates" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "publicListingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supportType" "OpportunitySupportType" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "territoryLabel" TEXT,
ADD COLUMN     "territoryScope" "OpportunityTerritoryScope" NOT NULL DEFAULT 'UNSPECIFIED',
ADD COLUMN     "thematicAreas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "FundingCallDocument" ADD COLUMN     "publicListingEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "audienceTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "eligibleStates" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "publicListingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supportType" "OpportunitySupportType" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "territoryLabel" TEXT,
ADD COLUMN     "territoryScope" "OpportunityTerritoryScope" NOT NULL DEFAULT 'UNSPECIFIED',
ADD COLUMN     "thematicAreas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "demoUrl" TEXT,
ADD COLUMN     "publicSlug" VARCHAR(64),
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "repositoryUrl" TEXT,
ADD COLUMN     "thematicAreas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "visibility" "VisibilityScope" NOT NULL DEFAULT 'PRIVATE',
ADD COLUMN     "websiteUrl" TEXT;

-- CreateTable
CREATE TABLE "InnovationProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "handle" VARCHAR(64),
    "headline" TEXT,
    "bio" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "profileVisibility" "VisibilityScope" NOT NULL DEFAULT 'PRIVATE',
    "skillsVisibility" "VisibilityScope" NOT NULL DEFAULT 'PRIVATE',
    "experienceVisibility" "VisibilityScope" NOT NULL DEFAULT 'PRIVATE',
    "educationVisibility" "VisibilityScope" NOT NULL DEFAULT 'PRIVATE',
    "linksVisibility" "VisibilityScope" NOT NULL DEFAULT 'PRIVATE',
    "verifiedParticipationVisibility" "VisibilityScope" NOT NULL DEFAULT 'PRIVATE',
    "projectsVisibility" "VisibilityScope" NOT NULL DEFAULT 'PRIVATE',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InnovationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileTopic" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "type" "ProfileTopicType" NOT NULL,
    "label" TEXT NOT NULL,
    "normalizedKey" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProfileTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileEducation" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "course" TEXT NOT NULL,
    "degree" TEXT,
    "startsAt" DATE,
    "endsAt" DATE,
    "description" TEXT,
    "visibility" "VisibilityScope" NOT NULL DEFAULT 'PRIVATE',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProfileEducation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileExperience" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" DATE NOT NULL,
    "endsAt" DATE,
    "current" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "visibility" "VisibilityScope" NOT NULL DEFAULT 'PRIVATE',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProfileExperience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileLink" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" "ProfileLinkType" NOT NULL DEFAULT 'OTHER',
    "visibility" "VisibilityScope" NOT NULL DEFAULT 'PRIVATE',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProfileLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedFundingCall" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fundingCallId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedFundingCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedExternalOpportunity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedExternalOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InnovationProfile_userId_key" ON "InnovationProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InnovationProfile_handle_key" ON "InnovationProfile"("handle");

-- CreateIndex
CREATE INDEX "ProfileTopic_profileId_type_position_idx" ON "ProfileTopic"("profileId", "type", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileTopic_profileId_type_normalizedKey_key" ON "ProfileTopic"("profileId", "type", "normalizedKey");

-- CreateIndex
CREATE INDEX "ProfileEducation_profileId_position_idx" ON "ProfileEducation"("profileId", "position");

-- CreateIndex
CREATE INDEX "ProfileExperience_profileId_position_idx" ON "ProfileExperience"("profileId", "position");

-- CreateIndex
CREATE INDEX "ProfileLink_profileId_position_idx" ON "ProfileLink"("profileId", "position");

-- CreateIndex
CREATE INDEX "SavedFundingCall_userId_createdAt_idx" ON "SavedFundingCall"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavedFundingCall_userId_fundingCallId_key" ON "SavedFundingCall"("userId", "fundingCallId");

-- CreateIndex
CREATE INDEX "SavedExternalOpportunity_userId_createdAt_idx" ON "SavedExternalOpportunity"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavedExternalOpportunity_userId_opportunityId_key" ON "SavedExternalOpportunity"("userId", "opportunityId");

-- CreateIndex
CREATE INDEX "FundingCall_publicListingEnabled_status_applicationEndsAt_idx" ON "FundingCall"("publicListingEnabled", "status", "applicationEndsAt");

-- CreateIndex
CREATE INDEX "Opportunity_publicListingEnabled_status_applicationEndsAt_idx" ON "Opportunity"("publicListingEnabled", "status", "applicationEndsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Project_publicSlug_key" ON "Project"("publicSlug");

-- AddForeignKey
ALTER TABLE "InnovationProfile" ADD CONSTRAINT "InnovationProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileTopic" ADD CONSTRAINT "ProfileTopic_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "InnovationProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileEducation" ADD CONSTRAINT "ProfileEducation_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "InnovationProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileExperience" ADD CONSTRAINT "ProfileExperience_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "InnovationProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileLink" ADD CONSTRAINT "ProfileLink_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "InnovationProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedFundingCall" ADD CONSTRAINT "SavedFundingCall_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedFundingCall" ADD CONSTRAINT "SavedFundingCall_fundingCallId_fkey" FOREIGN KEY ("fundingCallId") REFERENCES "FundingCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedExternalOpportunity" ADD CONSTRAINT "SavedExternalOpportunity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedExternalOpportunity" ADD CONSTRAINT "SavedExternalOpportunity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
