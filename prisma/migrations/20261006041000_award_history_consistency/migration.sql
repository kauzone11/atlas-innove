-- Audit rows must describe the actual preceding lifecycle and an applied deadline change.
CREATE OR REPLACE FUNCTION "guard_award_status_history_insert"() RETURNS trigger AS $$
DECLARE current_award "Award"; previous_status "AwardStatus";
BEGIN
  SELECT * INTO current_award FROM "Award" WHERE "organizationId" = NEW."organizationId" AND "id" = NEW."awardId" FOR UPDATE;
  SELECT "toStatus" INTO previous_status FROM "AwardStatusHistory" WHERE "organizationId" = NEW."organizationId" AND "awardId" = NEW."awardId" ORDER BY "awardRevision" DESC LIMIT 1;
  IF current_award."status" <> NEW."toStatus" OR current_award."revision" <> NEW."awardRevision"
    OR NEW."changedAt" < current_award."createdAt" OR NEW."changedAt" > clock_timestamp()
    OR previous_status IS DISTINCT FROM NEW."fromStatus"
    OR (NEW."fromStatus" IS NULL AND NEW."changedByUserId" <> current_award."createdByUserId")
    OR (NEW."fromStatus" IS NOT NULL AND NOT (
      (NEW."fromStatus" = 'PREPARING' AND NEW."toStatus" IN ('ACTIVE', 'CANCELLED'))
      OR (NEW."fromStatus" = 'ACTIVE' AND NEW."toStatus" IN ('SUSPENDED', 'COMPLETED', 'TERMINATED'))
      OR (NEW."fromStatus" = 'SUSPENDED' AND NEW."toStatus" IN ('ACTIVE', 'COMPLETED', 'TERMINATED'))
    )) THEN RAISE EXCEPTION 'AWARD_STATUS_HISTORY_INVALID' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "require_applied_award_deadline_history"() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Organization" WHERE "id" = NEW."organizationId") AND NOT EXISTS (
    SELECT 1 FROM "AwardObligation" WHERE "organizationId" = NEW."organizationId" AND "awardId" = NEW."awardId" AND "id" = NEW."obligationId" AND "dueAt" IS NOT DISTINCT FROM NEW."newDueAt"
  ) THEN RAISE EXCEPTION 'AWARD_DEADLINE_HISTORY_INVALID' USING ERRCODE = '23514'; END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "AwardObligationDueDateHistory_applied_change_required" AFTER INSERT ON "AwardObligationDueDateHistory" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "require_applied_award_deadline_history"();

ALTER TABLE "AwardSubmission" ADD CONSTRAINT "AwardSubmission_chronological_review" CHECK ("reviewedAt" IS NULL OR "reviewedAt" >= "submittedAt");

-- Waiver preserves an existing private draft while closing ordinary authoring and submission.
CREATE OR REPLACE FUNCTION "guard_award_obligation_history"() RETURNS trigger AS $$
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
  IF NEW."waivedAt" IS NOT NULL AND EXISTS (SELECT 1 FROM "AwardSubmission" WHERE "organizationId" = target_org AND "awardId" = target_award AND "obligationId" = OLD."id" AND "reviewStatus" = 'APPROVED') THEN RAISE EXCEPTION 'AWARD_OBLIGATION_RESOLVED' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
