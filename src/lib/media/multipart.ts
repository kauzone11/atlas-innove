import { MediaError } from "@/lib/media/errors";
import { cropSchema, mediaKindSchema } from "@/lib/media/schemas";
import { MEDIA_SIZE_LIMITS } from "@/lib/media/processing";

const MAX_MULTIPART_BYTES = MEDIA_SIZE_LIMITS.POST_IMAGE + 64 * 1024;
let activeUploads = 0;
export async function withMediaUploadSlot<T>(action: () => Promise<T>): Promise<T> {
  if (activeUploads >= 4) throw new MediaError("MEDIA_UPLOAD_BUSY", 429, "Há outros envios em andamento. Aguarde um momento e tente novamente.");
  activeUploads++;
  try { return await action(); } finally { activeUploads--; }
}
export async function readMediaUpload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data;\s*boundary=/i.test(contentType) || contentType.length > 250) throw new MediaError("MEDIA_MULTIPART_REQUIRED", 400, "Selecione uma imagem para enviar.");
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_MULTIPART_BYTES)) throw new MediaError("MEDIA_TOO_LARGE", 413, "A imagem ultrapassa o limite de tamanho permitido.");
  const reader = request.body?.getReader();
  if (!reader) throw new MediaError("MEDIA_FILE_REQUIRED", 400, "Selecione uma imagem para enviar.");
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > MAX_MULTIPART_BYTES) { await reader.cancel(); throw new MediaError("MEDIA_TOO_LARGE", 413, "A imagem ultrapassa o limite de tamanho permitido."); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  let form: FormData;
  try { form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": contentType } }).formData(); }
  catch { throw new MediaError("MEDIA_MULTIPART_INVALID", 400, "Não foi possível ler a imagem enviada."); }
  if ([...form.keys()].some((key) => !["kind", "file", "crop"].includes(key)) || form.getAll("file").length !== 1 || form.getAll("kind").length !== 1 || form.getAll("crop").length > 1) throw new MediaError("MEDIA_MULTIPART_INVALID", 400, "Envie uma imagem por vez.");
  const kind = mediaKindSchema.parse(form.get("kind"));
  const file = form.get("file");
  if (!file || typeof file === "string" || !file.size) throw new MediaError("MEDIA_FILE_REQUIRED", 400, "Selecione uma imagem para enviar.");
  if (file.size > MEDIA_SIZE_LIMITS[kind]) throw new MediaError("MEDIA_TOO_LARGE", 413, `Use uma imagem de até ${MEDIA_SIZE_LIMITS[kind] / 1024 / 1024} MB.`);
  let crop;
  if (form.has("crop")) {
    const raw = form.get("crop");
    if (typeof raw !== "string" || raw.length > 500) throw new MediaError("MEDIA_CROP_INVALID", 400, "Confira o recorte da imagem.");
    try { crop = cropSchema.parse(JSON.parse(raw)); } catch { throw new MediaError("MEDIA_CROP_INVALID", 400, "Confira o recorte da imagem."); }
  }
  return { kind, bytes: new Uint8Array(await file.arrayBuffer()), mimeType: file.type, crop };
}
