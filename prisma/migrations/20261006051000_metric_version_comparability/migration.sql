BEGIN;

-- One protocol-version measurement per canonical identity prevents ambiguous denominators.
CREATE UNIQUE INDEX "IndicatorDefinition_organizationId_trackingProtocolVersionId_met_key" ON "IndicatorDefinition"("organizationId", "trackingProtocolVersionId", "metricDefinitionId");

-- Execution summaries can describe the institution or an explicitly selected program.
CREATE OR REPLACE FUNCTION "guard_analytics_report_snapshot"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM "Organization" WHERE "id" = OLD."organizationId") THEN RAISE EXCEPTION 'REPORT_SNAPSHOT_IMMUTABLE' USING ERRCODE = '23514'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - 'archivedAt') IS DISTINCT FROM (to_jsonb(OLD) - 'archivedAt') THEN RAISE EXCEPTION 'REPORT_SNAPSHOT_IMMUTABLE' USING ERRCODE = '23514'; END IF;
  IF NEW."cohortId" IS NOT NULL AND (NEW."fundingProgramId" IS NULL OR NOT EXISTS (SELECT 1 FROM "Cohort" WHERE "organizationId" = NEW."organizationId" AND "id" = NEW."cohortId" AND "fundingProgramId" = NEW."fundingProgramId")) THEN RAISE EXCEPTION 'REPORT_SCOPE_INVALID' USING ERRCODE = '23514'; END IF;
  IF (NEW."type" = 'COHORT_LONGITUDINAL' AND NEW."cohortId" IS NULL) OR (NEW."type" = 'PROGRAM_SUMMARY' AND NEW."fundingProgramId" IS NULL) THEN RAISE EXCEPTION 'REPORT_SCOPE_INVALID' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
