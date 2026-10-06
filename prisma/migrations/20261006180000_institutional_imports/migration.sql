BEGIN;

-- CreateEnum
CREATE TYPE "ImportType" AS ENUM ('FUNDING_PROGRAMS', 'FUNDING_CALLS', 'COHORTS', 'VENTURES', 'VENTURE_ENROLLMENTS', 'FOLLOW_UP_WAVES', 'OBSERVATIONS', 'MILESTONES');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('UPLOADED', 'VALIDATING', 'READY', 'APPLYING', 'APPLIED', 'FAILED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "ImportRowStatus" AS ENUM ('PENDING', 'VALID', 'INVALID', 'APPLIED', 'SKIPPED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "ImportOperation" AS ENUM ('CREATE', 'UPDATE');

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "ImportType" NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "namespace" VARCHAR(80) NOT NULL,
    "sourceName" VARCHAR(200),
    "sourceDigest" VARCHAR(64) NOT NULL,
    "delimiter" VARCHAR(1) NOT NULL,
    "headers" JSONB NOT NULL,
    "mapping" JSONB NOT NULL DEFAULT '{}',
    "options" JSONB NOT NULL DEFAULT '{}',
    "mappingConfirmedAt" TIMESTAMP(3),
    "totalRows" INTEGER NOT NULL,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "warningRows" INTEGER NOT NULL DEFAULT 0,
    "appliedRows" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT NOT NULL,
    "appliedByUserId" TEXT,
    "rolledBackByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "validatedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),
    "failureCode" VARCHAR(80),

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRow" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawData" JSONB NOT NULL,
    "normalizedData" JSONB,
    "status" "ImportRowStatus" NOT NULL DEFAULT 'PENDING',
    "errors" JSONB NOT NULL DEFAULT '[]',
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "resolvedReferences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportChange" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowId" TEXT,
    "entityType" "ImportType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "operation" "ImportOperation" NOT NULL,
    "beforeData" JSONB,
    "afterDigest" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rolledBackAt" TIMESTAMP(3),

    CONSTRAINT "ImportChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalReference" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "namespace" VARCHAR(80) NOT NULL,
    "entityType" "ImportType" NOT NULL,
    "externalId" VARCHAR(160) NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdByImportBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportBatch_organizationId_createdAt_id_idx" ON "ImportBatch"("organizationId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ImportBatch_organizationId_namespace_type_sourceDigest_idx" ON "ImportBatch"("organizationId", "namespace", "type", "sourceDigest");

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_organizationId_id_key" ON "ImportBatch"("organizationId", "id");

