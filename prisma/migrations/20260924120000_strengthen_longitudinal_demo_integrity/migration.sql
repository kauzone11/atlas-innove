-- Additive domain integrity for historical enrollment, cohort provenance and applied methodology.
ALTER TYPE "FundingCallStatus" ADD VALUE 'IN_REVIEW';
ALTER TYPE "FundingCallStatus" ADD VALUE 'RESULT_PUBLISHED';
ALTER TYPE "OpportunityStatus" ADD VALUE 'IN_REVIEW';
ALTER TYPE "OpportunityStatus" ADD VALUE 'RESULT_PUBLISHED';

ALTER TABLE "Cohort"
    ADD COLUMN "fundingCallId" TEXT,
    ADD COLUMN "trackingProtocolVersionId" TEXT;

ALTER TABLE "VentureEnrollment"
    ADD COLUMN "withdrawnAt" TIMESTAMP(3);

ALTER TABLE "FundingCall"
    ADD CONSTRAINT "FundingCall_organizationId_id_fundingProgramId_key"
    UNIQUE ("organizationId", "id", "fundingProgramId");

CREATE INDEX "Cohort_organizationId_fundingCallId_idx"
    ON "Cohort"("organizationId", "fundingCallId");

CREATE INDEX "Cohort_organizationId_trackingProtocolVersionId_idx"
    ON "Cohort"("organizationId", "trackingProtocolVersionId");

CREATE INDEX "VentureEnrollment_organizationId_cohortId_withdrawnAt_idx"
    ON "VentureEnrollment"("organizationId", "cohortId", "withdrawnAt");

ALTER TABLE "Cohort"
    ADD CONSTRAINT "Cohort_organizationId_fundingCallId_fundingProgramId_fkey"
    FOREIGN KEY ("organizationId", "fundingCallId", "fundingProgramId")
    REFERENCES "FundingCall"("organizationId", "id", "fundingProgramId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Cohort"
    ADD CONSTRAINT "Cohort_organizationId_trackingProtocolVersionId_fkey"
    FOREIGN KEY ("organizationId", "trackingProtocolVersionId")
    REFERENCES "TrackingProtocolVersion"("organizationId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
