-- Public demo domain: calls, documents, longitudinal indicators, milestones and opportunities.
CREATE TYPE "FundingCallStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED');
CREATE TYPE "FundingCallDocumentType" AS ENUM ('NOTICE', 'ANNEX', 'AMENDMENT', 'RESULT', 'OTHER');
CREATE TYPE "IndicatorValueType" AS ENUM ('INTEGER', 'CURRENCY', 'ENUM');
CREATE TYPE "MilestoneType" AS ENUM ('MVP_LAUNCHED', 'FIRST_CUSTOMER', 'COMPANY_FORMALIZED', 'RECURRING_CONTRACT', 'ADDITIONAL_INVESTMENT', 'TEAM_EXPANSION', 'PIVOT', 'CLOSED');
CREATE TYPE "OpportunityStatus" AS ENUM ('OPEN', 'UPCOMING', 'CLOSED', 'ARCHIVED');

ALTER TABLE "Venture" ADD COLUMN "slug" TEXT;

CREATE TABLE "FundingCall" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fundingProgramId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortTitle" TEXT,
    "callNumber" TEXT NOT NULL,
    "objective" TEXT,
    "status" "FundingCallStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "applicationStartsAt" TIMESTAMP(3),
    "applicationEndsAt" TIMESTAMP(3),
    "totalBudget" DECIMAL(14,2),
    "maximumSupport" DECIMAL(14,2),
    "targetProjects" INTEGER,
    "executionMonths" INTEGER,
    "sourceUrl" TEXT NOT NULL,
    "sourceCheckedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FundingCall_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FundingCallDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fundingCallId" TEXT NOT NULL,
    "type" "FundingCallDocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "externalUrl" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FundingCallDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrackingProtocol" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrackingProtocol_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrackingProtocolVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "trackingProtocolId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrackingProtocolVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IndicatorDefinition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "trackingProtocolVersionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "valueType" "IndicatorValueType" NOT NULL,
    "unit" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "allowedValues" JSONB,
    CONSTRAINT "IndicatorDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ObservationValue" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "indicatorDefinitionId" TEXT NOT NULL,
    "integerValue" INTEGER,
    "decimalValue" DECIMAL(14,2),
    "textValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ObservationValue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ventureId" TEXT NOT NULL,
    "type" "MilestoneType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "callNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "territory" TEXT NOT NULL,
    "audience" TEXT,
    "status" "OpportunityStatus" NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "applicationEndsAt" TIMESTAMP(3),
    "sourceUrl" TEXT NOT NULL,
    "sourceCheckedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FundingCall_organizationId_id_key" ON "FundingCall"("organizationId", "id");
