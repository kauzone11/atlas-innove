-- CreateEnum
CREATE TYPE "AwardStatus" AS ENUM ('PREPARING', 'ACTIVE', 'SUSPENDED', 'COMPLETED', 'TERMINATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AwardObligationType" AS ENUM ('DELIVERABLE', 'PROGRESS_REPORT', 'FINAL_REPORT', 'FINANCIAL_REPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "AwardSubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "AwardSubmissionReviewStatus" AS ENUM ('PENDING', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AwardDisbursementStatus" AS ENUM ('PLANNED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AwardDocumentType" AS ENUM ('AGREEMENT', 'AMENDMENT', 'TECHNICAL', 'FINANCIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ProjectTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProjectTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ProjectResourceType" AS ENUM ('DOCUMENT', 'REPOSITORY', 'DESIGN', 'RESEARCH', 'DATA', 'OTHER');

-- AlterTable
ALTER TABLE "VentureEnrollment" ADD COLUMN     "awardId" TEXT;

-- CreateTable
CREATE TABLE "Award" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fundingCallId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "status" "AwardStatus" NOT NULL DEFAULT 'PREPARING',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "agreementNumber" TEXT,
    "approvedAmount" DECIMAL(14,2),
    "counterpartAmount" DECIMAL(14,2),
    "signedAt" DATE,
    "startsAt" DATE,
    "endsAt" DATE,
    "activatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "terminatedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Award_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwardStatusHistory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "awardId" TEXT NOT NULL,
    "fromStatus" "AwardStatus",
    "toStatus" "AwardStatus" NOT NULL,
    "awardRevision" INTEGER NOT NULL,
    "reason" TEXT,
    "changedByUserId" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AwardStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwardObligation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "awardId" TEXT NOT NULL,
    "type" "AwardObligationType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "periodStartsAt" DATE,
    "periodEndsAt" DATE,
    "dueAt" DATE,
    "position" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "waivedAt" TIMESTAMP(3),
    "waivedByUserId" TEXT,
    "waiverReason" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwardObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwardObligationDueDateHistory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "awardId" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "oldDueAt" DATE,
    "newDueAt" DATE,
    "reason" TEXT NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AwardObligationDueDateHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwardSubmission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "awardId" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" "AwardSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "summary" TEXT NOT NULL,
    "details" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "submittedByUserId" TEXT,
    "reviewStatus" "AwardSubmissionReviewStatus" NOT NULL DEFAULT 'PENDING',
    "feedback" TEXT,
    "internalNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwardSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwardSubmissionEvidence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "awardId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AwardSubmissionEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwardDisbursement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "awardId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "plannedFor" DATE,
    "status" "AwardDisbursementStatus" NOT NULL DEFAULT 'PLANNED',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "paidAt" DATE,
    "paidByUserId" TEXT,
    "paidRecordedAt" TIMESTAMP(3),
    "externalReference" TEXT,
    "note" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwardDisbursement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwardDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "awardId" TEXT NOT NULL,
    "type" "AwardDocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "visibleToParticipant" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AwardDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectTaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "ProjectTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "assigneeUserId" TEXT,
    "dueAt" DATE,
    "createdByUserId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectResource" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "ProjectResourceType" NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Award_organizationId_status_idx" ON "Award"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Award_organizationId_fundingCallId_status_idx" ON "Award"("organizationId", "fundingCallId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Award_organizationId_id_key" ON "Award"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Award_organizationId_id_applicationId_key" ON "Award"("organizationId", "id", "applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Award_organizationId_applicationId_key" ON "Award"("organizationId", "applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Award_organizationId_fundingCallId_applicationId_key" ON "Award"("organizationId", "fundingCallId", "applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Award_organizationId_agreementNumber_key" ON "Award"("organizationId", "agreementNumber");

-- CreateIndex
CREATE INDEX "AwardStatusHistory_organizationId_awardId_changedAt_idx" ON "AwardStatusHistory"("organizationId", "awardId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AwardStatusHistory_organizationId_awardId_awardRevision_key" ON "AwardStatusHistory"("organizationId", "awardId", "awardRevision");

-- CreateIndex
CREATE INDEX "AwardObligation_organizationId_awardId_dueAt_idx" ON "AwardObligation"("organizationId", "awardId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "AwardObligation_organizationId_awardId_id_key" ON "AwardObligation"("organizationId", "awardId", "id");

-- CreateIndex
CREATE INDEX "AwardObligationDueDateHistory_organizationId_awardId_obliga_idx" ON "AwardObligationDueDateHistory"("organizationId", "awardId", "obligationId", "changedAt");

-- CreateIndex
CREATE INDEX "AwardSubmission_organizationId_awardId_obligationId_status_idx" ON "AwardSubmission"("organizationId", "awardId", "obligationId", "status");

-- CreateIndex
CREATE INDEX "AwardSubmission_organizationId_status_reviewStatus_submitte_idx" ON "AwardSubmission"("organizationId", "status", "reviewStatus", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AwardSubmission_organizationId_awardId_id_key" ON "AwardSubmission"("organizationId", "awardId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AwardSubmission_organizationId_awardId_obligationId_version_key" ON "AwardSubmission"("organizationId", "awardId", "obligationId", "version");

-- CreateIndex
CREATE INDEX "AwardSubmissionEvidence_organizationId_awardId_submissionId_idx" ON "AwardSubmissionEvidence"("organizationId", "awardId", "submissionId");

-- CreateIndex
CREATE INDEX "AwardDisbursement_organizationId_awardId_status_plannedFor_idx" ON "AwardDisbursement"("organizationId", "awardId", "status", "plannedFor");

-- CreateIndex
CREATE INDEX "AwardDocument_organizationId_awardId_visibleToParticipant_idx" ON "AwardDocument"("organizationId", "awardId", "visibleToParticipant");

-- CreateIndex
CREATE INDEX "ProjectTask_projectId_status_dueAt_idx" ON "ProjectTask"("projectId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "ProjectTask_assigneeUserId_status_dueAt_idx" ON "ProjectTask"("assigneeUserId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "ProjectResource_projectId_type_idx" ON "ProjectResource"("projectId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "VentureEnrollment_organizationId_awardId_key" ON "VentureEnrollment"("organizationId", "awardId");

-- AddForeignKey
ALTER TABLE "VentureEnrollment" ADD CONSTRAINT "VentureEnrollment_organizationId_awardId_applicationId_fkey" FOREIGN KEY ("organizationId", "awardId", "applicationId") REFERENCES "Award"("organizationId", "id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Award" ADD CONSTRAINT "Award_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Award" ADD CONSTRAINT "Award_organizationId_fundingCallId_fkey" FOREIGN KEY ("organizationId", "fundingCallId") REFERENCES "FundingCall"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Award" ADD CONSTRAINT "Award_organizationId_fundingCallId_applicationId_fkey" FOREIGN KEY ("organizationId", "fundingCallId", "applicationId") REFERENCES "Application"("organizationId", "fundingCallId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Award" ADD CONSTRAINT "Award_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardStatusHistory" ADD CONSTRAINT "AwardStatusHistory_organizationId_awardId_fkey" FOREIGN KEY ("organizationId", "awardId") REFERENCES "Award"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardStatusHistory" ADD CONSTRAINT "AwardStatusHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardObligation" ADD CONSTRAINT "AwardObligation_organizationId_awardId_fkey" FOREIGN KEY ("organizationId", "awardId") REFERENCES "Award"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardObligation" ADD CONSTRAINT "AwardObligation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardObligation" ADD CONSTRAINT "AwardObligation_waivedByUserId_fkey" FOREIGN KEY ("waivedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardObligationDueDateHistory" ADD CONSTRAINT "AwardObligationDueDateHistory_organizationId_awardId_oblig_fkey" FOREIGN KEY ("organizationId", "awardId", "obligationId") REFERENCES "AwardObligation"("organizationId", "awardId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardObligationDueDateHistory" ADD CONSTRAINT "AwardObligationDueDateHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardSubmission" ADD CONSTRAINT "AwardSubmission_organizationId_awardId_obligationId_fkey" FOREIGN KEY ("organizationId", "awardId", "obligationId") REFERENCES "AwardObligation"("organizationId", "awardId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardSubmission" ADD CONSTRAINT "AwardSubmission_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardSubmission" ADD CONSTRAINT "AwardSubmission_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardSubmission" ADD CONSTRAINT "AwardSubmission_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardSubmissionEvidence" ADD CONSTRAINT "AwardSubmissionEvidence_organizationId_awardId_submissionI_fkey" FOREIGN KEY ("organizationId", "awardId", "submissionId") REFERENCES "AwardSubmission"("organizationId", "awardId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardDisbursement" ADD CONSTRAINT "AwardDisbursement_organizationId_awardId_fkey" FOREIGN KEY ("organizationId", "awardId") REFERENCES "Award"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardDisbursement" ADD CONSTRAINT "AwardDisbursement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AwardDisbursement" ADD CONSTRAINT "AwardDisbursement_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardDocument" ADD CONSTRAINT "AwardDocument_organizationId_awardId_fkey" FOREIGN KEY ("organizationId", "awardId") REFERENCES "Award"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardDocument" ADD CONSTRAINT "AwardDocument_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectResource" ADD CONSTRAINT "ProjectResource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectResource" ADD CONSTRAINT "ProjectResource_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Formal execution has a separate history from selected application snapshots and monitoring.
ALTER TABLE "Award" ADD CONSTRAINT "Award_valid_terms" CHECK (
  "revision" > 0 AND ("approvedAmount" IS NULL OR "approvedAmount" >= 0)
  AND ("counterpartAmount" IS NULL OR "counterpartAmount" >= 0)
  AND ("startsAt" IS NULL OR "endsAt" IS NULL OR "endsAt" >= "startsAt")
  AND ("status" NOT IN ('ACTIVE', 'SUSPENDED', 'COMPLETED', 'TERMINATED') OR ("startsAt" IS NOT NULL AND "activatedAt" IS NOT NULL))
  AND ("status" <> 'COMPLETED' OR "completedAt" IS NOT NULL)
  AND ("status" <> 'TERMINATED' OR "terminatedAt" IS NOT NULL)
  AND ("status" = 'COMPLETED' OR "completedAt" IS NULL)
  AND ("status" = 'TERMINATED' OR "terminatedAt" IS NULL)
  AND ("status" NOT IN ('PREPARING', 'CANCELLED') OR "activatedAt" IS NULL)
);
ALTER TABLE "AwardStatusHistory" ADD CONSTRAINT "AwardStatusHistory_valid_change" CHECK (
  "awardRevision" > 0 AND (("fromStatus" IS NULL AND "toStatus" = 'PREPARING' AND "awardRevision" = 1) OR "fromStatus" IS NOT NULL)
  AND ("toStatus" NOT IN ('SUSPENDED', 'TERMINATED', 'CANCELLED') OR ("reason" IS NOT NULL AND char_length(btrim("reason")) >= 2))
);
ALTER TABLE "AwardObligation" ADD CONSTRAINT "AwardObligation_valid_plan" CHECK (
  "position" BETWEEN 0 AND 199 AND "revision" > 0
  AND ("periodStartsAt" IS NULL OR "periodEndsAt" IS NULL OR "periodEndsAt" >= "periodStartsAt")
  AND (("waivedAt" IS NULL AND "waivedByUserId" IS NULL AND "waiverReason" IS NULL)
    OR ("waivedAt" IS NOT NULL AND "waivedByUserId" IS NOT NULL AND "waiverReason" IS NOT NULL AND char_length(btrim("waiverReason")) >= 2))
);
ALTER TABLE "AwardObligationDueDateHistory" ADD CONSTRAINT "AwardObligationDueDateHistory_valid_change" CHECK (
  "oldDueAt" IS DISTINCT FROM "newDueAt" AND char_length(btrim("reason")) >= 2
);
ALTER TABLE "AwardSubmission" ADD CONSTRAINT "AwardSubmission_valid_state" CHECK (
  "version" BETWEEN 1 AND 100 AND "revision" > 0
  AND (("status" = 'DRAFT' AND "submittedAt" IS NULL AND "submittedByUserId" IS NULL AND "reviewStatus" = 'PENDING')
    OR ("status" = 'SUBMITTED' AND "submittedAt" IS NOT NULL AND "submittedByUserId" IS NOT NULL AND char_length(btrim("summary")) >= 10))
  AND (("reviewStatus" = 'PENDING' AND "reviewedAt" IS NULL AND "reviewedByUserId" IS NULL AND "feedback" IS NULL AND "internalNote" IS NULL)
    OR ("status" = 'SUBMITTED' AND "reviewStatus" <> 'PENDING' AND "reviewedAt" IS NOT NULL AND "reviewedByUserId" IS NOT NULL))
  AND ("reviewStatus" NOT IN ('CHANGES_REQUESTED', 'REJECTED') OR ("feedback" IS NOT NULL AND char_length(btrim("feedback")) >= 2))
);
CREATE UNIQUE INDEX "AwardSubmission_one_active_draft" ON "AwardSubmission" ("organizationId", "awardId", "obligationId") WHERE "status" = 'DRAFT';
ALTER TABLE "AwardDisbursement" ADD CONSTRAINT "AwardDisbursement_valid_state" CHECK (
  "amount" > 0 AND "revision" > 0 AND (("status" = 'PAID' AND "paidAt" IS NOT NULL AND "paidByUserId" IS NOT NULL AND "paidRecordedAt" IS NOT NULL) OR ("status" <> 'PAID' AND "paidAt" IS NULL AND "paidByUserId" IS NULL AND "paidRecordedAt" IS NULL))
);
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_valid_state" CHECK (
  "revision" > 0 AND ("status" <> 'DONE' OR "completedAt" IS NOT NULL)
  AND ("status" <> 'CANCELLED' OR "cancelledAt" IS NOT NULL)
  AND ("status" = 'DONE' OR "completedAt" IS NULL)
  AND ("status" = 'CANCELLED' OR "cancelledAt" IS NULL)
);
ALTER TABLE "ProjectResource" ADD CONSTRAINT "ProjectResource_positive_revision" CHECK ("revision" > 0);
ALTER TABLE "VentureEnrollment" ADD CONSTRAINT "VentureEnrollment_award_application_required" CHECK ("awardId" IS NULL OR "applicationId" IS NOT NULL);

CREATE FUNCTION "guard_award_lifecycle"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM "Organization" WHERE "id" = OLD."organizationId") THEN RAISE EXCEPTION 'AWARD_HISTORY_IMMUTABLE' USING ERRCODE = '23514'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW."status" <> 'PREPARING' OR NOT EXISTS (
      SELECT 1 FROM "Application" a JOIN "FundingCall" c ON c."organizationId" = a."organizationId" AND c."id" = a."fundingCallId"
      WHERE a."organizationId" = NEW."organizationId" AND a."fundingCallId" = NEW."fundingCallId" AND a."id" = NEW."applicationId"
        AND a."status" = 'DECIDED' AND a."decision" = 'SELECTED' AND a."withdrawnAt" IS NULL AND c."resultsPublishedAt" IS NOT NULL
    ) THEN RAISE EXCEPTION 'AWARD_APPLICATION_NOT_ELIGIBLE' USING ERRCODE = '23514'; END IF;
    RETURN NEW;
  END IF;
  IF ROW(NEW."id", NEW."organizationId", NEW."fundingCallId", NEW."applicationId", NEW."createdByUserId", NEW."createdAt") IS DISTINCT FROM ROW(OLD."id", OLD."organizationId", OLD."fundingCallId", OLD."applicationId", OLD."createdByUserId", OLD."createdAt") THEN
    RAISE EXCEPTION 'AWARD_PROVENANCE_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF OLD."status" IN ('COMPLETED', 'TERMINATED', 'CANCELLED') AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'AWARD_TERMINAL' USING ERRCODE = '23514'; END IF;
  IF OLD."status" <> 'PREPARING' AND ROW(NEW."agreementNumber", NEW."approvedAmount", NEW."counterpartAmount", NEW."signedAt", NEW."startsAt", NEW."endsAt") IS DISTINCT FROM ROW(OLD."agreementNumber", OLD."approvedAmount", OLD."counterpartAmount", OLD."signedAt", OLD."startsAt", OLD."endsAt") THEN
    RAISE EXCEPTION 'AWARD_TERMS_FROZEN' USING ERRCODE = '23514';
  END IF;
  IF OLD."activatedAt" IS NOT NULL AND NEW."activatedAt" IS DISTINCT FROM OLD."activatedAt" THEN RAISE EXCEPTION 'AWARD_HISTORY_IMMUTABLE' USING ERRCODE = '23514'; END IF;
  IF NEW."status" IS DISTINCT FROM OLD."status" THEN
    IF NEW."revision" <> OLD."revision" + 1 OR NOT (
      (OLD."status" = 'PREPARING' AND NEW."status" IN ('ACTIVE', 'CANCELLED'))
      OR (OLD."status" = 'ACTIVE' AND NEW."status" IN ('SUSPENDED', 'COMPLETED', 'TERMINATED'))
      OR (OLD."status" = 'SUSPENDED' AND NEW."status" IN ('ACTIVE', 'COMPLETED', 'TERMINATED'))
    ) THEN RAISE EXCEPTION 'AWARD_STATUS_TRANSITION_INVALID' USING ERRCODE = '23514'; END IF;
    IF NEW."status" = 'COMPLETED' AND EXISTS (
      SELECT 1 FROM "AwardObligation" o WHERE o."organizationId" = NEW."organizationId" AND o."awardId" = NEW."id" AND o."required" AND o."waivedAt" IS NULL
        AND NOT EXISTS (SELECT 1 FROM "AwardSubmission" s WHERE s."organizationId" = o."organizationId" AND s."awardId" = o."awardId" AND s."obligationId" = o."id" AND s."status" = 'SUBMITTED' AND s."reviewStatus" = 'APPROVED')
    ) THEN RAISE EXCEPTION 'AWARD_REQUIRED_OBLIGATIONS_UNRESOLVED' USING ERRCODE = '23514'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Award_lifecycle_guard" BEFORE INSERT OR UPDATE OR DELETE ON "Award" FOR EACH ROW EXECUTE FUNCTION "guard_award_lifecycle"();

CREATE FUNCTION "require_award_status_history"() RETURNS trigger AS $$
DECLARE previous_status "AwardStatus";
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Award" WHERE "id" = NEW."id" AND "organizationId" = NEW."organizationId") THEN RETURN NULL; END IF;
  IF TG_OP = 'UPDATE' THEN previous_status := OLD."status"; END IF;
  IF NOT EXISTS (SELECT 1 FROM "AwardStatusHistory" WHERE "organizationId" = NEW."organizationId" AND "awardId" = NEW."id" AND "awardRevision" = NEW."revision" AND "fromStatus" IS NOT DISTINCT FROM previous_status AND "toStatus" = NEW."status") THEN
    RAISE EXCEPTION 'AWARD_STATUS_HISTORY_REQUIRED' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "Award_initial_history_required" AFTER INSERT ON "Award" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "require_award_status_history"();
CREATE CONSTRAINT TRIGGER "Award_transition_history_required" AFTER UPDATE ON "Award" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (OLD."status" IS DISTINCT FROM NEW."status") EXECUTE FUNCTION "require_award_status_history"();

CREATE FUNCTION "guard_award_append_only_history"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' OR EXISTS (SELECT 1 FROM "Organization" WHERE "id" = OLD."organizationId") THEN RAISE EXCEPTION 'AWARD_HISTORY_IMMUTABLE' USING ERRCODE = '23514'; END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AwardStatusHistory_append_only" BEFORE UPDATE OR DELETE ON "AwardStatusHistory" FOR EACH ROW EXECUTE FUNCTION "guard_award_append_only_history"();
CREATE TRIGGER "AwardObligationDueDateHistory_append_only" BEFORE UPDATE OR DELETE ON "AwardObligationDueDateHistory" FOR EACH ROW EXECUTE FUNCTION "guard_award_append_only_history"();

CREATE FUNCTION "guard_award_status_history_insert"() RETURNS trigger AS $$
DECLARE current_award "Award";
BEGIN
  SELECT * INTO current_award FROM "Award" WHERE "organizationId" = NEW."organizationId" AND "id" = NEW."awardId" FOR UPDATE;
  IF current_award."status" <> NEW."toStatus" OR current_award."revision" <> NEW."awardRevision"
    OR NEW."changedAt" < current_award."createdAt" OR NEW."changedAt" > clock_timestamp()
    OR (NEW."fromStatus" IS NULL AND NEW."changedByUserId" <> current_award."createdByUserId") THEN
    RAISE EXCEPTION 'AWARD_STATUS_HISTORY_INVALID' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AwardStatusHistory_insert_guard" BEFORE INSERT ON "AwardStatusHistory" FOR EACH ROW EXECUTE FUNCTION "guard_award_status_history_insert"();

CREATE FUNCTION "guard_award_deadline_history_insert"() RETURNS trigger AS $$
DECLARE old_deadline DATE;
BEGIN
  PERFORM "id" FROM "Award" WHERE "organizationId" = NEW."organizationId" AND "id" = NEW."awardId" AND "status" IN ('PREPARING', 'ACTIVE', 'SUSPENDED') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'AWARD_TERMINAL' USING ERRCODE = '23514'; END IF;
  SELECT "dueAt" INTO old_deadline FROM "AwardObligation" WHERE "organizationId" = NEW."organizationId" AND "awardId" = NEW."awardId" AND "id" = NEW."obligationId" AND "waivedAt" IS NULL FOR UPDATE;
  IF NOT FOUND OR old_deadline IS DISTINCT FROM NEW."oldDueAt" OR NEW."changedAt" > clock_timestamp() THEN RAISE EXCEPTION 'AWARD_DEADLINE_HISTORY_INVALID' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AwardObligationDueDateHistory_insert_guard" BEFORE INSERT ON "AwardObligationDueDateHistory" FOR EACH ROW EXECUTE FUNCTION "guard_award_deadline_history_insert"();

CREATE FUNCTION "guard_award_obligation_history"() RETURNS trigger AS $$
DECLARE target_org TEXT; target_award TEXT; award_status "AwardStatus"; has_submission BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN target_org := OLD."organizationId"; target_award := OLD."awardId";
  ELSE target_org := NEW."organizationId"; target_award := NEW."awardId"; END IF;
  SELECT "status" INTO award_status FROM "Award" WHERE "organizationId" = target_org AND "id" = target_award FOR UPDATE;
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM "Organization" WHERE "id" = target_org) THEN RAISE EXCEPTION 'AWARD_OBLIGATION_HISTORY_IMMUTABLE' USING ERRCODE = '23514'; END IF;
    RETURN OLD;
  END IF;
  IF award_status NOT IN ('PREPARING', 'ACTIVE', 'SUSPENDED') THEN RAISE EXCEPTION 'AWARD_TERMINAL' USING ERRCODE = '23514'; END IF;
  IF TG_OP = 'INSERT' THEN
    IF (SELECT COUNT(*) FROM "AwardObligation" WHERE "organizationId" = target_org AND "awardId" = target_award) >= 200 THEN RAISE EXCEPTION 'AWARD_OBLIGATION_LIMIT' USING ERRCODE = '23514'; END IF;
    RETURN NEW;
  END IF;
  IF ROW(NEW."id", NEW."organizationId", NEW."awardId", NEW."createdAt", NEW."createdByUserId") IS DISTINCT FROM ROW(OLD."id", OLD."organizationId", OLD."awardId", OLD."createdAt", OLD."createdByUserId") THEN RAISE EXCEPTION 'AWARD_PROVENANCE_IMMUTABLE' USING ERRCODE = '23514'; END IF;
  IF OLD."waivedAt" IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'AWARD_OBLIGATION_RESOLVED' USING ERRCODE = '23514'; END IF;
  SELECT EXISTS (SELECT 1 FROM "AwardSubmission" WHERE "organizationId" = target_org AND "awardId" = target_award AND "obligationId" = OLD."id" AND "status" = 'SUBMITTED') INTO has_submission;
  IF has_submission AND ROW(NEW."type", NEW."title", NEW."description", NEW."periodStartsAt", NEW."periodEndsAt", NEW."required", NEW."position") IS DISTINCT FROM ROW(OLD."type", OLD."title", OLD."description", OLD."periodStartsAt", OLD."periodEndsAt", OLD."required", OLD."position") THEN RAISE EXCEPTION 'AWARD_OBLIGATION_FROZEN' USING ERRCODE = '23514'; END IF;
  IF has_submission AND NEW."dueAt" IS DISTINCT FROM OLD."dueAt" AND NOT EXISTS (
    SELECT 1 FROM "AwardObligationDueDateHistory" WHERE "organizationId" = target_org AND "awardId" = target_award AND "obligationId" = OLD."id"
      AND "oldDueAt" IS NOT DISTINCT FROM OLD."dueAt" AND "newDueAt" IS NOT DISTINCT FROM NEW."dueAt" AND xmin::text::bigint = txid_current() % 4294967296
  ) THEN RAISE EXCEPTION 'AWARD_DEADLINE_HISTORY_REQUIRED' USING ERRCODE = '23514'; END IF;
  IF NEW."waivedAt" IS NOT NULL AND EXISTS (SELECT 1 FROM "AwardSubmission" WHERE "organizationId" = target_org AND "awardId" = target_award AND "obligationId" = OLD."id" AND ("reviewStatus" = 'APPROVED' OR "status" = 'DRAFT')) THEN RAISE EXCEPTION 'AWARD_OBLIGATION_RESOLVED' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AwardObligation_history_guard" BEFORE INSERT OR UPDATE OR DELETE ON "AwardObligation" FOR EACH ROW EXECUTE FUNCTION "guard_award_obligation_history"();

CREATE FUNCTION "guard_award_submission_history"() RETURNS trigger AS $$
DECLARE target_org TEXT; target_award TEXT; target_obligation TEXT; award_status "AwardStatus"; waiver TIMESTAMP; previous_version INTEGER; previous_status "AwardSubmissionReviewStatus";
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM "Organization" WHERE "id" = OLD."organizationId") THEN RAISE EXCEPTION 'AWARD_SUBMISSION_FROZEN' USING ERRCODE = '23514'; END IF;
    RETURN OLD;
  END IF;
  target_org := NEW."organizationId"; target_award := NEW."awardId"; target_obligation := NEW."obligationId";
  SELECT a."status" INTO award_status FROM "Award" a WHERE a."organizationId" = target_org AND a."id" = target_award FOR UPDATE;
  SELECT "waivedAt" INTO waiver FROM "AwardObligation" WHERE "organizationId" = target_org AND "awardId" = target_award AND "id" = target_obligation FOR UPDATE;
  IF waiver IS NOT NULL THEN RAISE EXCEPTION 'AWARD_OBLIGATION_RESOLVED' USING ERRCODE = '23514'; END IF;
  IF TG_OP = 'INSERT' THEN
    IF award_status <> 'ACTIVE' OR NEW."status" <> 'DRAFT' THEN RAISE EXCEPTION 'AWARD_SUBMISSIONS_NOT_ACTIVE' USING ERRCODE = '23514'; END IF;
    SELECT "version", "reviewStatus" INTO previous_version, previous_status FROM "AwardSubmission" WHERE "organizationId" = target_org AND "awardId" = target_award AND "obligationId" = target_obligation ORDER BY "version" DESC LIMIT 1;
    IF NEW."version" <> COALESCE(previous_version, 0) + 1 OR (previous_version IS NOT NULL AND previous_status <> 'CHANGES_REQUESTED') THEN RAISE EXCEPTION 'AWARD_NEW_REVISION_NOT_ALLOWED' USING ERRCODE = '23514'; END IF;
    RETURN NEW;
  END IF;
  IF ROW(NEW."id", NEW."organizationId", NEW."awardId", NEW."obligationId", NEW."version", NEW."createdByUserId", NEW."createdAt") IS DISTINCT FROM ROW(OLD."id", OLD."organizationId", OLD."awardId", OLD."obligationId", OLD."version", OLD."createdByUserId", OLD."createdAt") THEN RAISE EXCEPTION 'AWARD_PROVENANCE_IMMUTABLE' USING ERRCODE = '23514'; END IF;
  IF OLD."reviewStatus" <> 'PENDING' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'AWARD_REVIEW_FROZEN' USING ERRCODE = '23514'; END IF;
  IF OLD."status" = 'SUBMITTED' THEN
    IF ROW(NEW."summary", NEW."details", NEW."status", NEW."revision", NEW."submittedAt", NEW."submittedByUserId") IS DISTINCT FROM ROW(OLD."summary", OLD."details", OLD."status", OLD."revision", OLD."submittedAt", OLD."submittedByUserId") THEN RAISE EXCEPTION 'AWARD_SUBMISSION_FROZEN' USING ERRCODE = '23514'; END IF;
    IF NEW."reviewStatus" IS DISTINCT FROM OLD."reviewStatus" AND award_status NOT IN ('ACTIVE', 'SUSPENDED') THEN RAISE EXCEPTION 'AWARD_REVIEW_NOT_ACTIVE' USING ERRCODE = '23514'; END IF;
  ELSE
    IF award_status <> 'ACTIVE' THEN RAISE EXCEPTION 'AWARD_SUBMISSIONS_NOT_ACTIVE' USING ERRCODE = '23514'; END IF;
    IF NEW."revision" <> OLD."revision" + 1 THEN RAISE EXCEPTION 'EXECUTION_REVISION_CONFLICT' USING ERRCODE = '23514'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AwardSubmission_history_guard" BEFORE INSERT OR UPDATE OR DELETE ON "AwardSubmission" FOR EACH ROW EXECUTE FUNCTION "guard_award_submission_history"();

CREATE FUNCTION "guard_award_submission_evidence"() RETURNS trigger AS $$
DECLARE target_org TEXT; target_award TEXT; target_submission TEXT; submission_status "AwardSubmissionStatus";
BEGIN
  IF TG_OP = 'DELETE' THEN target_org := OLD."organizationId"; target_award := OLD."awardId"; target_submission := OLD."submissionId";
  ELSE target_org := NEW."organizationId"; target_award := NEW."awardId"; target_submission := NEW."submissionId"; END IF;
  SELECT "status" INTO submission_status FROM "AwardSubmission" WHERE "organizationId" = target_org AND "awardId" = target_award AND "id" = target_submission FOR UPDATE;
  IF submission_status = 'SUBMITTED' AND EXISTS (SELECT 1 FROM "Organization" WHERE "id" = target_org) THEN RAISE EXCEPTION 'AWARD_SUBMISSION_FROZEN' USING ERRCODE = '23514'; END IF;
  IF TG_OP = 'UPDATE' AND ROW(NEW."organizationId", NEW."awardId", NEW."submissionId") IS DISTINCT FROM ROW(OLD."organizationId", OLD."awardId", OLD."submissionId") THEN RAISE EXCEPTION 'AWARD_PROVENANCE_IMMUTABLE' USING ERRCODE = '23514'; END IF;
  IF TG_OP = 'INSERT' AND (SELECT COUNT(*) FROM "AwardSubmissionEvidence" WHERE "organizationId" = target_org AND "awardId" = target_award AND "submissionId" = target_submission) >= 20 THEN RAISE EXCEPTION 'AWARD_EVIDENCE_LIMIT' USING ERRCODE = '23514'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AwardSubmissionEvidence_history_guard" BEFORE INSERT OR UPDATE OR DELETE ON "AwardSubmissionEvidence" FOR EACH ROW EXECUTE FUNCTION "guard_award_submission_evidence"();

CREATE FUNCTION "guard_award_disbursement_history"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM "Organization" WHERE "id" = OLD."organizationId") THEN RAISE EXCEPTION 'AWARD_DISBURSEMENT_FROZEN' USING ERRCODE = '23514'; END IF;
    RETURN OLD;
  END IF;
  IF OLD."status" <> 'PLANNED' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'AWARD_DISBURSEMENT_FROZEN' USING ERRCODE = '23514'; END IF;
  IF ROW(NEW."id", NEW."organizationId", NEW."awardId", NEW."createdAt", NEW."createdByUserId") IS DISTINCT FROM ROW(OLD."id", OLD."organizationId", OLD."awardId", OLD."createdAt", OLD."createdByUserId") THEN RAISE EXCEPTION 'AWARD_PROVENANCE_IMMUTABLE' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AwardDisbursement_history_guard" BEFORE UPDATE OR DELETE ON "AwardDisbursement" FOR EACH ROW EXECUTE FUNCTION "guard_award_disbursement_history"();

CREATE FUNCTION "guard_award_enrollment_provenance"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."awardId" IS NOT NULL AND ROW(NEW."awardId", NEW."applicationId", NEW."organizationId", NEW."cohortId", NEW."ventureId") IS DISTINCT FROM ROW(OLD."awardId", OLD."applicationId", OLD."organizationId", OLD."cohortId", OLD."ventureId") THEN RAISE EXCEPTION 'AWARD_PROVENANCE_IMMUTABLE' USING ERRCODE = '23514'; END IF;
  IF NEW."awardId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Award" a JOIN "Cohort" c ON c."organizationId" = a."organizationId" AND c."fundingCallId" = a."fundingCallId"
    WHERE a."organizationId" = NEW."organizationId" AND a."id" = NEW."awardId" AND a."applicationId" = NEW."applicationId" AND c."id" = NEW."cohortId"
  ) THEN RAISE EXCEPTION 'AWARD_ENROLLMENT_CALL_MISMATCH' USING ERRCODE = '23514'; END IF;
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD."awardId" IS NULL)) AND NEW."awardId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Award" WHERE "organizationId" = NEW."organizationId" AND "id" = NEW."awardId" AND "status" = 'ACTIVE'
  ) THEN RAISE EXCEPTION 'AWARD_TRACKING_NOT_ACTIVE' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "VentureEnrollment_award_provenance_guard" BEFORE INSERT OR UPDATE ON "VentureEnrollment" FOR EACH ROW EXECUTE FUNCTION "guard_award_enrollment_provenance"();

