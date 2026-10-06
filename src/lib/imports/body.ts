import { ImportInputError } from "@/lib/imports/errors";
import { IMPORT_LIMITS } from "@/lib/imports/limits";
import { createImportSchema } from "@/lib/imports/schemas";

async function readBoundedBody(request: Request, limit: number) {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) throw new ImportInputError("IMPORT_BODY_TOO_LARGE");
  if (!request.body) throw new ImportInputError("IMPORT_BODY_EMPTY");
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > limit) { await reader.cancel(); throw new ImportInputError("IMPORT_BODY_TOO_LARGE"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function readImportJson(request: Request): Promise<unknown> {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get("content-type") ?? "")) throw new ImportInputError("IMPORT_CONTENT_TYPE");
  const bytes = await readBoundedBody(request, 64 * 1024);
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown; }
  catch { throw new ImportInputError("IMPORT_JSON_INVALID"); }
}

export async function readImportForm(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data;/i.test(contentType)) throw new ImportInputError("IMPORT_CONTENT_TYPE");
  const body = await readBoundedBody(request, IMPORT_LIMITS.maxBytes + 64 * 1024);
  let form: FormData;
  try { form = await new Request(request.url, { method: "POST", headers: { "content-type": contentType }, body }).formData(); }
  catch { throw new ImportInputError("IMPORT_FORM_INVALID"); }
  const allowed = new Set(["file", "type", "namespace", "delimiter", "mode", "schemaVersion"]);
  for (const key of form.keys()) if (!allowed.has(key) || form.getAll(key).length !== 1) throw new ImportInputError("IMPORT_FORM_INVALID");
  const file = form.get("file");
  if (!(file instanceof File)) throw new ImportInputError("IMPORT_FILE_REQUIRED");
  if (!/\.csv$/i.test(file.name)) throw new ImportInputError("CSV_EXTENSION_INVALID");
  if (file.size > IMPORT_LIMITS.maxBytes) throw new ImportInputError("CSV_FILE_TOO_LARGE");
  const metadata = createImportSchema.parse({ type: form.get("type"), namespace: form.get("namespace"), sourceName: file.name,
    delimiter: form.get("delimiter") ?? "auto", schemaVersion: Number(form.get("schemaVersion") ?? 1), options: { mode: form.get("mode") ?? "CREATE_ONLY" },
  });
  return { ...metadata, bytes: new Uint8Array(await file.arrayBuffer()) };
}
