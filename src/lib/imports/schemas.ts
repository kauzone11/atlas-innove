import { z } from "zod";
import { IMPORT_TYPES } from "@/lib/imports/templates";
import { ImportInputError } from "@/lib/imports/errors";

export const importOptionsSchema = z.object({ mode: z.enum(["CREATE_ONLY", "UPSERT"]).default("CREATE_ONLY") }).strict();
export const createImportSchema = z.object({
  type: z.enum(IMPORT_TYPES),
  namespace: z.string().trim().min(1).max(80).regex(/^[a-z0-9][a-z0-9._-]*$/),
  sourceName: z.string().trim().min(1).max(200).optional(),
  schemaVersion: z.literal(1).default(1),
  delimiter: z.enum(["auto", ",", ";"]).default("auto"),
  options: importOptionsSchema.default({ mode: "CREATE_ONLY" }),
});
export type CreateImportInput = z.input<typeof createImportSchema> & { bytes: Uint8Array };
export const importMappingSchema = z.record(z.string().min(1).max(120), z.string().min(1).max(120));
export const importRevisionSchema = z.number().int().min(1).max(2147483646);
export const importPageSchema = z.number().int().min(1).max(100000).default(1);
export const importRowFilterSchema = z.enum(["ALL", "INVALID", "WARNINGS"]).default("ALL");

export function assertImportMode(type: string, mode: string) {
  if (mode === "UPSERT" && !["FUNDING_PROGRAMS", "VENTURES"].includes(type)) throw new ImportInputError("IMPORT_UPSERT_UNAVAILABLE");
}
