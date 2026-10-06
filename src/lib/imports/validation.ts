import { Prisma, type ImportBatch, type ImportRow } from "@prisma/client";
import { ZodError } from "zod";
import { DomainConflictError } from "@/lib/errors";
import { ImportInputError } from "@/lib/imports/errors";
import { importJson } from "@/lib/imports/digest";
import { IMPORT_LIMITS } from "@/lib/imports/limits";
import { MAX_IMPORT_ENTITIES } from "@/lib/imports/entities";
import { mapImportRow, type ImportMapping } from "@/lib/imports/mapping";
import { normalizeImportRow, REFERENCE_TYPES, type ReferenceName } from "@/lib/imports/normalization";
import { resolveImportReferences, type ImportReferenceContext, type ResolvedImportInput } from "@/lib/imports/references";
import { importOptionsSchema } from "@/lib/imports/schemas";
import { IMPORT_TEMPLATES } from "@/lib/imports/templates";
import { lockImportBatch, withImportTransaction } from "@/lib/imports/transaction";
import { isEnrollmentEligibleAt } from "@/lib/observations/validation";

export type ImportIssue = { code: string; field?: string };
export type EvaluatedImportRow = { row: ImportRow; resolved?: ResolvedImportInput; errors: ImportIssue[]; warnings: ImportIssue[]; operation: "CREATE" | "UPDATE" };

