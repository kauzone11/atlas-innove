import assert from "node:assert/strict";
import test from "node:test";
import { proposeImportMapping, validateImportMapping } from "@/lib/imports/mapping";
import { IMPORT_TEMPLATES, importTemplateCsv } from "@/lib/imports/templates";

test("all eight versioned templates expose durable identity and explicitly reviewed fields", () => {
  assert.equal(Object.keys(IMPORT_TEMPLATES).length, 8);
  for (const [type, template] of Object.entries(IMPORT_TEMPLATES)) {
    assert.equal(template.fields[0].key, "external_id");
    assert.equal(new Set(template.fields.map((field) => field.key)).size, template.fields.length);
    assert.equal(importTemplateCsv(type as keyof typeof IMPORT_TEMPLATES), `${template.fields.map((field) => field.key).join(",")}\r\n`);
  }
  const proposed = proposeImportMapping("VENTURES", ["external_id", "name", "kind", "unknown", "Name"]);
  assert.deepEqual(proposed, { external_id: "external_id", name: "name", kind: "kind" });
  const reviewed = validateImportMapping("VENTURES", ["external_id", "name", "kind", "unknown"], proposed);
  assert.deepEqual(reviewed.ignoredHeaders, ["unknown"]);
});

test("mapping refuses ambiguous, missing, unknown and duplicate assignments", () => {
  const headers = ["id", "title", "kind", "program"];
  assert.throws(() => validateImportMapping("VENTURES", headers, { external_id: "id", name: "title" }), /IMPORT_MAPPING_REQUIRED/);
  assert.throws(() => validateImportMapping("VENTURES", headers, { external_id: "id", name: "title", kind: "kind", revenue: "program" }), /IMPORT_MAPPING_FIELD/);
  assert.throws(() => validateImportMapping("VENTURES", headers, { external_id: "id", name: "id", kind: "kind" }), /IMPORT_MAPPING_DUPLICATE/);
  assert.throws(() => validateImportMapping("VENTURES", headers, { external_id: "id", name: "absent", kind: "kind" }), /IMPORT_MAPPING_HEADER/);
  assert.throws(() => validateImportMapping("COHORTS", headers, { external_id: "id", name: "title" }), /IMPORT_MAPPING_REFERENCE/);
  assert.doesNotThrow(() => validateImportMapping("COHORTS", headers, { external_id: "id", name: "title", funding_program_external_id: "program" }));
  assert.throws(() => validateImportMapping("COHORTS", headers, { external_id: "id", name: "title", funding_program_external_id: "program", funding_program_id: "kind" }), /IMPORT_MAPPING_AMBIGUOUS_REFERENCE/);
});
