BEGIN;

-- CreateEnum
CREATE TYPE "MetricAggregationMode" AS ENUM ('TOTAL', 'MEAN', 'MEDIAN', 'DISTRIBUTION');

-- CreateEnum
CREATE TYPE "AnalyticsReportType" AS ENUM ('PORTFOLIO_EXECUTIVE', 'PROGRAM_SUMMARY', 'COHORT_LONGITUDINAL', 'DATA_QUALITY', 'EXECUTION_SUMMARY');

-- CreateEnum
CREATE TYPE "DataExportType" AS ENUM ('COHORT_OBSERVATIONS', 'COHORT_AGGREGATES', 'PROGRAM_SUMMARY', 'EXECUTION_SUMMARY', 'APPLICATIONS_SUMMARY', 'PORTFOLIO_SUMMARY');

-- AlterTable
ALTER TABLE "IndicatorDefinition" ADD COLUMN     "metricDefinitionId" TEXT;

-- CreateTable
CREATE TABLE "MetricDefinition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" VARCHAR(160) NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "valueType" "IndicatorValueType" NOT NULL,
    "unit" TEXT,
    "allowedValues" JSONB,
    "primaryAggregation" "MetricAggregationMode" NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetricDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsReportSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "AnalyticsReportType" NOT NULL,
    "title" TEXT NOT NULL,
    "fundingProgramId" TEXT,
    "cohortId" TEXT,
    "parameters" JSONB NOT NULL,
    "payload" JSONB NOT NULL,
    "analyticsSchemaVersion" INTEGER NOT NULL DEFAULT 1,
    "sourceDigest" VARCHAR(64) NOT NULL,
    "generatedByUserId" TEXT NOT NULL,
    "dataAsOf" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersedesId" TEXT,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "AnalyticsReportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataExportAudit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "exportedByUserId" TEXT NOT NULL,
    "type" "DataExportType" NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'CSV',
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT,
    "fundingProgramId" TEXT,
    "cohortId" TEXT,
    "reportSnapshotId" TEXT,
    "parameters" JSONB NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "dataAsOf" TIMESTAMP(3) NOT NULL,
    "sourceDigest" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataExportAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationAnalyticsSettings" (
    "organizationId" TEXT NOT NULL,
    "publicMinimumCellSize" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationAnalyticsSettings_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "PublicResultPublication" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reportSnapshotId" TEXT NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "publicPayload" JSONB NOT NULL,
    "publicPayloadDigest" VARCHAR(64) NOT NULL,
    "publicMinimumCellSize" INTEGER NOT NULL DEFAULT 5,
    "publishedByUserId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "unpublishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicResultPublication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetricDefinition_organizationId_archivedAt_label_idx" ON "MetricDefinition"("organizationId", "archivedAt", "label");

-- CreateIndex
CREATE UNIQUE INDEX "MetricDefinition_organizationId_id_key" ON "MetricDefinition"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "MetricDefinition_organizationId_key_key" ON "MetricDefinition"("organizationId", "key");

-- CreateIndex
CREATE INDEX "AnalyticsReportSnapshot_organizationId_generatedAt_idx" ON "AnalyticsReportSnapshot"("organizationId", "generatedAt");

-- CreateIndex
CREATE INDEX "AnalyticsReportSnapshot_organizationId_fundingProgramId_gen_idx" ON "AnalyticsReportSnapshot"("organizationId", "fundingProgramId", "generatedAt");