function issues(error: unknown): ImportIssue[] {
  if (error instanceof ZodError) return error.issues.map((issue) => ({ code: "IMPORT_FIELD_INVALID", field: issue.path.join(".").replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`) }));
  if (error instanceof ImportInputError) return [{ code: error.code, ...(error.field ? { field: error.field } : {}) }];
  if (error instanceof DomainConflictError) return [{ code: error.code }];
  throw error;
}

export async function evaluateImportBatch(client: Prisma.TransactionClient, batch: ImportBatch, lock = false) {
  if (!batch.mappingConfirmedAt) throw new ImportInputError("IMPORT_MAPPING_REQUIRED");
  const stored = await client.importRow.findMany({ where: { organizationId: batch.organizationId, batchId: batch.id }, orderBy: { rowNumber: "asc" } });
  if (stored.length !== batch.totalRows) throw new ImportInputError("IMPORT_SOURCE_INCOMPLETE");
  const rows: EvaluatedImportRow[] = stored.map((row) => ({ row, errors: [], warnings: [], operation: "CREATE" }));
  const normalized = [];
  for (const item of rows) {
    try { normalized.push({ rowId: item.row.id, rowNumber: item.row.rowNumber, input: normalizeImportRow(batch.type, mapImportRow(item.row.rawData as Record<string, string>, batch.mapping as ImportMapping)) }); }
    catch (error) { item.errors.push(...issues(error)); }
  }
  const context = await resolveImportReferences(client, batch, normalized, lock);
  const byId = new Map(rows.map((row) => [row.row.id, row]));
  const seen = new Map<string, EvaluatedImportRow[]>();
  let generatedCount = 0;
  for (const resolved of context.resolved) {
    const item = byId.get(resolved.rowId)!; item.resolved = resolved;
    try {
      validateResolvedRow(batch, item, context);
      generatedCount += placeholderCount(resolved, context);
    } catch (error) { item.errors.push(...issues(error)); }
    const keys = [`external:${resolved.input.externalId}`, naturalKey(resolved)];
    for (const key of keys.filter((key): key is string => Boolean(key))) {
      const same = seen.get(key) ?? []; same.push(item); seen.set(key, same);
    }
  }
  for (const [key, duplicates] of seen) {
    if (duplicates.length > 1 && batch.type !== "OBSERVATIONS") for (const item of duplicates) item.errors.push({ code: "IMPORT_DUPLICATE_ROW", field: key.startsWith("external:") ? "external_id" : undefined });
  }
  if (generatedCount + rows.length > MAX_IMPORT_ENTITIES) throw new ImportInputError("IMPORT_ENTITY_LIMIT");
  return { rows, context };
}

function validateResolvedRow(batch: ImportBatch, item: EvaluatedImportRow, context: ImportReferenceContext) {
  const { input, refs, existingId } = item.resolved!; const { state, versions } = context;
  const mode = importOptionsSchema.parse(batch.options).mode;
  for (const name of IMPORT_TEMPLATES[input.type].requiredReferences as ReferenceName[]) {
    if (!input.refs[name] || !refs[name]) throw new ImportInputError("IMPORT_REFERENCE_REQUIRED", undefined, name);
  }
  for (const [name, ref] of Object.entries(input.refs)) {
    if (ref && (!refs[name as ReferenceName] || !state[REFERENCE_TYPES[name as ReferenceName]].has(refs[name as ReferenceName]!))) throw new ImportInputError("IMPORT_REFERENCE_NOT_FOUND", undefined, name);
  }
  if (existingId) {
    if (!state[input.type].has(existingId)) throw new ImportInputError("IMPORT_EXTERNAL_REFERENCE_STALE", undefined, "external_id");
    if (mode !== "UPSERT") throw new ImportInputError("IMPORT_ALREADY_IMPORTED", undefined, "external_id");
    item.operation = "UPDATE";
  }
  const conflict = (id: string | undefined) => { if (id && id !== existingId) throw new ImportInputError("IMPORT_IDENTITY_CONFLICT"); };
  switch (input.type) {
    case "FUNDING_PROGRAMS": {
      conflict([...state.FUNDING_PROGRAMS.values()].find((record) => record.slug === input.data.slug)?.id);
      const current = existingId ? state.FUNDING_PROGRAMS.get(existingId) : null;
      if (current && current.slug !== input.data.slug) throw new ImportInputError("IMPORT_UPSERT_IDENTITY", undefined, "slug");
      if (current && (batch.mapping as ImportMapping).status && current.status !== input.data.status) throw new ImportInputError("IMPORT_UPSERT_LIFECYCLE", undefined, "status");
      break;
    }
    case "FUNDING_CALLS":
      conflict([...state.FUNDING_CALLS.values()].find((record) => record.callNumber === input.data.callNumber)?.id);
      item.warnings.push({ code: "IMPORT_CALL_PRIVATE" }); break;
    case "COHORTS": {
      const call = refs.funding_call ? state.FUNDING_CALLS.get(refs.funding_call) : null;
      if (call && call.fundingProgramId !== refs.funding_program) throw new ImportInputError("FUNDING_CALL_PROGRAM_MISMATCH", undefined, "funding_call");
      if (input.data.trackingProtocolVersionId) {
        const version = versions.get(input.data.trackingProtocolVersionId);
        if (!version) throw new ImportInputError("IMPORT_REFERENCE_NOT_FOUND", undefined, "tracking_protocol_version_id");
        if (!version.indicators.length) throw new ImportInputError("PROTOCOL_HAS_NO_INDICATORS", undefined, "tracking_protocol_version_id");
      } else item.warnings.push({ code: "IMPORT_COHORT_WITHOUT_PROTOCOL" });
      if (input.data.code) conflict([...state.COHORTS.values()].find((record) => record.fundingProgramId === refs.funding_program && record.code === input.data.code)?.id);
      break;
    }
    case "VENTURES": {
      if (input.data.slug) conflict([...state.VENTURES.values()].find((record) => record.slug === input.data.slug)?.id);
      const current = existingId ? state.VENTURES.get(existingId) : null;
      if (current && ((batch.mapping as ImportMapping).slug && current.slug !== input.data.slug || current.kind !== input.data.kind)) throw new ImportInputError("IMPORT_UPSERT_IDENTITY", undefined, "kind");
      if (current && ((batch.mapping as ImportMapping).archived_at && current.archivedAt?.getTime() !== input.data.archivedAt?.getTime())) throw new ImportInputError("IMPORT_UPSERT_LIFECYCLE", undefined, "archived_at");
      break;
    }
    case "VENTURE_ENROLLMENTS":
      conflict([...state.VENTURE_ENROLLMENTS.values()].find((record) => record.cohortId === refs.cohort && record.ventureId === refs.venture)?.id); break;
    case "FOLLOW_UP_WAVES": {
      const cohort = state.COHORTS.get(refs.cohort!)!;
      if (!cohort.trackingProtocolVersionId) throw new ImportInputError("COHORT_PROTOCOL_REQUIRED", undefined, "cohort");
      const version = versions.get(cohort.trackingProtocolVersionId);
      if (!version || !version.indicators.length) throw new ImportInputError("PROTOCOL_HAS_NO_INDICATORS", undefined, "cohort");
      conflict([...state.FOLLOW_UP_WAVES.values()].find((record) => record.cohortId === refs.cohort && record.sequence === input.data.sequence)?.id);
      if (input.data.offsetMonths == null) item.warnings.push({ code: "IMPORT_WAVE_WITHOUT_OFFSET", field: "offset_months" });
      else if ([...state.FOLLOW_UP_WAVES.values()].some((record) => record.cohortId === refs.cohort && record.offsetMonths === input.data.offsetMonths)) throw new ImportInputError("IMPORT_OFFSET_AMBIGUOUS", undefined, "offset_months");
      break;
    }
    case "OBSERVATIONS": throw new ImportInputError("IMPORT_OBSERVATION_VALIDATION_REQUIRED");
    case "MILESTONES": conflict([...state.MILESTONES.values()].find((record) => record.ventureId === refs.venture && record.title === input.data.title && record.occurredAt.getTime() === input.data.occurredAt.getTime())?.id); break;
  }
}

function naturalKey({ input, refs }: ResolvedImportInput): string | null {
  switch (input.type) {
    case "FUNDING_PROGRAMS": return JSON.stringify([input.type, input.data.slug]);
    case "FUNDING_CALLS": return JSON.stringify([input.type, input.data.callNumber]);
    case "COHORTS": return input.data.code ? JSON.stringify([input.type, refs.funding_program, input.data.code]) : null;
    case "VENTURES": return input.data.slug ? JSON.stringify([input.type, input.data.slug]) : null;
    case "VENTURE_ENROLLMENTS": return JSON.stringify([input.type, refs.cohort, refs.venture]);
    case "FOLLOW_UP_WAVES": return JSON.stringify([input.type, refs.cohort, input.data.sequence]);
    case "OBSERVATIONS": return JSON.stringify([input.type, refs.venture_enrollment, refs.follow_up_wave]);
    case "MILESTONES": return JSON.stringify([input.type, refs.venture, input.data.occurredAt.toISOString(), input.data.title]);
  }
}

function placeholderCount({ input, refs }: ResolvedImportInput, context: ImportReferenceContext) {
  if (input.type === "FOLLOW_UP_WAVES") return [...context.state.VENTURE_ENROLLMENTS.values()].filter((enrollment) => enrollment.cohortId === refs.cohort && isEnrollmentEligibleAt(enrollment, input.data.scheduledFor!, true)).length;
  if (input.type === "VENTURE_ENROLLMENTS") return [...context.state.FOLLOW_UP_WAVES.values()].filter((wave) => wave.cohortId === refs.cohort && isEnrollmentEligibleAt(input.data, wave.scheduledFor ?? wave.opensAt ?? wave.createdAt, Boolean(wave.scheduledFor))).length;
  return 0;
}

export async function persistImportEvaluation(client: Prisma.TransactionClient, batch: ImportBatch, evaluation: Awaited<ReturnType<typeof evaluateImportBatch>>) {
  for (let offset = 0; offset < evaluation.rows.length; offset += IMPORT_LIMITS.writeChunkSize) {
    const values = evaluation.rows.slice(offset, offset + IMPORT_LIMITS.writeChunkSize).map((item) => Prisma.sql`(
      ${item.row.id}, ${item.errors.length ? "INVALID" : "VALID"}::"ImportRowStatus", ${JSON.stringify(item.errors)}::jsonb, ${JSON.stringify(item.warnings)}::jsonb,
      ${item.resolved ? JSON.stringify(importJson({ ...item.resolved.input, operation: item.operation })) : null}::jsonb,
      ${item.resolved ? JSON.stringify({ refs: item.resolved.refs, existingId: item.resolved.existingId ?? null, contextDigest: evaluation.context.contextDigest }) : null}::jsonb
    )`);
    await client.$executeRaw(Prisma.sql`UPDATE "ImportRow" r SET "status" = v.status, "errors" = v.errors, "warnings" = v.warnings, "normalizedData" = v.normalized, "resolvedReferences" = v.refs
      FROM (VALUES ${Prisma.join(values)}) AS v(id, status, errors, warnings, normalized, refs)
      WHERE r."id" = v.id AND r."organizationId" = ${batch.organizationId} AND r."batchId" = ${batch.id}`);
  }
  const invalidRows = evaluation.rows.filter((row) => row.errors.length).length;
  return client.importBatch.update({ where: { id: batch.id, organizationId: batch.organizationId }, data: { status: invalidRows ? "FAILED" : "READY", revision: { increment: 1 }, validatedAt: new Date(),
    validRows: evaluation.rows.length - invalidRows, invalidRows, warningRows: evaluation.rows.filter((row) => row.warnings.length).length,
    failedAt: invalidRows ? new Date() : null, failureCode: invalidRows ? "IMPORT_VALIDATION_FAILED" : null,
  } });
}

export async function validateImportBatch(userId: string, organizationId: string, batchId: string, expectedRevision: number) {
  return withImportTransaction(userId, organizationId, async (client) => {
    const batch = await lockImportBatch(client, organizationId, batchId, expectedRevision);
    if (!["UPLOADED", "READY", "FAILED"].includes(batch.status)) throw new ImportInputError("IMPORT_BATCH_IMMUTABLE");
    await client.importBatch.update({ where: { id: batchId, organizationId }, data: { status: "VALIDATING" } });
    return persistImportEvaluation(client, batch, await evaluateImportBatch(client, batch, true));
  });
}