-- CreateIndex
CREATE INDEX "ImportRow_organizationId_batchId_status_rowNumber_idx" ON "ImportRow"("organizationId", "batchId", "status", "rowNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ImportRow_organizationId_batchId_id_key" ON "ImportRow"("organizationId", "batchId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ImportRow_batchId_rowNumber_key" ON "ImportRow"("batchId", "rowNumber");

-- CreateIndex
CREATE INDEX "ImportChange_organizationId_entityType_entityId_idx" ON "ImportChange"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportChange_organizationId_batchId_entityType_entityId_key" ON "ImportChange"("organizationId", "batchId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "ExternalReference_organizationId_entityType_entityId_idx" ON "ExternalReference"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "ExternalReference_organizationId_createdByImportBatchId_idx" ON "ExternalReference"("organizationId", "createdByImportBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalReference_tenant_source_key" ON "ExternalReference"("organizationId", "namespace", "entityType", "externalId");

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_appliedByUserId_fkey" FOREIGN KEY ("appliedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_rolledBackByUserId_fkey" FOREIGN KEY ("rolledBackByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_organizationId_batchId_fkey" FOREIGN KEY ("organizationId", "batchId") REFERENCES "ImportBatch"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportChange" ADD CONSTRAINT "ImportChange_organizationId_batchId_fkey" FOREIGN KEY ("organizationId", "batchId") REFERENCES "ImportBatch"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportChange" ADD CONSTRAINT "ImportChange_organizationId_batchId_rowId_fkey" FOREIGN KEY ("organizationId", "batchId", "rowId") REFERENCES "ImportRow"("organizationId", "batchId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalReference" ADD CONSTRAINT "ExternalReference_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalReference" ADD CONSTRAINT "ExternalReference_organizationId_createdByImportBatchId_fkey" FOREIGN KEY ("organizationId", "createdByImportBatchId") REFERENCES "ImportBatch"("organizationId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_bounds_check" CHECK (
  "schemaVersion" = 1 AND "revision" > 0 AND "totalRows" BETWEEN 1 AND 1000
  AND "validRows" BETWEEN 0 AND "totalRows" AND "invalidRows" BETWEEN 0 AND "totalRows"
  AND "warningRows" BETWEEN 0 AND "totalRows" AND "appliedRows" BETWEEN 0 AND "totalRows"
  AND "validRows" + "invalidRows" <= "totalRows"
  AND "sourceDigest" ~ '^[a-f0-9]{64}$' AND "namespace" ~ '^[a-z0-9][a-z0-9._-]*$'
  AND "delimiter" IN (',', ';') AND jsonb_typeof("headers") = 'array'
  AND jsonb_typeof("mapping") = 'object' AND jsonb_typeof("options") = 'object'
);
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_shape_check" CHECK (
  "rowNumber" >= 2 AND jsonb_typeof("rawData") = 'object'
  AND jsonb_typeof("errors") = 'array' AND jsonb_typeof("warnings") = 'array'
);
ALTER TABLE "ImportChange" ADD CONSTRAINT "ImportChange_evidence_check" CHECK (
  "afterDigest" ~ '^[a-f0-9]{64}$' AND length("entityId") > 0
  AND (("operation" = 'CREATE' AND "beforeData" IS NULL)
    OR ("operation" = 'UPDATE' AND jsonb_typeof("beforeData") = 'object'))
);
ALTER TABLE "ExternalReference" ADD CONSTRAINT "ExternalReference_identity_check" CHECK (
  "namespace" ~ '^[a-z0-9][a-z0-9._-]*$' AND length(btrim("externalId")) > 0
  AND "externalId" = btrim("externalId") AND length("entityId") > 0
);

-- Keep provenance while its tenant exists; tenant deletion remains an explicit separate lifecycle.
CREATE FUNCTION "guardImportAuditDeletion"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Organization" WHERE "id" = OLD."organizationId") THEN
    RAISE EXCEPTION 'IMPORT_AUDIT_RETAINED';
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER "ImportBatch_retain" BEFORE DELETE ON "ImportBatch" FOR EACH ROW EXECUTE FUNCTION "guardImportAuditDeletion"();
CREATE TRIGGER "ImportRow_retain" BEFORE DELETE ON "ImportRow" FOR EACH ROW EXECUTE FUNCTION "guardImportAuditDeletion"();
CREATE TRIGGER "ImportChange_retain" BEFORE DELETE ON "ImportChange" FOR EACH ROW EXECUTE FUNCTION "guardImportAuditDeletion"();

CREATE FUNCTION "guardImportBatchEvidence"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW."id", NEW."organizationId", NEW."type", NEW."namespace", NEW."schemaVersion", NEW."sourceName", NEW."sourceDigest", NEW."delimiter", NEW."headers", NEW."totalRows", NEW."createdByUserId", NEW."createdAt")
    IS DISTINCT FROM ROW(OLD."id", OLD."organizationId", OLD."type", OLD."namespace", OLD."schemaVersion", OLD."sourceName", OLD."sourceDigest", OLD."delimiter", OLD."headers", OLD."totalRows", OLD."createdByUserId", OLD."createdAt") THEN
    RAISE EXCEPTION 'IMPORT_SOURCE_IMMUTABLE';
  END IF;
  IF OLD."status" IN ('APPLYING', 'APPLIED', 'ROLLED_BACK') AND
    ROW(NEW."mapping", NEW."options", NEW."mappingConfirmedAt") IS DISTINCT FROM ROW(OLD."mapping", OLD."options", OLD."mappingConfirmedAt") THEN
    RAISE EXCEPTION 'IMPORT_MAPPING_FROZEN';
  END IF;
  IF NEW."revision" < OLD."revision" OR NEW."revision" > OLD."revision" + 1 THEN RAISE EXCEPTION 'IMPORT_REVISION_INVALID'; END IF;
  IF NEW."status" <> OLD."status" AND NOT (
    (OLD."status" IN ('UPLOADED', 'FAILED', 'READY') AND NEW."status" IN ('UPLOADED', 'VALIDATING', 'FAILED'))
    OR (OLD."status" = 'VALIDATING' AND NEW."status" IN ('READY', 'FAILED'))
    OR (OLD."status" = 'READY' AND NEW."status" = 'APPLYING')
    OR (OLD."status" = 'APPLYING' AND NEW."status" = 'APPLIED')
    OR (OLD."status" = 'APPLIED' AND NEW."status" = 'ROLLED_BACK')
  ) THEN RAISE EXCEPTION 'IMPORT_STATUS_TRANSITION_INVALID'; END IF;
  IF NEW."status" IN ('READY', 'APPLYING', 'APPLIED', 'ROLLED_BACK') AND NEW."mappingConfirmedAt" IS NULL THEN RAISE EXCEPTION 'IMPORT_MAPPING_REQUIRED'; END IF;
  IF NEW."status" IN ('APPLIED', 'ROLLED_BACK') AND (NEW."appliedAt" IS NULL OR NEW."appliedByUserId" IS NULL) THEN RAISE EXCEPTION 'IMPORT_APPLY_EVIDENCE_REQUIRED'; END IF;
  IF NEW."status" = 'ROLLED_BACK' AND (NEW."rolledBackAt" IS NULL OR NEW."rolledBackByUserId" IS NULL) THEN RAISE EXCEPTION 'IMPORT_ROLLBACK_EVIDENCE_REQUIRED'; END IF;
  IF OLD."status" IN ('APPLIED', 'ROLLED_BACK') AND
    ROW(NEW."appliedAt", NEW."appliedByUserId", NEW."appliedRows", NEW."validRows", NEW."invalidRows", NEW."warningRows", NEW."validatedAt") IS DISTINCT FROM
    ROW(OLD."appliedAt", OLD."appliedByUserId", OLD."appliedRows", OLD."validRows", OLD."invalidRows", OLD."warningRows", OLD."validatedAt") THEN RAISE EXCEPTION 'IMPORT_APPLY_EVIDENCE_IMMUTABLE'; END IF;
  IF OLD."status" = 'ROLLED_BACK' THEN RAISE EXCEPTION 'IMPORT_BATCH_IMMUTABLE'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "ImportBatch_evidence" BEFORE UPDATE ON "ImportBatch" FOR EACH ROW EXECUTE FUNCTION "guardImportBatchEvidence"();