-- CreateIndex
CREATE INDEX "AnalyticsReportSnapshot_organizationId_cohortId_generatedAt_idx" ON "AnalyticsReportSnapshot"("organizationId", "cohortId", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsReportSnapshot_organizationId_id_key" ON "AnalyticsReportSnapshot"("organizationId", "id");

-- CreateIndex
CREATE INDEX "DataExportAudit_organizationId_createdAt_idx" ON "DataExportAudit"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PublicResultPublication_slug_key" ON "PublicResultPublication"("slug");

-- CreateIndex
CREATE INDEX "PublicResultPublication_publishedAt_unpublishedAt_idx" ON "PublicResultPublication"("publishedAt", "unpublishedAt");

-- CreateIndex
CREATE INDEX "PublicResultPublication_organizationId_createdAt_idx" ON "PublicResultPublication"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PublicResultPublication_organizationId_id_key" ON "PublicResultPublication"("organizationId", "id");

-- CreateIndex
CREATE INDEX "IndicatorDefinition_organizationId_metricDefinitionId_idx" ON "IndicatorDefinition"("organizationId", "metricDefinitionId");

-- AddForeignKey
ALTER TABLE "IndicatorDefinition" ADD CONSTRAINT "IndicatorDefinition_organizationId_metricDefinitionId_fkey" FOREIGN KEY ("organizationId", "metricDefinitionId") REFERENCES "MetricDefinition"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricDefinition" ADD CONSTRAINT "MetricDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsReportSnapshot" ADD CONSTRAINT "AnalyticsReportSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsReportSnapshot" ADD CONSTRAINT "AnalyticsReportSnapshot_organizationId_fundingProgramId_fkey" FOREIGN KEY ("organizationId", "fundingProgramId") REFERENCES "FundingProgram"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsReportSnapshot" ADD CONSTRAINT "AnalyticsReportSnapshot_organizationId_cohortId_fkey" FOREIGN KEY ("organizationId", "cohortId") REFERENCES "Cohort"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsReportSnapshot" ADD CONSTRAINT "AnalyticsReportSnapshot_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsReportSnapshot" ADD CONSTRAINT "AnalyticsReportSnapshot_organizationId_supersedesId_fkey" FOREIGN KEY ("organizationId", "supersedesId") REFERENCES "AnalyticsReportSnapshot"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataExportAudit" ADD CONSTRAINT "DataExportAudit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataExportAudit" ADD CONSTRAINT "DataExportAudit_exportedByUserId_fkey" FOREIGN KEY ("exportedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataExportAudit" ADD CONSTRAINT "DataExportAudit_organizationId_fundingProgramId_fkey" FOREIGN KEY ("organizationId", "fundingProgramId") REFERENCES "FundingProgram"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataExportAudit" ADD CONSTRAINT "DataExportAudit_organizationId_cohortId_fkey" FOREIGN KEY ("organizationId", "cohortId") REFERENCES "Cohort"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataExportAudit" ADD CONSTRAINT "DataExportAudit_organizationId_reportSnapshotId_fkey" FOREIGN KEY ("organizationId", "reportSnapshotId") REFERENCES "AnalyticsReportSnapshot"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationAnalyticsSettings" ADD CONSTRAINT "OrganizationAnalyticsSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicResultPublication" ADD CONSTRAINT "PublicResultPublication_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicResultPublication" ADD CONSTRAINT "PublicResultPublication_organizationId_reportSnapshotId_fkey" FOREIGN KEY ("organizationId", "reportSnapshotId") REFERENCES "AnalyticsReportSnapshot"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicResultPublication" ADD CONSTRAINT "PublicResultPublication_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicResultPublication" ADD CONSTRAINT "PublicResultPublication_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "valid_metric_options"(options JSONB) RETURNS BOOLEAN AS $$
BEGIN
  IF options IS NULL OR jsonb_typeof(options) <> 'array' THEN RETURN FALSE; END IF;
  IF jsonb_array_length(options) NOT BETWEEN 1 AND 30 THEN RETURN FALSE; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(options) value WHERE jsonb_typeof(value) <> 'string' OR length(trim(value #>> '{}')) NOT BETWEEN 1 AND 120) THEN RETURN FALSE; END IF;
  RETURN (SELECT count(*) = count(DISTINCT value) FROM jsonb_array_elements(options) value);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

ALTER TABLE "MetricDefinition" ADD CONSTRAINT "MetricDefinition_semantics_valid" CHECK (
  ("valueType" = 'ENUM' AND "primaryAggregation" = 'DISTRIBUTION' AND "valid_metric_options"("allowedValues"))
  OR ("valueType" <> 'ENUM' AND "primaryAggregation" <> 'DISTRIBUTION' AND ("allowedValues" IS NULL OR "allowedValues" = 'null'::jsonb))
);
ALTER TABLE "OrganizationAnalyticsSettings" ADD CONSTRAINT "OrganizationAnalyticsSettings_public_minimum_bounds" CHECK ("publicMinimumCellSize" BETWEEN 3 AND 20);
ALTER TABLE "PublicResultPublication" ADD CONSTRAINT "PublicResultPublication_public_minimum_bounds" CHECK ("publicMinimumCellSize" BETWEEN 3 AND 20);
ALTER TABLE "PublicResultPublication" ADD CONSTRAINT "PublicResultPublication_approval_required" CHECK (
  ("publishedAt" IS NULL AND "publishedByUserId" IS NULL AND "unpublishedAt" IS NULL)
  OR ("publishedAt" IS NOT NULL AND "publishedByUserId" IS NOT NULL AND ("unpublishedAt" IS NULL OR "unpublishedAt" >= "publishedAt"))
);
ALTER TABLE "PublicResultPublication" ADD CONSTRAINT "PublicResultPublication_payload_digest" CHECK ("publicPayloadDigest" ~ '^[a-f0-9]{64}$');
ALTER TABLE "AnalyticsReportSnapshot" ADD CONSTRAINT "AnalyticsReportSnapshot_schema_valid" CHECK ("analyticsSchemaVersion" > 0 AND "sourceDigest" ~ '^[a-f0-9]{64}$' AND "supersedesId" IS DISTINCT FROM "id");
ALTER TABLE "AnalyticsReportSnapshot" ADD CONSTRAINT "AnalyticsReportSnapshot_payload_bounded" CHECK (octet_length("payload"::text) <= 2097152 AND octet_length("parameters"::text) <= 16384);
ALTER TABLE "PublicResultPublication" ADD CONSTRAINT "PublicResultPublication_payload_bounded" CHECK (octet_length("publicPayload"::text) <= 2097152);
ALTER TABLE "DataExportAudit" ADD CONSTRAINT "DataExportAudit_metadata_valid" CHECK ("format" = 'CSV' AND "rowCount" BETWEEN 0 AND 50000 AND "sourceDigest" ~ '^[a-f0-9]{64}$' AND octet_length("parameters"::text) <= 16384);

-- Historical equivalence is deliberately limited to exact ordered semantics inside the same protocol.
-- Labels are display metadata and never participate in this partition.
CREATE TEMP TABLE "_MetricBackfill" AS
SELECT indicator."organizationId", version."trackingProtocolId", indicator."key", indicator."valueType", indicator."unit",
  CASE WHEN indicator."valueType" = 'ENUM' THEN indicator."allowedValues" ELSE NULL END AS "allowedValues",
  min(indicator."id") AS "representativeId",
  (array_agg(indicator."label" ORDER BY version."version", indicator."id"))[1] AS "label"
FROM "IndicatorDefinition" indicator
JOIN "TrackingProtocolVersion" version ON version."organizationId" = indicator."organizationId" AND version."id" = indicator."trackingProtocolVersionId"
WHERE indicator."valueType" <> 'ENUM' OR "valid_metric_options"(indicator."allowedValues")
GROUP BY indicator."organizationId", version."trackingProtocolId", indicator."key", indicator."valueType", indicator."unit",
  CASE WHEN indicator."valueType" = 'ENUM' THEN indicator."allowedValues" ELSE NULL END;

INSERT INTO "MetricDefinition" ("id", "organizationId", "key", "label", "valueType", "unit", "allowedValues", "primaryAggregation", "updatedAt")
SELECT 'metric_' || "representativeId", "organizationId", 'legacy_' || md5("representativeId"), "label", "valueType", "unit", "allowedValues",
  CASE WHEN "valueType" = 'ENUM' THEN 'DISTRIBUTION'::"MetricAggregationMode" ELSE 'TOTAL'::"MetricAggregationMode" END, CURRENT_TIMESTAMP
FROM "_MetricBackfill";

ALTER TABLE "IndicatorDefinition" DISABLE TRIGGER "IndicatorDefinition_immutable";
UPDATE "IndicatorDefinition" indicator SET "metricDefinitionId" = 'metric_' || backfill."representativeId"
FROM "TrackingProtocolVersion" version, "_MetricBackfill" backfill
WHERE version."organizationId" = indicator."organizationId" AND version."id" = indicator."trackingProtocolVersionId"
  AND backfill."organizationId" = indicator."organizationId" AND backfill."trackingProtocolId" = version."trackingProtocolId"
  AND backfill."key" = indicator."key" AND backfill."valueType" = indicator."valueType"
  AND backfill."unit" IS NOT DISTINCT FROM indicator."unit"
  AND backfill."allowedValues" IS NOT DISTINCT FROM CASE WHEN indicator."valueType" = 'ENUM' THEN indicator."allowedValues" ELSE NULL END;
ALTER TABLE "IndicatorDefinition" ENABLE TRIGGER "IndicatorDefinition_immutable";
DROP TABLE "_MetricBackfill";

CREATE FUNCTION "guard_indicator_metric_identity"() RETURNS trigger AS $$
DECLARE metric "MetricDefinition";
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM "Organization" WHERE "id" = OLD."organizationId") THEN RAISE EXCEPTION 'PROTOCOL_VERSION_IMMUTABLE' USING ERRCODE = '23514'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(NEW) - 'metricDefinitionId') IS DISTINCT FROM (to_jsonb(OLD) - 'metricDefinitionId') THEN RAISE EXCEPTION 'PROTOCOL_VERSION_IMMUTABLE' USING ERRCODE = '23514'; END IF;
    IF NEW."metricDefinitionId" IS DISTINCT FROM OLD."metricDefinitionId" AND EXISTS (SELECT 1 FROM "ObservationValue" WHERE "organizationId" = OLD."organizationId" AND "indicatorDefinitionId" = OLD."id") THEN RAISE EXCEPTION 'METRIC_MAPPING_HISTORY_FROZEN' USING ERRCODE = '23514'; END IF;
  END IF;
  IF NEW."metricDefinitionId" IS NOT NULL THEN
    SELECT * INTO metric FROM "MetricDefinition" WHERE "organizationId" = NEW."organizationId" AND "id" = NEW."metricDefinitionId" FOR SHARE;
    IF metric."id" IS NULL OR metric."archivedAt" IS NOT NULL OR metric."valueType" <> NEW."valueType" OR metric."unit" IS DISTINCT FROM NEW."unit"
      OR (NEW."valueType" = 'ENUM' AND metric."allowedValues" IS DISTINCT FROM NEW."allowedValues") THEN RAISE EXCEPTION 'METRIC_MAPPING_INCOMPATIBLE' USING ERRCODE = '23514'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER "IndicatorDefinition_immutable" ON "IndicatorDefinition";
CREATE TRIGGER "IndicatorDefinition_metric_identity_guard" BEFORE INSERT OR UPDATE OR DELETE ON "IndicatorDefinition" FOR EACH ROW EXECUTE FUNCTION "guard_indicator_metric_identity"();

CREATE FUNCTION "guard_metric_history"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM "Organization" WHERE "id" = OLD."organizationId") THEN RAISE EXCEPTION 'METRIC_HISTORY_FROZEN' USING ERRCODE = '23514'; END IF;
    RETURN OLD;
  END IF;
  IF ROW(NEW."id", NEW."organizationId", NEW."key", NEW."createdAt") IS DISTINCT FROM ROW(OLD."id", OLD."organizationId", OLD."key", OLD."createdAt") THEN RAISE EXCEPTION 'METRIC_KEY_IMMUTABLE' USING ERRCODE = '23514'; END IF;
  IF OLD."archivedAt" IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'METRIC_ARCHIVED' USING ERRCODE = '23514'; END IF;
  IF NEW."archivedAt" IS NOT NULL AND EXISTS (SELECT 1 FROM "IndicatorDefinition" WHERE "organizationId" = OLD."organizationId" AND "metricDefinitionId" = OLD."id") THEN RAISE EXCEPTION 'METRIC_IN_USE' USING ERRCODE = '23514'; END IF;
  IF ROW(NEW."valueType", NEW."unit", NEW."allowedValues") IS DISTINCT FROM ROW(OLD."valueType", OLD."unit", OLD."allowedValues") THEN
    IF EXISTS (SELECT 1 FROM "IndicatorDefinition" indicator JOIN "ObservationValue" value ON value."organizationId" = indicator."organizationId" AND value."indicatorDefinitionId" = indicator."id" WHERE indicator."organizationId" = OLD."organizationId" AND indicator."metricDefinitionId" = OLD."id") THEN RAISE EXCEPTION 'METRIC_HISTORY_FROZEN' USING ERRCODE = '23514'; END IF;
    IF EXISTS (SELECT 1 FROM "IndicatorDefinition" WHERE "organizationId" = OLD."organizationId" AND "metricDefinitionId" = OLD."id" AND ("valueType" <> NEW."valueType" OR "unit" IS DISTINCT FROM NEW."unit" OR ("valueType" = 'ENUM' AND "allowedValues" IS DISTINCT FROM NEW."allowedValues"))) THEN RAISE EXCEPTION 'METRIC_MAPPING_INCOMPATIBLE' USING ERRCODE = '23514'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "MetricDefinition_history_guard" BEFORE UPDATE OR DELETE ON "MetricDefinition" FOR EACH ROW EXECUTE FUNCTION "guard_metric_history"();

-- Shared locks serialize observation authoring with metric mapping and semantic changes.
CREATE FUNCTION "lock_observation_metric_identity"() RETURNS trigger AS $$
DECLARE metric_id TEXT;
BEGIN
  SELECT "metricDefinitionId" INTO metric_id FROM "IndicatorDefinition" WHERE "organizationId" = NEW."organizationId" AND "id" = NEW."indicatorDefinitionId" FOR SHARE;
  IF metric_id IS NOT NULL THEN PERFORM "id" FROM "MetricDefinition" WHERE "organizationId" = NEW."organizationId" AND "id" = metric_id FOR SHARE; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ObservationValue_metric_identity_lock" BEFORE INSERT OR UPDATE ON "ObservationValue" FOR EACH ROW EXECUTE FUNCTION "lock_observation_metric_identity"();

CREATE FUNCTION "guard_analytics_report_snapshot"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM "Organization" WHERE "id" = OLD."organizationId") THEN RAISE EXCEPTION 'REPORT_SNAPSHOT_IMMUTABLE' USING ERRCODE = '23514'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - 'archivedAt') IS DISTINCT FROM (to_jsonb(OLD) - 'archivedAt') THEN RAISE EXCEPTION 'REPORT_SNAPSHOT_IMMUTABLE' USING ERRCODE = '23514'; END IF;
  IF NEW."cohortId" IS NOT NULL AND (NEW."fundingProgramId" IS NULL OR NOT EXISTS (SELECT 1 FROM "Cohort" WHERE "organizationId" = NEW."organizationId" AND "id" = NEW."cohortId" AND "fundingProgramId" = NEW."fundingProgramId")) THEN RAISE EXCEPTION 'REPORT_SCOPE_INVALID' USING ERRCODE = '23514'; END IF;
  IF (NEW."type" = 'COHORT_LONGITUDINAL' AND NEW."cohortId" IS NULL) OR (NEW."type" IN ('PROGRAM_SUMMARY', 'EXECUTION_SUMMARY') AND NEW."fundingProgramId" IS NULL) THEN RAISE EXCEPTION 'REPORT_SCOPE_INVALID' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AnalyticsReportSnapshot_immutable" BEFORE INSERT OR UPDATE OR DELETE ON "AnalyticsReportSnapshot" FOR EACH ROW EXECUTE FUNCTION "guard_analytics_report_snapshot"();

