-- CreateEnum
CREATE TYPE "FollowUpWaveKind" AS ENUM ('BASELINE', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "FollowUpWaveStatus" AS ENUM ('PLANNED', 'OPEN', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VentureObservationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'MISSED');

-- Add the meaningful optional cohort-code uniqueness rule. PostgreSQL permits
-- multiple NULL values, so cohorts without a code remain valid.
CREATE UNIQUE INDEX "Cohort_organizationId_fundingProgramId_code_key"
ON "Cohort"("organizationId", "fundingProgramId", "code");

-- Add composite keys used by longitudinal records to keep the cohort context
-- aligned with the enrollment and wave at database level.
CREATE UNIQUE INDEX "VentureEnrollment_organizationId_cohortId_id_key"
ON "VentureEnrollment"("organizationId", "cohortId", "id");

-- CreateTable
CREATE TABLE "FollowUpWave" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "FollowUpWaveKind" NOT NULL DEFAULT 'FOLLOW_UP',
    "sequence" INTEGER NOT NULL,
    "offsetMonths" INTEGER,
    "scheduledFor" TIMESTAMP(3),
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "status" "FollowUpWaveStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FollowUpWave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VentureObservation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "ventureEnrollmentId" TEXT NOT NULL,
    "followUpWaveId" TEXT NOT NULL,
    "status" "VentureObservationStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VentureObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FollowUpWave_organizationId_cohortId_id_key"
ON "FollowUpWave"("organizationId", "cohortId", "id");
CREATE UNIQUE INDEX "FollowUpWave_organizationId_cohortId_sequence_key"
ON "FollowUpWave"("organizationId", "cohortId", "sequence");
CREATE INDEX "FollowUpWave_organizationId_cohortId_status_idx"
ON "FollowUpWave"("organizationId", "cohortId", "status");
CREATE UNIQUE INDEX "VentureObservation_organizationId_ventureEnrollmentId_followUpWaveId_key"
ON "VentureObservation"("organizationId", "ventureEnrollmentId", "followUpWaveId");
CREATE INDEX "VentureObservation_organizationId_cohortId_status_idx"
ON "VentureObservation"("organizationId", "cohortId", "status");
CREATE INDEX "VentureObservation_organizationId_ventureEnrollmentId_status_idx"
ON "VentureObservation"("organizationId", "ventureEnrollmentId", "status");
CREATE INDEX "VentureObservation_organizationId_followUpWaveId_status_idx"
ON "VentureObservation"("organizationId", "followUpWaveId", "status");

-- AddForeignKey
ALTER TABLE "FollowUpWave"
ADD CONSTRAINT "FollowUpWave_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FollowUpWave"
ADD CONSTRAINT "FollowUpWave_organizationId_cohortId_fkey"
FOREIGN KEY ("organizationId", "cohortId") REFERENCES "Cohort"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VentureObservation"
ADD CONSTRAINT "VentureObservation_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VentureObservation"
ADD CONSTRAINT "VentureObservation_organizationId_cohortId_fkey"
FOREIGN KEY ("organizationId", "cohortId") REFERENCES "Cohort"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VentureObservation"
ADD CONSTRAINT "VentureObservation_organizationId_cohortId_ventureEnrollmentId_fkey"
FOREIGN KEY ("organizationId", "cohortId", "ventureEnrollmentId") REFERENCES "VentureEnrollment"("organizationId", "cohortId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VentureObservation"
ADD CONSTRAINT "VentureObservation_organizationId_cohortId_followUpWaveId_fkey"
FOREIGN KEY ("organizationId", "cohortId", "followUpWaveId") REFERENCES "FollowUpWave"("organizationId", "cohortId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
