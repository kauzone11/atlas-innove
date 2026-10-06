import { z } from "zod";
import { createFundingProgramSchema } from "@/lib/programs/schemas";
import { createFundingCallSchema } from "@/lib/funding-calls/schemas";
import { createCohortSchema } from "@/lib/cohorts/schemas";
import { createVentureSchema } from "@/lib/ventures/schemas";
import { createFollowUpWaveSchema, followUpWaveStatusSchema } from "@/lib/follow-up/schemas";
import { ImportInputError } from "@/lib/imports/errors";
import type { ImportEntityType } from "@/lib/imports/templates";

export const REFERENCE_TYPES = {
  funding_program: "FUNDING_PROGRAMS", funding_call: "FUNDING_CALLS", cohort: "COHORTS", venture: "VENTURES",
  venture_enrollment: "VENTURE_ENROLLMENTS", follow_up_wave: "FOLLOW_UP_WAVES",
} as const;
export type ReferenceName = keyof typeof REFERENCE_TYPES;
export type ImportReference = { kind: "external" | "internal"; id: string };
export type ImportReferences = Partial<Record<ReferenceName, ImportReference>>;
const identitySchema = z.string().trim().min(1).max(160);
const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(64);
const integerText = (value: string | undefined, field: string, required = false) => {
  const text = value?.trim();
  if (!text) { if (required) throw new ImportInputError("IMPORT_FIELD_REQUIRED", undefined, field); return null; }
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text)) || Number(text) > 2147483647) throw new ImportInputError("IMPORT_INTEGER_INVALID", undefined, field);
  return Number(text);
};
const optional = (value?: string) => value?.trim() || null;