CREATE FUNCTION "guard_data_export_audit"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM "Organization" WHERE "id" = OLD."organizationId") THEN RAISE EXCEPTION 'EXPORT_AUDIT_IMMUTABLE' USING ERRCODE = '23514'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'EXPORT_AUDIT_IMMUTABLE' USING ERRCODE = '23514'; END IF;
  IF NEW."scopeId" IS NOT NULL AND NOT (
    (NEW."scopeType" = 'PORTFOLIO' AND NEW."scopeId" = NEW."organizationId")
    OR (NEW."scopeType" = 'PROGRAM' AND EXISTS (SELECT 1 FROM "FundingProgram" WHERE "organizationId" = NEW."organizationId" AND "id" = NEW."scopeId"))
    OR (NEW."scopeType" = 'COHORT' AND EXISTS (SELECT 1 FROM "Cohort" WHERE "organizationId" = NEW."organizationId" AND "id" = NEW."scopeId"))
    OR (NEW."scopeType" = 'REPORT' AND EXISTS (SELECT 1 FROM "AnalyticsReportSnapshot" WHERE "organizationId" = NEW."organizationId" AND "id" = NEW."scopeId"))
  ) THEN RAISE EXCEPTION 'EXPORT_SCOPE_INVALID' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "DataExportAudit_immutable" BEFORE INSERT OR UPDATE OR DELETE ON "DataExportAudit" FOR EACH ROW EXECUTE FUNCTION "guard_data_export_audit"();

