import assert from "node:assert/strict";
import test from "node:test";
import { normalizeImportRow, parseImportDate, parseImportTimestamp } from "@/lib/imports/normalization";

test("historical dates reject rollover, ambiguous formats and absent timezone", () => {
  assert.equal(parseImportDate("2024-02-29", "date")?.toISOString(), "2024-02-29T00:00:00.000Z");
  for (const value of ["2023-02-29", "2024-02-30", "2024-13-01", "01/02/2024", "2024-1-2"]) assert.throws(() => parseImportDate(value, "date"), /IMPORT_DATE_INVALID/);
  assert.equal(parseImportTimestamp("2024-03-01T09:00:00-03:00", "date")?.toISOString(), "2024-03-01T12:00:00.000Z");
  for (const value of ["2024-02-30T00:00:00Z", "2024-01-01", "2024-01-01T00:00:00", "2024-01-01T24:00:00Z", "2024-01-01T00:00:00+25:00"]) assert.throws(() => parseImportTimestamp(value, "date"), /IMPORT_TIMESTAMP_INVALID/);
});

test("normalization retains precision and distinguishes missing from zero without inventing history", () => {
  const call = normalizeImportRow("FUNDING_CALLS", { external_id: "call-1", funding_program_external_id: "program-1", title: "Historical call", call_number: "01/2024", total_budget: "999999999999.99", maximum_support: "0" });
  assert.equal(call.type, "FUNDING_CALLS"); if (call.type !== "FUNDING_CALLS") return;
  assert.equal(call.data.totalBudget, "999999999999.99"); assert.equal(call.data.maximumSupport, "0"); assert.equal(call.data.publishedAt, null);
  assert.equal(call.data.applicationsEnabled, false); assert.equal(call.data.publicListingEnabled, false);
  const observation = normalizeImportRow("OBSERVATIONS", { external_id: "o1", venture_enrollment_external_id: "e1", follow_up_wave_external_id: "w1", indicator_key: "revenue", value: "0", missing: "false", status: "SUBMITTED", submitted_at: "2024-01-01T10:00:00Z" });
  assert.equal(observation.type, "OBSERVATIONS"); if (observation.type !== "OBSERVATIONS") return;
  assert.equal(observation.data.value, "0"); assert.equal(observation.data.missing, false);
  assert.throws(() => normalizeImportRow("OBSERVATIONS", { external_id: "o1", indicator_key: "revenue", value: "0", missing: "true", status: "SUBMITTED" }), /IMPORT_MISSING_CONFLICT/);
  assert.throws(() => normalizeImportRow("VENTURE_ENROLLMENTS", { external_id: "e1", enrolled_at: "2024-01-01T00:00:00Z", status: "WITHDRAWN" }), /IMPORT_WITHDRAWAL_REQUIRED/);
  assert.throws(() => normalizeImportRow("FOLLOW_UP_WAVES", { external_id: "w1", name: "Wave", kind: "BASELINE", sequence: "1", scheduled_for: "2024-01-01" }), /BASELINE_SEQUENCE_INVALID/);
});
