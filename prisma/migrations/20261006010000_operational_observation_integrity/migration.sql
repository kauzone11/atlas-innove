ALTER TABLE "VentureObservation" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "FundingCall" ALTER COLUMN "sourceUrl" DROP NOT NULL;
ALTER TABLE "FundingCall" ALTER COLUMN "sourceCheckedAt" DROP NOT NULL;

CREATE FUNCTION "guard_protocol_version_immutability"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'PROTOCOL_VERSION_IMMUTABLE' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM "Organization" WHERE "id" = OLD."organizationId") THEN
    RAISE EXCEPTION 'PROTOCOL_VERSION_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "TrackingProtocolVersion_immutable"
  BEFORE UPDATE OR DELETE ON "TrackingProtocolVersion"
  FOR EACH ROW EXECUTE FUNCTION "guard_protocol_version_immutability"();

CREATE TRIGGER "IndicatorDefinition_immutable"
  BEFORE UPDATE OR DELETE ON "IndicatorDefinition"
  FOR EACH ROW EXECUTE FUNCTION "guard_protocol_version_immutability"();

CREATE FUNCTION "guard_assigned_protocol_indicators"() RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Cohort" cohort
    JOIN "FollowUpWave" wave ON wave."organizationId" = cohort."organizationId" AND wave."cohortId" = cohort."id"
    WHERE cohort."organizationId" = NEW."organizationId"
      AND cohort."trackingProtocolVersionId" = NEW."trackingProtocolVersionId"
  ) AND NOT EXISTS (
    SELECT 1 FROM "IndicatorDefinition" indicator
    WHERE indicator."organizationId" = NEW."organizationId"
      AND indicator."trackingProtocolVersionId" = NEW."trackingProtocolVersionId"
      AND indicator."key" = NEW."key"
      AND indicator."label" = NEW."label"
      AND indicator."valueType" = NEW."valueType"
      AND indicator."unit" IS NOT DISTINCT FROM NEW."unit"
      AND indicator."position" = NEW."position"
      AND indicator."allowedValues" IS NOT DISTINCT FROM NEW."allowedValues"
  ) THEN
    RAISE EXCEPTION 'PROTOCOL_VERSION_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "IndicatorDefinition_assigned_version_insert_guard"
  BEFORE INSERT ON "IndicatorDefinition"
  FOR EACH ROW EXECUTE FUNCTION "guard_assigned_protocol_indicators"();

CREATE FUNCTION "guard_cohort_methodology_history"() RETURNS trigger AS $$
BEGIN
  IF (NEW."trackingProtocolVersionId" IS DISTINCT FROM OLD."trackingProtocolVersionId"
      OR NEW."fundingCallId" IS DISTINCT FROM OLD."fundingCallId"
      OR NEW."fundingProgramId" IS DISTINCT FROM OLD."fundingProgramId")
    AND EXISTS (SELECT 1 FROM "FollowUpWave" WHERE "organizationId" = OLD."organizationId" AND "cohortId" = OLD."id") THEN
    RAISE EXCEPTION 'COHORT_PROTOCOL_FROZEN' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Cohort_methodology_history_guard"
  BEFORE UPDATE ON "Cohort"
  FOR EACH ROW EXECUTE FUNCTION "guard_cohort_methodology_history"();

CREATE FUNCTION "guard_observation_value_protocol"() RETURNS trigger AS $$
DECLARE
  expected_version TEXT;
  indicator_version TEXT;
  indicator_type "IndicatorValueType";
  indicator_options JSONB;
BEGIN
  SELECT cohort."trackingProtocolVersionId" INTO expected_version
    FROM "VentureObservation" observation
    JOIN "Cohort" cohort ON cohort."organizationId" = observation."organizationId" AND cohort."id" = observation."cohortId"
    WHERE observation."organizationId" = NEW."organizationId" AND observation."id" = NEW."observationId";
  SELECT "trackingProtocolVersionId", "valueType", "allowedValues" INTO indicator_version, indicator_type, indicator_options
    FROM "IndicatorDefinition" WHERE "organizationId" = NEW."organizationId" AND "id" = NEW."indicatorDefinitionId";
  IF expected_version IS NULL OR indicator_version IS NULL OR expected_version <> indicator_version THEN
    RAISE EXCEPTION 'OBSERVATION_INDICATOR_VERSION_MISMATCH' USING ERRCODE = '23514';
  END IF;
  IF (indicator_type = 'INTEGER' AND (NEW."decimalValue" IS NOT NULL OR NEW."textValue" IS NOT NULL OR NEW."integerValue" < 0))
    OR (indicator_type = 'CURRENCY' AND (NEW."integerValue" IS NOT NULL OR NEW."textValue" IS NOT NULL OR NEW."decimalValue" < 0))
    OR (indicator_type = 'ENUM' AND (NEW."integerValue" IS NOT NULL OR NEW."decimalValue" IS NOT NULL
      OR (NEW."textValue" IS NOT NULL AND (indicator_options IS NULL OR jsonb_typeof(indicator_options) <> 'array' OR NOT indicator_options @> jsonb_build_array(NEW."textValue"))))) THEN
    RAISE EXCEPTION 'OBSERVATION_VALUE_TYPE_INVALID' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ObservationValue_protocol_guard"
  BEFORE INSERT OR UPDATE ON "ObservationValue"
  FOR EACH ROW EXECUTE FUNCTION "guard_observation_value_protocol"();

CREATE FUNCTION "guard_follow_up_wave_status"() RETURNS trigger AS $$
BEGIN
  IF NEW."status" IS DISTINCT FROM OLD."status" AND NOT (
    (OLD."status" = 'PLANNED' AND NEW."status" IN ('OPEN', 'ARCHIVED'))
    OR (OLD."status" = 'OPEN' AND NEW."status" = 'CLOSED')
    OR (OLD."status" = 'CLOSED' AND NEW."status" = 'ARCHIVED')
  ) THEN
    RAISE EXCEPTION 'WAVE_STATUS_TRANSITION_INVALID' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "FollowUpWave_status_guard"
  BEFORE UPDATE ON "FollowUpWave"
  FOR EACH ROW EXECUTE FUNCTION "guard_follow_up_wave_status"();