CREATE UNIQUE INDEX "FundingCall_organizationId_callNumber_key" ON "FundingCall"("organizationId", "callNumber");
CREATE INDEX "FundingCall_organizationId_status_idx" ON "FundingCall"("organizationId", "status");
CREATE UNIQUE INDEX "FundingCallDocument_organizationId_fundingCallId_title_key" ON "FundingCallDocument"("organizationId", "fundingCallId", "title");
CREATE INDEX "FundingCallDocument_organizationId_fundingCallId_idx" ON "FundingCallDocument"("organizationId", "fundingCallId");
CREATE UNIQUE INDEX "TrackingProtocol_organizationId_id_key" ON "TrackingProtocol"("organizationId", "id");
CREATE UNIQUE INDEX "TrackingProtocol_organizationId_slug_key" ON "TrackingProtocol"("organizationId", "slug");
CREATE UNIQUE INDEX "TrackingProtocolVersion_organizationId_id_key" ON "TrackingProtocolVersion"("organizationId", "id");
CREATE UNIQUE INDEX "TrackingProtocolVersion_organizationId_trackingProtocolId_version_key" ON "TrackingProtocolVersion"("organizationId", "trackingProtocolId", "version");
CREATE UNIQUE INDEX "IndicatorDefinition_organizationId_id_key" ON "IndicatorDefinition"("organizationId", "id");
CREATE UNIQUE INDEX "IndicatorDefinition_organizationId_trackingProtocolVersionId_key_key" ON "IndicatorDefinition"("organizationId", "trackingProtocolVersionId", "key");
CREATE INDEX "IndicatorDefinition_organizationId_trackingProtocolVersionId_position_idx" ON "IndicatorDefinition"("organizationId", "trackingProtocolVersionId", "position");
CREATE UNIQUE INDEX "ObservationValue_organizationId_observationId_indicatorDefinitionId_key" ON "ObservationValue"("organizationId", "observationId", "indicatorDefinitionId");
CREATE INDEX "ObservationValue_organizationId_indicatorDefinitionId_idx" ON "ObservationValue"("organizationId", "indicatorDefinitionId");
CREATE UNIQUE INDEX "Milestone_organizationId_ventureId_occurredAt_title_key" ON "Milestone"("organizationId", "ventureId", "occurredAt", "title");
CREATE INDEX "Milestone_organizationId_ventureId_occurredAt_idx" ON "Milestone"("organizationId", "ventureId", "occurredAt");
CREATE UNIQUE INDEX "Opportunity_organizationId_callNumber_key" ON "Opportunity"("organizationId", "callNumber");
CREATE INDEX "Opportunity_organizationId_status_idx" ON "Opportunity"("organizationId", "status");
CREATE UNIQUE INDEX "Venture_organizationId_slug_key" ON "Venture"("organizationId", "slug");
CREATE UNIQUE INDEX "VentureObservation_organizationId_id_key" ON "VentureObservation"("organizationId", "id");

ALTER TABLE "VentureObservation" RENAME CONSTRAINT "VentureObservation_organizationId_cohortId_ventureEnrollmentId_" TO "VentureObservation_organizationId_cohortId_ventureEnrollme_fkey";
ALTER INDEX "VentureObservation_organizationId_ventureEnrollmentId_followUpW" RENAME TO "VentureObservation_organizationId_ventureEnrollmentId_follo_key";
ALTER INDEX "VentureObservation_organizationId_ventureEnrollmentId_status_id" RENAME TO "VentureObservation_organizationId_ventureEnrollmentId_statu_idx";

ALTER TABLE "FundingCall" ADD CONSTRAINT "FundingCall_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FundingCall" ADD CONSTRAINT "FundingCall_organizationId_fundingProgramId_fkey" FOREIGN KEY ("organizationId", "fundingProgramId") REFERENCES "FundingProgram"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FundingCallDocument" ADD CONSTRAINT "FundingCallDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FundingCallDocument" ADD CONSTRAINT "FundingCallDocument_organizationId_fundingCallId_fkey" FOREIGN KEY ("organizationId", "fundingCallId") REFERENCES "FundingCall"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackingProtocol" ADD CONSTRAINT "TrackingProtocol_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackingProtocolVersion" ADD CONSTRAINT "TrackingProtocolVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackingProtocolVersion" ADD CONSTRAINT "TrackingProtocolVersion_organizationId_trackingProtocolId_fkey" FOREIGN KEY ("organizationId", "trackingProtocolId") REFERENCES "TrackingProtocol"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IndicatorDefinition" ADD CONSTRAINT "IndicatorDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IndicatorDefinition" ADD CONSTRAINT "IndicatorDefinition_organizationId_trackingProtocolVersionId_fkey" FOREIGN KEY ("organizationId", "trackingProtocolVersionId") REFERENCES "TrackingProtocolVersion"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ObservationValue" ADD CONSTRAINT "ObservationValue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ObservationValue" ADD CONSTRAINT "ObservationValue_organizationId_observationId_fkey" FOREIGN KEY ("organizationId", "observationId") REFERENCES "VentureObservation"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ObservationValue" ADD CONSTRAINT "ObservationValue_organizationId_indicatorDefinitionId_fkey" FOREIGN KEY ("organizationId", "indicatorDefinitionId") REFERENCES "IndicatorDefinition"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_organizationId_ventureId_fkey" FOREIGN KEY ("organizationId", "ventureId") REFERENCES "Venture"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
