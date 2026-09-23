-- CreateEnum
CREATE TYPE "FundingProgramStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CohortStatus" AS ENUM ('PLANNED', 'ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VentureKind" AS ENUM ('COMPANY', 'PROJECT', 'INITIATIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "VentureEnrollmentStatus" AS ENUM ('ACTIVE', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "FundingProgram" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT,
    "status" "FundingProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FundingProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cohort" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fundingProgramId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "referenceYear" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "status" "CohortStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Cohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venture" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "kind" "VentureKind" NOT NULL,
    "externalReference" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Venture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VentureEnrollment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "ventureId" TEXT NOT NULL,
    "externalReference" TEXT,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "VentureEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VentureEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FundingProgram_organizationId_id_key" ON "FundingProgram"("organizationId", "id");
CREATE UNIQUE INDEX "FundingProgram_organizationId_slug_key" ON "FundingProgram"("organizationId", "slug");
CREATE INDEX "FundingProgram_organizationId_status_idx" ON "FundingProgram"("organizationId", "status");
CREATE UNIQUE INDEX "Cohort_organizationId_id_key" ON "Cohort"("organizationId", "id");
CREATE INDEX "Cohort_organizationId_fundingProgramId_status_idx" ON "Cohort"("organizationId", "fundingProgramId", "status");
CREATE UNIQUE INDEX "Venture_organizationId_id_key" ON "Venture"("organizationId", "id");
CREATE INDEX "Venture_organizationId_kind_archivedAt_idx" ON "Venture"("organizationId", "kind", "archivedAt");
CREATE UNIQUE INDEX "VentureEnrollment_organizationId_cohortId_ventureId_key" ON "VentureEnrollment"("organizationId", "cohortId", "ventureId");
CREATE INDEX "VentureEnrollment_organizationId_cohortId_status_idx" ON "VentureEnrollment"("organizationId", "cohortId", "status");
CREATE INDEX "VentureEnrollment_organizationId_ventureId_status_idx" ON "VentureEnrollment"("organizationId", "ventureId", "status");

-- AddForeignKey
ALTER TABLE "FundingProgram" ADD CONSTRAINT "FundingProgram_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FundingProgram" ADD CONSTRAINT "FundingProgram_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_organizationId_fundingProgramId_fkey" FOREIGN KEY ("organizationId", "fundingProgramId") REFERENCES "FundingProgram"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Venture" ADD CONSTRAINT "Venture_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VentureEnrollment" ADD CONSTRAINT "VentureEnrollment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VentureEnrollment" ADD CONSTRAINT "VentureEnrollment_organizationId_cohortId_fkey" FOREIGN KEY ("organizationId", "cohortId") REFERENCES "Cohort"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VentureEnrollment" ADD CONSTRAINT "VentureEnrollment_organizationId_ventureId_fkey" FOREIGN KEY ("organizationId", "ventureId") REFERENCES "Venture"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