CREATE FUNCTION "guard_public_result_publication"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."publishedAt" IS NOT NULL AND EXISTS (SELECT 1 FROM "Organization" WHERE "id" = OLD."organizationId") THEN RAISE EXCEPTION 'PUBLICATION_HISTORY_IMMUTABLE' USING ERRCODE = '23514'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW."id", NEW."organizationId", NEW."createdByUserId", NEW."createdAt") IS DISTINCT FROM ROW(OLD."id", OLD."organizationId", OLD."createdByUserId", OLD."createdAt") THEN RAISE EXCEPTION 'PUBLICATION_HISTORY_IMMUTABLE' USING ERRCODE = '23514'; END IF;
    IF OLD."publishedAt" IS NOT NULL AND (to_jsonb(NEW) - 'unpublishedAt' - 'updatedAt') IS DISTINCT FROM (to_jsonb(OLD) - 'unpublishedAt' - 'updatedAt') THEN RAISE EXCEPTION 'PUBLIC_PAYLOAD_IMMUTABLE' USING ERRCODE = '23514'; END IF;
    IF OLD."unpublishedAt" IS NOT NULL AND NEW."unpublishedAt" IS DISTINCT FROM OLD."unpublishedAt" THEN RAISE EXCEPTION 'PUBLICATION_HISTORY_IMMUTABLE' USING ERRCODE = '23514'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "PublicResultPublication_history_guard" BEFORE UPDATE OR DELETE ON "PublicResultPublication" FOR EACH ROW EXECUTE FUNCTION "guard_public_result_publication"();

COMMIT;
