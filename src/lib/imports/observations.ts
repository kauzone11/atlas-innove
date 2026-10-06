import type { Prisma } from "@prisma/client";
import { DomainConflictError } from "@/lib/errors";
import { enumOptions } from "@/lib/tracking-protocols/service";
import { isEnrollmentEligibleAt, validateObservationValues, type ValidatedObservationValue } from "@/lib/observations/validation";
import type { ImportEntityModels } from "@/lib/imports/entities";
import type { NormalizedImportRow } from "@/lib/imports/normalization";
import type { ImportReferenceContext, ResolvedImportInput } from "@/lib/imports/references";
import type { EvaluatedImportRow } from "@/lib/imports/validation";
import { ImportInputError } from "@/lib/imports/errors";

type ObservationInput = Extract<NormalizedImportRow, { type: "OBSERVATIONS" }>;
type ObservationRow = EvaluatedImportRow & { resolved: ResolvedImportInput & { input: ObservationInput } };
export type PreparedObservationGroup = {
  rows: ObservationRow[]; externalId: string; cohortId: string; ventureEnrollmentId: string; followUpWaveId: string;
  existing?: ImportEntityModels["OBSERVATIONS"]; data: ObservationInput["data"]; values: ValidatedObservationValue[];
};

export function prepareObservationGroups(rows: EvaluatedImportRow[], context: ImportReferenceContext): PreparedObservationGroup[] {
  const observationRows = rows.filter((item): item is ObservationRow => item.resolved?.input.type === "OBSERVATIONS");
  const byExternalId = new Map<string, ObservationRow[]>();
  const byPair = new Map<string, ObservationRow[]>();
  const fail = (group: ObservationRow[], code: string, field?: string) => { for (const item of group) item.errors.push({ code, ...(field ? { field } : {}) }); };
  for (const item of observationRows) {
    const externalId = item.resolved.input.externalId;
    const group = byExternalId.get(externalId) ?? []; group.push(item); byExternalId.set(externalId, group);
    const key = JSON.stringify([item.resolved.refs.venture_enrollment, item.resolved.refs.follow_up_wave]);
    const pair = byPair.get(key) ?? []; pair.push(item); byPair.set(key, pair);
  }
  for (const group of byPair.values()) if (new Set(group.map((item) => item.resolved.input.externalId)).size > 1) fail(group, "IMPORT_OBSERVATION_MULTIPLE_IDENTITIES", "external_id");
  const prepared: PreparedObservationGroup[] = [];
  for (const [externalId, group] of byExternalId) {
    const first = group[0].resolved; const data = first.input.data;
    const identity = JSON.stringify([first.refs.venture_enrollment, first.refs.follow_up_wave, data.status, data.startedAt, data.submittedAt]);
    if (group.some(({ resolved }) => JSON.stringify([resolved.refs.venture_enrollment, resolved.refs.follow_up_wave, resolved.input.data.status, resolved.input.data.startedAt, resolved.input.data.submittedAt]) !== identity)) fail(group, "IMPORT_OBSERVATION_GROUP_CONFLICT");
    if (group.some((item) => item.errors.length)) continue;
    const enrollment = context.state.VENTURE_ENROLLMENTS.get(first.refs.venture_enrollment!)!;
    const wave = context.state.FOLLOW_UP_WAVES.get(first.refs.follow_up_wave!)!;
    if (enrollment.cohortId !== wave.cohortId) { fail(group, "COHORT_SCOPE_MISMATCH"); continue; }
    if (first.refs.cohort && first.refs.cohort !== enrollment.cohortId || first.refs.venture && first.refs.venture !== enrollment.ventureId) { fail(group, "IMPORT_REFERENCE_AMBIGUOUS"); continue; }
    const cohort = context.state.COHORTS.get(enrollment.cohortId);
    const version = cohort?.trackingProtocolVersionId ? context.versions.get(cohort.trackingProtocolVersionId) : null;
    if (!version?.indicators.length) { fail(group, "OBSERVATION_PROTOCOL_MISSING"); continue; }
    if (!isEnrollmentEligibleAt(enrollment, wave.scheduledFor ?? wave.opensAt ?? wave.createdAt, Boolean(wave.scheduledFor))) { fail(group, "OBSERVATION_ENROLLMENT_NOT_ELIGIBLE"); continue; }
    if (data.submittedAt && data.submittedAt < enrollment.enrolledAt || data.startedAt && data.startedAt < enrollment.enrolledAt) { fail(group, "IMPORT_DATE_ORDER", "submitted_at"); continue; }
    const current = [...context.state.OBSERVATIONS.values()].find((record) => record.ventureEnrollmentId === enrollment.id && record.followUpWaveId === wave.id);
    if (current && (current.status !== "PENDING" || current.revision !== 0 || current.values.length || current.startedAt || current.submittedAt)) { fail(group, "IMPORT_OBSERVATION_HISTORY_EXISTS"); continue; }
    const indicators = version.indicators.map((indicator) => ({ ...indicator, allowedValues: enumOptions(indicator.allowedValues) }));
    const byKey = new Map(indicators.map((indicator) => [indicator.key, indicator]));
    const seen = new Set<string>(); const values: ValidatedObservationValue[] = [];
    for (const item of group) {
      const { indicatorKey, value } = item.resolved.input.data;
      const definition = byKey.get(indicatorKey);
      if (!definition) { item.errors.push({ code: "IMPORT_INDICATOR_NOT_FOUND", field: "indicator_key" }); continue; }
      if (seen.has(indicatorKey)) { fail(group, "OBSERVATION_INDICATOR_DUPLICATE", "indicator_key"); continue; }
      seen.add(indicatorKey);
      try { values.push(...validateObservationValues(indicators, [{ indicatorDefinitionId: definition.id, value }])); }
      catch (error) { if (error instanceof DomainConflictError) item.errors.push({ code: error.code, field: "value" }); else throw error; }
      if (!value) item.warnings.push({ code: "IMPORT_VALUE_MISSING", field: "value" });
    }
    if (data.status === "SUBMITTED" && !values.length) fail(group, "OBSERVATION_SUBMISSION_EMPTY", "value");
    if (group.some((item) => item.errors.length)) continue;
    for (const item of group) {
      if (current) { item.operation = "UPDATE"; item.resolved.existingId = current.id; item.warnings.push({ code: "IMPORT_PENDING_PLACEHOLDER" }); }
    }
    prepared.push({ rows: group, externalId, cohortId: enrollment.cohortId, ventureEnrollmentId: enrollment.id, followUpWaveId: wave.id, existing: current, data, values });
  }
  return prepared;
}

export async function writeObservationGroup(client: Prisma.TransactionClient, organizationId: string, group: PreparedObservationGroup) {
  const data = { status: group.data.status, startedAt: group.data.startedAt, submittedAt: group.data.submittedAt, revision: 1 };
  let id: string;
  if (group.existing) {
    const updated = await client.ventureObservation.updateMany({ where: { organizationId, id: group.existing.id, revision: 0, status: "PENDING", startedAt: null, submittedAt: null, values: { none: {} } }, data });
    if (updated.count !== 1) throw new ImportInputError("IMPORT_OBSERVATION_HISTORY_EXISTS");
    id = group.existing.id;
  } else {
    const created = await client.ventureObservation.create({ data: { organizationId, cohortId: group.cohortId, ventureEnrollmentId: group.ventureEnrollmentId, followUpWaveId: group.followUpWaveId, ...data } });
    id = created.id;
  }
  if (group.values.length) await client.observationValue.createMany({ data: group.values.map((value) => ({ organizationId, observationId: id, ...value })) });
  return id;
}
