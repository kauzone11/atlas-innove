import { MediaError } from "@/lib/media/errors";
import { cropSchema, mediaKindSchema } from "@/lib/media/schemas";
import { MEDIA_SIZE_LIMITS } from "@/lib/media/processing";

const MAX_MULTIPART_BYTES = MEDIA_SIZE_LIMITS.POST_IMAGE + 64 * 1024;
const BODY_TIMEOUT_MS = 30_000;
let activeUploads = 0;
const uploadsByUser = new Map<string, number>();
export async function withMediaUploadSlot<T>(userId: string, action: () => Promise<T>): Promise<T> {
  const userUploads = uploadsByUser.get(userId) ?? 0;
  if (userUploads >= 2) throw new MediaError("MEDIA_USER_UPLOAD_BUSY", 429, "Você já tem dois envios em andamento. Aguarde a conclusão antes de enviar outra imagem.");
  if (activeUploads >= 4) throw new MediaError("MEDIA_UPLOAD_BUSY", 429, "Há outros envios em andamento. Aguarde um momento e tente novamente.");
  activeUploads++;
  uploadsByUser.set(userId, userUploads + 1);
  try { return await action(); } finally {
    activeUploads--;
    const remaining = (uploadsByUser.get(userId) ?? 1) - 1;
    if (remaining) uploadsByUser.set(userId, remaining); else uploadsByUser.delete(userId);
  }
}
export async function readMediaUpload(request: Request, options: { timeoutMs?: number } = {}) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data;\s*boundary=/i.test(contentType) || contentType.length > 250) throw new MediaError("MEDIA_MULTIPART_REQUIRED", 400, "Selecione uma imagem para enviar.");
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_MULTIPART_BYTES)) throw new MediaError("MEDIA_TOO_LARGE", 413, "A imagem ultrapassa o limite de tamanho permitido.");
  const reader = request.body?.getReader();
  if (!reader) throw new MediaError("MEDIA_FILE_REQUIRED", 400, "Selecione uma imagem para enviar.");
  // Both bytes and allocation bookkeeping are bounded even when a sender streams one-byte chunks.
  const bytes = Buffer.alloc(MAX_MULTIPART_BYTES); let length = 0;
  const timeoutMs = Math.max(1, Math.min(options.timeoutMs ?? BODY_TIMEOUT_MS, BODY_TIMEOUT_MS));
  const deadlineAt = Date.now() + timeoutMs;
  const timedOut = () => new MediaError("MEDIA_UPLOAD_TIMEOUT", 408, "O envio demorou mais que o esperado. Verifique sua conexão e tente novamente.");
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(timedOut()), timeoutMs); });
  try {
    const readBody = async () => {
      for (;;) {
        if (Date.now() >= deadlineAt) throw timedOut();
        const next = await reader.read();
        if (next.done) return;
        if (next.value.byteLength > MAX_MULTIPART_BYTES - length) throw new MediaError("MEDIA_TOO_LARGE", 413, "A imagem ultrapassa o limite de tamanho permitido.");
        bytes.set(next.value, length);
        length += next.value.byteLength;
      }
    };
    await Promise.race([readBody(), deadline]);
  } catch (error) {
    // An untrusted stream's cancel hook may never settle; it must not retain an intake slot.
    void reader.cancel().catch(() => undefined);
    if (error instanceof MediaError) throw error;
    throw new MediaError("MEDIA_UPLOAD_INTERRUPTED", 400, "O envio foi interrompido. Verifique sua conexão e tente novamente.");
  } finally { clearTimeout(timer!); reader.releaseLock(); }
  let form: FormData;
  try { form = await new Response(bytes.subarray(0, length), { headers: { "Content-Type": contentType } }).formData(); }
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
