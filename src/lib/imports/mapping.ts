import { ImportInputError } from "@/lib/imports/errors";
import { IMPORT_TEMPLATES, type ImportEntityType } from "@/lib/imports/templates";

export type ImportMapping = Record<string, string>;

export function proposeImportMapping(type: ImportEntityType, headers: string[]): ImportMapping {
  return Object.fromEntries(IMPORT_TEMPLATES[type].fields.filter((field) => headers.includes(field.key)).map((field) => [field.key, field.key]));
}

export function validateImportMapping(type: ImportEntityType, headers: string[], mapping: ImportMapping) {
  const template = IMPORT_TEMPLATES[type];
  const fields = new Set(template.fields.map((field) => field.key));
  const used = new Set<string>();
  for (const [field, header] of Object.entries(mapping)) {
    if (!fields.has(field)) throw new ImportInputError("IMPORT_MAPPING_FIELD", undefined, field);
    if (!headers.includes(header)) throw new ImportInputError("IMPORT_MAPPING_HEADER", undefined, field);
    if (used.has(header)) throw new ImportInputError("IMPORT_MAPPING_DUPLICATE", undefined, field);
    used.add(header);
  }
  for (const field of template.fields) {
    if (field.required && !mapping[field.key]) throw new ImportInputError("IMPORT_MAPPING_REQUIRED", undefined, field.key);
  }
  for (const field of template.fields.filter((item) => item.key.endsWith("_external_id"))) {
    const name = field.key.replace(/_external_id$/, "");
    if (mapping[field.key] && mapping[`${name}_id`]) throw new ImportInputError("IMPORT_MAPPING_AMBIGUOUS_REFERENCE", undefined, name);
  }
  for (const name of template.requiredReferences) {
    if (!mapping[`${name}_external_id`] && !mapping[`${name}_id`]) throw new ImportInputError("IMPORT_MAPPING_REFERENCE", undefined, name);
  }
  return { mapping: { ...mapping }, ignoredHeaders: headers.filter((header) => !used.has(header)) };
}

export function mapImportRow(raw: Record<string, string>, mapping: ImportMapping): Record<string, string> {
  return Object.fromEntries(Object.entries(mapping).map(([field, header]) => [field, raw[header] ?? ""]));
}
