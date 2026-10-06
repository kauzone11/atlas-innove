-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('OWNER', 'LEAD', 'MEMBER');

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('OWNER', 'LEAD', 'MEMBER');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('IDEA', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'DECIDED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ApplicationDecision" AS ENUM ('PENDING', 'SELECTED', 'WAITLIST', 'NOT_SELECTED', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- AlterTable
ALTER TABLE "FundingCall" ADD COLUMN     "applicationsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "evaluationStartedAt" TIMESTAMP(3),
ADD COLUMN     "resultsPublishedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Venture" ADD COLUMN     "sourceProjectId" TEXT;

-- AlterTable
ALTER TABLE "VentureEnrollment" ADD COLUMN     "applicationId" TEXT;

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMembership" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'MEMBER',
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamInvite" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "email" TEXT,
    "role" "TeamRole" NOT NULL DEFAULT 'MEMBER',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'IDEA',
    "createdByUserId" TEXT NOT NULL,
    "primaryTeamId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMembership" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProjectRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "ProjectMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fundingCallId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "teamId" TEXT,
    "submittedByUserId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "projectNameSnapshot" TEXT NOT NULL,
    "projectSummarySnapshot" TEXT NOT NULL,
    "projectDescriptionSnapshot" TEXT,
    "teamNameSnapshot" TEXT,
    "submittedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "decision" "ApplicationDecision" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "decidedByUserId" TEXT,
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationCriterion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fundingCallId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "weight" DECIMAL(10,4) NOT NULL,
    "maxScore" DECIMAL(10,4) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationEvaluation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fundingCallId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "evaluatorUserId" TEXT NOT NULL,
    "status" "EvaluationStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationEvaluationScore" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fundingCallId" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "score" DECIMAL(10,4) NOT NULL,
    "comment" TEXT,

    CONSTRAINT "ApplicationEvaluationScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamMembership_userId_status_leftAt_idx" ON "TeamMembership"("userId", "status", "leftAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMembership_teamId_userId_key" ON "TeamMembership"("teamId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamInvite_tokenHash_key" ON "TeamInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "TeamInvite_teamId_expiresAt_idx" ON "TeamInvite"("teamId", "expiresAt");

-- CreateIndex
CREATE INDEX "Project_primaryTeamId_archivedAt_idx" ON "Project"("primaryTeamId", "archivedAt");

-- CreateIndex
CREATE INDEX "ProjectMembership_userId_leftAt_idx" ON "ProjectMembership"("userId", "leftAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMembership_projectId_userId_key" ON "ProjectMembership"("projectId", "userId");

-- CreateIndex
CREATE INDEX "Application_organizationId_fundingCallId_status_idx" ON "Application"("organizationId", "fundingCallId", "status");

-- CreateIndex
CREATE INDEX "Application_projectId_submittedByUserId_idx" ON "Application"("projectId", "submittedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_organizationId_id_key" ON "Application"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Application_organizationId_fundingCallId_id_key" ON "Application"("organizationId", "fundingCallId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Application_fundingCallId_projectId_key" ON "Application"("fundingCallId", "projectId");

-- CreateIndex
CREATE INDEX "EvaluationCriterion_organizationId_fundingCallId_position_idx" ON "EvaluationCriterion"("organizationId", "fundingCallId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationCriterion_organizationId_fundingCallId_id_key" ON "EvaluationCriterion"("organizationId", "fundingCallId", "id");

-- CreateIndex
CREATE INDEX "ApplicationEvaluation_organizationId_fundingCallId_status_idx" ON "ApplicationEvaluation"("organizationId", "fundingCallId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationEvaluation_organizationId_fundingCallId_id_key" ON "ApplicationEvaluation"("organizationId", "fundingCallId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationEvaluation_organizationId_applicationId_evaluato_key" ON "ApplicationEvaluation"("organizationId", "applicationId", "evaluatorUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationEvaluationScore_evaluationId_criterionId_key" ON "ApplicationEvaluationScore"("evaluationId", "criterionId");

-- CreateIndex
CREATE UNIQUE INDEX "Venture_organizationId_sourceProjectId_key" ON "Venture"("organizationId", "sourceProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "VentureEnrollment_organizationId_applicationId_key" ON "VentureEnrollment"("organizationId", "applicationId");

-- AddForeignKey
ALTER TABLE "Venture" ADD CONSTRAINT "Venture_sourceProjectId_fkey" FOREIGN KEY ("sourceProjectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentureEnrollment" ADD CONSTRAINT "VentureEnrollment_organizationId_applicationId_fkey" FOREIGN KEY ("organizationId", "applicationId") REFERENCES "Application"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvite" ADD CONSTRAINT "TeamInvite_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvite" ADD CONSTRAINT "TeamInvite_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvite" ADD CONSTRAINT "TeamInvite_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_primaryTeamId_fkey" FOREIGN KEY ("primaryTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMembership" ADD CONSTRAINT "ProjectMembership_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMembership" ADD CONSTRAINT "ProjectMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_organizationId_fundingCallId_fkey" FOREIGN KEY ("organizationId", "fundingCallId") REFERENCES "FundingCall"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationCriterion" ADD CONSTRAINT "EvaluationCriterion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationCriterion" ADD CONSTRAINT "EvaluationCriterion_organizationId_fundingCallId_fkey" FOREIGN KEY ("organizationId", "fundingCallId") REFERENCES "FundingCall"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEvaluation" ADD CONSTRAINT "ApplicationEvaluation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEvaluation" ADD CONSTRAINT "ApplicationEvaluation_organizationId_fundingCallId_fkey" FOREIGN KEY ("organizationId", "fundingCallId") REFERENCES "FundingCall"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEvaluation" ADD CONSTRAINT "ApplicationEvaluation_organizationId_fundingCallId_applica_fkey" FOREIGN KEY ("organizationId", "fundingCallId", "applicationId") REFERENCES "Application"("organizationId", "fundingCallId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEvaluation" ADD CONSTRAINT "ApplicationEvaluation_evaluatorUserId_fkey" FOREIGN KEY ("evaluatorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEvaluationScore" ADD CONSTRAINT "ApplicationEvaluationScore_organizationId_fundingCallId_ev_fkey" FOREIGN KEY ("organizationId", "fundingCallId", "evaluationId") REFERENCES "ApplicationEvaluation"("organizationId", "fundingCallId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEvaluationScore" ADD CONSTRAINT "ApplicationEvaluationScore_organizationId_fundingCallId_cr_fkey" FOREIGN KEY ("organizationId", "fundingCallId", "criterionId") REFERENCES "EvaluationCriterion"("organizationId", "fundingCallId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EvaluationCriterion" ADD CONSTRAINT "EvaluationCriterion_positive_values" CHECK ("weight" > 0 AND "maxScore" > 0 AND "position" >= 0);
ALTER TABLE "ApplicationEvaluationScore" ADD CONSTRAINT "ApplicationEvaluationScore_nonnegative" CHECK ("score" >= 0);
ALTER TABLE "TeamInvite" ADD CONSTRAINT "TeamInvite_assignable_role" CHECK ("role" <> 'OWNER');
ALTER TABLE "Application" ADD CONSTRAINT "Application_valid_submission" CHECK (("status" NOT IN ('SUBMITTED', 'IN_REVIEW', 'DECIDED') OR "submittedAt" IS NOT NULL) AND ("status" <> 'WITHDRAWN' OR "withdrawnAt" IS NOT NULL));
ALTER TABLE "ApplicationEvaluation" ADD CONSTRAINT "ApplicationEvaluation_valid_submission" CHECK ("status" <> 'SUBMITTED' OR "submittedAt" IS NOT NULL);

CREATE FUNCTION "guard_application_snapshot"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."submittedAt" IS NOT NULL AND EXISTS (SELECT 1 FROM "Organization" WHERE "id" = OLD."organizationId") THEN
      RAISE EXCEPTION 'APPLICATION_SNAPSHOT_FROZEN' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD."submittedAt" IS NOT NULL AND (
    NEW."organizationId" IS DISTINCT FROM OLD."organizationId" OR NEW."fundingCallId" IS DISTINCT FROM OLD."fundingCallId"
    OR NEW."projectId" IS DISTINCT FROM OLD."projectId" OR NEW."teamId" IS DISTINCT FROM OLD."teamId"
    OR NEW."submittedByUserId" IS DISTINCT FROM OLD."submittedByUserId" OR NEW."submittedAt" IS DISTINCT FROM OLD."submittedAt"
    OR NEW."projectNameSnapshot" IS DISTINCT FROM OLD."projectNameSnapshot" OR NEW."projectSummarySnapshot" IS DISTINCT FROM OLD."projectSummarySnapshot"
    OR NEW."projectDescriptionSnapshot" IS DISTINCT FROM OLD."projectDescriptionSnapshot" OR NEW."teamNameSnapshot" IS DISTINCT FROM OLD."teamNameSnapshot"
  ) THEN RAISE EXCEPTION 'APPLICATION_SNAPSHOT_FROZEN' USING ERRCODE = '23514'; END IF;
  IF OLD."status" = 'WITHDRAWN' AND NEW."status" <> OLD."status" THEN
    RAISE EXCEPTION 'APPLICATION_WITHDRAWN' USING ERRCODE = '23514';
  END IF;
  IF OLD."withdrawnAt" IS NOT NULL AND NEW."withdrawnAt" IS DISTINCT FROM OLD."withdrawnAt" THEN
    RAISE EXCEPTION 'APPLICATION_SNAPSHOT_FROZEN' USING ERRCODE = '23514';
  END IF;
  IF (NEW."decision" IS DISTINCT FROM OLD."decision" OR NEW."decidedAt" IS DISTINCT FROM OLD."decidedAt"
    OR NEW."decidedByUserId" IS DISTINCT FROM OLD."decidedByUserId" OR NEW."decisionNote" IS DISTINCT FROM OLD."decisionNote")
    AND EXISTS (SELECT 1 FROM "FundingCall" WHERE "organizationId" = OLD."organizationId" AND "id" = OLD."fundingCallId" AND "resultsPublishedAt" IS NOT NULL) THEN
    RAISE EXCEPTION 'SELECTION_HISTORY_FROZEN' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Application_snapshot_guard" BEFORE UPDATE OR DELETE ON "Application" FOR EACH ROW EXECUTE FUNCTION "guard_application_snapshot"();

CREATE FUNCTION "guard_evaluation_criteria"() RETURNS trigger AS $$
DECLARE target_org TEXT; target_call TEXT; started_at TIMESTAMP;
BEGIN
  IF TG_OP = 'DELETE' THEN target_org := OLD."organizationId"; target_call := OLD."fundingCallId";
  ELSE target_org := NEW."organizationId"; target_call := NEW."fundingCallId"; END IF;
  SELECT "evaluationStartedAt" INTO started_at FROM "FundingCall" WHERE "organizationId" = target_org AND "id" = target_call FOR UPDATE;
  IF started_at IS NOT NULL AND EXISTS (SELECT 1 FROM "Organization" WHERE "id" = target_org) THEN
    RAISE EXCEPTION 'EVALUATION_CRITERIA_FROZEN' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW."organizationId" IS DISTINCT FROM OLD."organizationId" OR NEW."fundingCallId" IS DISTINCT FROM OLD."fundingCallId") THEN
    RAISE EXCEPTION 'EVALUATION_CRITERION_CALL_MISMATCH' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "EvaluationCriterion_plan_guard" BEFORE INSERT OR UPDATE OR DELETE ON "EvaluationCriterion" FOR EACH ROW EXECUTE FUNCTION "guard_evaluation_criteria"();

CREATE FUNCTION "guard_application_evaluation"() RETURNS trigger AS $$
DECLARE score_count INTEGER; criterion_count INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" = 'SUBMITTED' AND EXISTS (SELECT 1 FROM "Organization" WHERE "id" = OLD."organizationId") THEN
      RAISE EXCEPTION 'EVALUATION_SUBMITTED_IMMUTABLE' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."status" = 'SUBMITTED' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'EVALUATION_SUBMITTED_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  UPDATE "FundingCall" SET "evaluationStartedAt" = COALESCE("evaluationStartedAt", CURRENT_TIMESTAMP)
    WHERE "organizationId" = NEW."organizationId" AND "id" = NEW."fundingCallId";
  IF NEW."status" = 'SUBMITTED' THEN
    SELECT COUNT(*) INTO criterion_count FROM "EvaluationCriterion" WHERE "organizationId" = NEW."organizationId" AND "fundingCallId" = NEW."fundingCallId";
    SELECT COUNT(*) INTO score_count FROM "ApplicationEvaluationScore" WHERE "organizationId" = NEW."organizationId" AND "fundingCallId" = NEW."fundingCallId" AND "evaluationId" = NEW."id";
    IF criterion_count = 0 OR score_count <> criterion_count THEN RAISE EXCEPTION 'EVALUATION_INCOMPLETE' USING ERRCODE = '23514'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ApplicationEvaluation_history_guard" BEFORE INSERT OR UPDATE OR DELETE ON "ApplicationEvaluation" FOR EACH ROW EXECUTE FUNCTION "guard_application_evaluation"();

CREATE FUNCTION "guard_evaluation_score"() RETURNS trigger AS $$
DECLARE target_org TEXT; target_call TEXT; target_evaluation TEXT; evaluation_status "EvaluationStatus"; maximum NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN target_org := OLD."organizationId"; target_call := OLD."fundingCallId"; target_evaluation := OLD."evaluationId";
  ELSE target_org := NEW."organizationId"; target_call := NEW."fundingCallId"; target_evaluation := NEW."evaluationId"; END IF;
  SELECT "status" INTO evaluation_status FROM "ApplicationEvaluation" WHERE "organizationId" = target_org AND "fundingCallId" = target_call AND "id" = target_evaluation FOR UPDATE;
  IF evaluation_status = 'SUBMITTED' AND EXISTS (SELECT 1 FROM "Organization" WHERE "id" = target_org) THEN
    RAISE EXCEPTION 'EVALUATION_SUBMITTED_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW."evaluationId" IS DISTINCT FROM OLD."evaluationId" OR NEW."organizationId" IS DISTINCT FROM OLD."organizationId" OR NEW."fundingCallId" IS DISTINCT FROM OLD."fundingCallId") THEN
    RAISE EXCEPTION 'EVALUATION_CRITERION_CALL_MISMATCH' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  SELECT "maxScore" INTO maximum FROM "EvaluationCriterion" WHERE "organizationId" = NEW."organizationId" AND "fundingCallId" = NEW."fundingCallId" AND "id" = NEW."criterionId";
  IF maximum IS NULL OR NEW."score" < 0 OR NEW."score" > maximum THEN
    RAISE EXCEPTION 'EVALUATION_SCORE_RANGE_INVALID' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ApplicationEvaluationScore_history_guard" BEFORE INSERT OR UPDATE OR DELETE ON "ApplicationEvaluationScore" FOR EACH ROW EXECUTE FUNCTION "guard_evaluation_score"();

CREATE FUNCTION "guard_application_enrollment_origin"() RETURNS trigger AS $$
DECLARE application_call TEXT; application_project TEXT; application_decision "ApplicationDecision"; application_status "ApplicationStatus"; cohort_call TEXT; venture_project TEXT; published_at TIMESTAMP;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."applicationId" IS NOT NULL AND (NEW."applicationId" IS DISTINCT FROM OLD."applicationId" OR NEW."cohortId" IS DISTINCT FROM OLD."cohortId" OR NEW."ventureId" IS DISTINCT FROM OLD."ventureId") THEN
    RAISE EXCEPTION 'APPLICATION_ENROLLMENT_ORIGIN_FROZEN' USING ERRCODE = '23514';
  END IF;
  IF NEW."applicationId" IS NULL THEN RETURN NEW; END IF;
  SELECT "fundingCallId", "projectId", "decision", "status" INTO application_call, application_project, application_decision, application_status FROM "Application" WHERE "organizationId" = NEW."organizationId" AND "id" = NEW."applicationId";
  SELECT "resultsPublishedAt" INTO published_at FROM "FundingCall" WHERE "organizationId" = NEW."organizationId" AND "id" = application_call;
  SELECT "fundingCallId" INTO cohort_call FROM "Cohort" WHERE "organizationId" = NEW."organizationId" AND "id" = NEW."cohortId";
  SELECT "sourceProjectId" INTO venture_project FROM "Venture" WHERE "organizationId" = NEW."organizationId" AND "id" = NEW."ventureId";
  IF application_call IS NULL OR application_call IS DISTINCT FROM cohort_call OR application_project IS DISTINCT FROM venture_project OR application_decision <> 'SELECTED' OR application_status <> 'DECIDED' OR published_at IS NULL THEN
    RAISE EXCEPTION 'APPLICATION_COHORT_CALL_MISMATCH' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "VentureEnrollment_application_origin_guard" BEFORE INSERT OR UPDATE ON "VentureEnrollment" FOR EACH ROW EXECUTE FUNCTION "guard_application_enrollment_origin"();

CREATE FUNCTION "guard_selection_historical_identity"() RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'FundingCall' THEN
    IF (OLD."evaluationStartedAt" IS NOT NULL AND NEW."evaluationStartedAt" IS DISTINCT FROM OLD."evaluationStartedAt")
      OR (OLD."resultsPublishedAt" IS NOT NULL AND NEW."resultsPublishedAt" IS DISTINCT FROM OLD."resultsPublishedAt") THEN
      RAISE EXCEPTION 'SELECTION_HISTORY_FROZEN' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'Venture' THEN
    IF OLD."sourceProjectId" IS NOT NULL AND NEW."sourceProjectId" IS DISTINCT FROM OLD."sourceProjectId" THEN
      RAISE EXCEPTION 'APPLICATION_ENROLLMENT_ORIGIN_FROZEN' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'Cohort' THEN
    IF NEW."fundingCallId" IS DISTINCT FROM OLD."fundingCallId" AND EXISTS (SELECT 1 FROM "VentureEnrollment" WHERE "organizationId" = OLD."organizationId" AND "cohortId" = OLD."id" AND "applicationId" IS NOT NULL) THEN
      RAISE EXCEPTION 'APPLICATION_COHORT_CALL_MISMATCH' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "FundingCall_selection_history_guard" BEFORE UPDATE ON "FundingCall" FOR EACH ROW EXECUTE FUNCTION "guard_selection_historical_identity"();
CREATE TRIGGER "Venture_source_identity_guard" BEFORE UPDATE ON "Venture" FOR EACH ROW EXECUTE FUNCTION "guard_selection_historical_identity"();
CREATE TRIGGER "Cohort_application_call_guard" BEFORE UPDATE ON "Cohort" FOR EACH ROW EXECUTE FUNCTION "guard_selection_historical_identity"();