CREATE FUNCTION "guard_project_task_history"() RETURNS trigger AS $$
BEGIN
  IF OLD."status" IN ('DONE', 'CANCELLED') AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'PROJECT_TASK_TERMINAL' USING ERRCODE = '23514'; END IF;
  IF ROW(NEW."id", NEW."projectId", NEW."createdAt", NEW."createdByUserId") IS DISTINCT FROM ROW(OLD."id", OLD."projectId", OLD."createdAt", OLD."createdByUserId") THEN RAISE EXCEPTION 'PROJECT_TASK_PROVENANCE_IMMUTABLE' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ProjectTask_history_guard" BEFORE UPDATE ON "ProjectTask" FOR EACH ROW EXECUTE FUNCTION "guard_project_task_history"();

CREATE FUNCTION "guard_private_https_resource"() RETURNS trigger AS $$
BEGIN
  IF NEW."url" !~ '^https://[^/?#[:space:]@]+([/?#][^[:space:]]*)?$' OR char_length(NEW."url") > 2000 THEN RAISE EXCEPTION 'RESOURCE_HTTPS_REQUIRED' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ProjectResource_https_guard" BEFORE INSERT OR UPDATE ON "ProjectResource" FOR EACH ROW EXECUTE FUNCTION "guard_private_https_resource"();
CREATE TRIGGER "AwardDocument_https_guard" BEFORE INSERT OR UPDATE ON "AwardDocument" FOR EACH ROW EXECUTE FUNCTION "guard_private_https_resource"();
CREATE TRIGGER "AwardSubmissionEvidence_https_guard" BEFORE INSERT OR UPDATE ON "AwardSubmissionEvidence" FOR EACH ROW EXECUTE FUNCTION "guard_private_https_resource"();