export function parseImportDate(value: string | undefined, field: string, required = false): Date | null {
  const text = value?.trim();
  if (!text) { if (required) throw new ImportInputError("IMPORT_FIELD_REQUIRED", undefined, field); return null; }
  const result = new Date(`${text}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(result.getTime()) || result.toISOString().slice(0, 10) !== text || Number(text.slice(0, 4)) < 1900) throw new ImportInputError("IMPORT_DATE_INVALID", undefined, field);
  return result;
}

export function parseImportTimestamp(value: string | undefined, field: string, required = false): Date | null {
  const text = value?.trim();
  if (!text) { if (required) throw new ImportInputError("IMPORT_FIELD_REQUIRED", undefined, field); return null; }
  const match = text.match(/^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,3})?(Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/);
  let validDate = false;
  if (match) { try { validDate = Boolean(parseImportDate(match[1], field)); } catch { validDate = false; } }
  const result = new Date(text);
  if (!match || !validDate || !Number.isFinite(result.getTime()) || /[+-]14:(?!00)/.test(text)) throw new ImportInputError("IMPORT_TIMESTAMP_INVALID", undefined, field);
  return result;
}

function references(raw: Record<string, string>): ImportReferences {
  const result: ImportReferences = {};
  for (const name of Object.keys(REFERENCE_TYPES) as ReferenceName[]) {
    const external = optional(raw[`${name}_external_id`]); const internal = optional(raw[`${name}_id`]);
    if (external && internal) throw new ImportInputError("IMPORT_REFERENCE_AMBIGUOUS", undefined, name);
    if (external || internal) result[name] = { kind: external ? "external" : "internal", id: identitySchema.parse(external ?? internal) };
  }
  return result;
}

export function normalizeImportRow(type: ImportEntityType, raw: Record<string, string>) {
  const externalId = identitySchema.parse(raw.external_id);
  const refs = references(raw);
  switch (type) {
    case "FUNDING_PROGRAMS": return { type, externalId, refs, data: createFundingProgramSchema.parse({ name: raw.name, slug: raw.slug, code: optional(raw.code), description: optional(raw.description), status: optional(raw.status) ?? undefined }) };
    case "FUNDING_CALLS": {
      const data = createFundingCallSchema.parse({ title: raw.title, callNumber: raw.call_number, shortTitle: optional(raw.short_title), objective: optional(raw.objective), status: optional(raw.status) ?? undefined,
        applicationsEnabled: false, publishedAt: parseImportTimestamp(raw.published_at, "published_at"), applicationStartsAt: parseImportTimestamp(raw.application_starts_at, "application_starts_at"), applicationEndsAt: parseImportTimestamp(raw.application_ends_at, "application_ends_at"),
        totalBudget: optional(raw.total_budget), maximumSupport: optional(raw.maximum_support), targetProjects: integerText(raw.target_projects, "target_projects"), executionMonths: integerText(raw.execution_months, "execution_months"), sourceUrl: optional(raw.source_url),
      });
      const resultsPublishedAt = parseImportTimestamp(raw.results_published_at, "results_published_at");
      if (data.status === "RESULT_PUBLISHED" && !resultsPublishedAt) throw new ImportInputError("IMPORT_RESULTS_DATE_REQUIRED", undefined, "results_published_at");
      if (resultsPublishedAt && data.publishedAt && resultsPublishedAt < data.publishedAt) throw new ImportInputError("IMPORT_DATE_ORDER", undefined, "results_published_at");
      return { type, externalId, refs, data: { ...data, publicListingEnabled: false, resultsPublishedAt } };
    }
    case "COHORTS": return { type, externalId, refs, data: createCohortSchema.parse({ name: raw.name, code: optional(raw.code), referenceYear: integerText(raw.reference_year, "reference_year"), startsAt: parseImportDate(raw.starts_at, "starts_at"), endsAt: parseImportDate(raw.ends_at, "ends_at"), status: optional(raw.status) ?? undefined, trackingProtocolVersionId: optional(raw.tracking_protocol_version_id) }) };
    case "VENTURES": {
      const data = createVentureSchema.parse({ name: raw.name, legalName: optional(raw.legal_name), kind: raw.kind, externalReference: optional(raw.external_reference) });
      const slug = optional(raw.slug);
      return { type, externalId, refs, data: { ...data, slug: slug ? slugSchema.parse(slug) : null, archivedAt: parseImportTimestamp(raw.archived_at, "archived_at") } };
    }
    case "VENTURE_ENROLLMENTS": {
      const enrolledAt = parseImportTimestamp(raw.enrolled_at, "enrolled_at", true)!;
      const withdrawnAt = parseImportTimestamp(raw.withdrawn_at, "withdrawn_at");
      const status = z.enum(["ACTIVE", "WITHDRAWN"]).parse(optional(raw.status) ?? (withdrawnAt ? "WITHDRAWN" : "ACTIVE"));
      if (status === "WITHDRAWN" && !withdrawnAt) throw new ImportInputError("IMPORT_WITHDRAWAL_REQUIRED", undefined, "withdrawn_at");
      if (status === "ACTIVE" && withdrawnAt) throw new ImportInputError("IMPORT_WITHDRAWAL_CONFLICT", undefined, "withdrawn_at");
      if (withdrawnAt && withdrawnAt < enrolledAt) throw new ImportInputError("IMPORT_DATE_ORDER", undefined, "withdrawn_at");
      return { type, externalId, refs, data: { enrolledAt, withdrawnAt, status, externalReference: z.string().max(120).nullable().parse(optional(raw.external_reference)) } };
    }
    case "FOLLOW_UP_WAVES": {
      const data = createFollowUpWaveSchema.parse({ name: raw.name, kind: raw.kind, sequence: integerText(raw.sequence, "sequence", true), offsetMonths: integerText(raw.offset_months, "offset_months"), scheduledFor: parseImportDate(raw.scheduled_for, "scheduled_for", true), opensAt: parseImportTimestamp(raw.opens_at, "opens_at"), closesAt: parseImportTimestamp(raw.closes_at, "closes_at") });
      if (data.kind === "BASELINE" && data.sequence !== 0) throw new ImportInputError("BASELINE_SEQUENCE_INVALID", undefined, "sequence");
      if (data.kind === "FOLLOW_UP" && data.sequence === 0) throw new ImportInputError("FOLLOW_UP_SEQUENCE_INVALID", undefined, "sequence");
      return { type, externalId, refs, data: { ...data, status: followUpWaveStatusSchema.parse(optional(raw.status) ?? "PLANNED") } };
    }
    case "OBSERVATIONS": {
      const missingText = optional(raw.missing) ?? "false";
      if (!["true", "false"].includes(missingText)) throw new ImportInputError("IMPORT_BOOLEAN_INVALID", undefined, "missing");
      const value = raw.value?.trim() ?? ""; const missing = missingText === "true";
      if (missing && value) throw new ImportInputError("IMPORT_MISSING_CONFLICT", undefined, "value");
      const status = z.enum(["PENDING", "IN_PROGRESS", "SUBMITTED", "MISSED"]).parse(raw.status);
      const submittedAt = parseImportTimestamp(raw.submitted_at, "submitted_at", status === "SUBMITTED");
      const startedAt = parseImportTimestamp(raw.started_at, "started_at");
      if (status !== "SUBMITTED" && submittedAt) throw new ImportInputError("IMPORT_SUBMISSION_CONFLICT", undefined, "submitted_at");
      if (startedAt && submittedAt && startedAt > submittedAt) throw new ImportInputError("IMPORT_DATE_ORDER", undefined, "submitted_at");
      if (["PENDING", "MISSED"].includes(status) && value) throw new ImportInputError("IMPORT_STATUS_VALUE_CONFLICT", undefined, "value");
      const waveOffsetMonths = integerText(raw.wave_offset_months, "wave_offset_months");
      if (refs.follow_up_wave && waveOffsetMonths !== null) throw new ImportInputError("IMPORT_REFERENCE_AMBIGUOUS", undefined, "follow_up_wave");
      return { type, externalId, refs, data: { indicatorKey: z.string().trim().min(1).max(80).parse(raw.indicator_key), value: missing ? "" : value, missing, status, startedAt, submittedAt, waveOffsetMonths } };
    }
    case "MILESTONES": return { type, externalId, refs, data: {
      type: z.enum(["MVP_LAUNCHED", "FIRST_CUSTOMER", "COMPANY_FORMALIZED", "RECURRING_CONTRACT", "ADDITIONAL_INVESTMENT", "TEAM_EXPANSION", "PIVOT", "CLOSED"]).parse(raw.type),
      title: z.string().trim().min(2).max(160).parse(raw.title), description: z.string().max(3000).nullable().parse(optional(raw.description)), occurredAt: parseImportTimestamp(raw.occurred_at, "occurred_at", true)!,
    } };
  }
}
export type NormalizedImportRow = ReturnType<typeof normalizeImportRow>;
