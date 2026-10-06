import type { ImportMapping } from "@/lib/imports/mapping";
import type { NormalizedImportRow } from "@/lib/imports/normalization";
import { ImportInputError } from "@/lib/imports/errors";

export type ImportPreviewChange = { field: string; before: string | null; after: string | null };
export function getImportMetadataPatch(input: NormalizedImportRow, mapping: ImportMapping) {
  if (input.type === "FUNDING_PROGRAMS") return {
    name: input.data.name, ...(mapping.code ? { code: input.data.code } : {}), ...(mapping.description ? { description: input.data.description } : {}),
  };
  if (input.type === "VENTURES") return {
    name: input.data.name, ...(mapping.legal_name ? { legalName: input.data.legalName } : {}), ...(mapping.external_reference ? { externalReference: input.data.externalReference } : {}),
  };
  throw new ImportInputError("IMPORT_UPSERT_UNAVAILABLE");
}