CREATE FUNCTION "guardImportRowEvidence"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW."id", NEW."organizationId", NEW."batchId", NEW."rowNumber", NEW."rawData", NEW."createdAt") IS DISTINCT FROM
    ROW(OLD."id", OLD."organizationId", OLD."batchId", OLD."rowNumber", OLD."rawData", OLD."createdAt") THEN RAISE EXCEPTION 'IMPORT_RAW_IMMUTABLE'; END IF;
  IF EXISTS (SELECT 1 FROM "ImportBatch" WHERE "id" = OLD."batchId" AND "organizationId" = OLD."organizationId" AND "status" IN ('APPLIED', 'ROLLED_BACK')) AND
    ((to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') OR NEW."status" <> 'ROLLED_BACK') THEN
    RAISE EXCEPTION 'IMPORT_ROW_EVIDENCE_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "ImportRow_evidence" BEFORE UPDATE ON "ImportRow" FOR EACH ROW EXECUTE FUNCTION "guardImportRowEvidence"();

CREATE FUNCTION "guardImportChangeEvidence"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - 'rolledBackAt') IS DISTINCT FROM (to_jsonb(OLD) - 'rolledBackAt') OR OLD."rolledBackAt" IS NOT NULL OR NEW."rolledBackAt" IS NULL THEN
    RAISE EXCEPTION 'IMPORT_CHANGE_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "ImportChange_evidence" BEFORE UPDATE ON "ImportChange" FOR EACH ROW EXECUTE FUNCTION "guardImportChangeEvidence"();

-- A polymorphic external reference must still resolve inside its own tenant.
CREATE FUNCTION "guardExternalReferenceTarget"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_table text; target_exists boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'IMPORT_EXTERNAL_REFERENCE_IMMUTABLE'; END IF;
  target_table := CASE NEW."entityType"
    WHEN 'FUNDING_PROGRAMS' THEN 'FundingProgram' WHEN 'FUNDING_CALLS' THEN 'FundingCall'
    WHEN 'COHORTS' THEN 'Cohort' WHEN 'VENTURES' THEN 'Venture'
    WHEN 'VENTURE_ENROLLMENTS' THEN 'VentureEnrollment' WHEN 'FOLLOW_UP_WAVES' THEN 'FollowUpWave'
    WHEN 'OBSERVATIONS' THEN 'VentureObservation' WHEN 'MILESTONES' THEN 'Milestone' END;
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I WHERE "id" = $1 AND "organizationId" = $2 FOR KEY SHARE)', target_table)
    INTO target_exists USING NEW."entityId", NEW."organizationId";
  IF NOT target_exists THEN RAISE EXCEPTION 'IMPORT_EXTERNAL_REFERENCE_SCOPE'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "ExternalReference_target" BEFORE INSERT OR UPDATE ON "ExternalReference" FOR EACH ROW EXECUTE FUNCTION "guardExternalReferenceTarget"();

COMMIT;

