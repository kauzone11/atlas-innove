import type { MediaDto } from "@/lib/media/types";

export type ImageCrop = { x: number; y: number; width: number; height: number };
export type ProfileMediaKind = "PROFILE_AVATAR" | "PROFILE_COVER";

export function imageSelectionError(file: File, kind: ProfileMediaKind | "POST_IMAGE"): string | null {
  const maxMb = kind === "PROFILE_AVATAR" ? 5 : kind === "PROFILE_COVER" ? 8 : 10;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return "Escolha uma imagem JPEG, PNG ou WebP.";
  if (!file.size || file.size > maxMb * 1024 * 1024) return `A imagem deve ter até ${maxMb} MB e não pode estar vazia.`;
  return null;
}

export async function uploadImage(file: File, kind: ProfileMediaKind | "POST_IMAGE", options: { crop?: ImageCrop; signal?: AbortSignal } = {}): Promise<MediaDto> {
  const data = new FormData(); data.set("file", file); data.set("kind", kind);
  if (options.crop) data.set("crop", JSON.stringify(options.crop));
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  if (options.signal?.aborted) cancel();
  options.signal?.addEventListener("abort", cancel, { once: true });
  const timer = window.setTimeout(() => { timedOut = true; controller.abort(); }, 120_000);
  try {
    let response: Response;
    try { response = await fetch("/api/personal/media", { method: "POST", body: data, signal: controller.signal }); }
    catch (error) {
      if (timedOut) throw new Error("O envio demorou mais que o esperado. Confira sua conexão e tente novamente.");
      if (error instanceof Error && error.name === "AbortError") throw error;
      throw new Error("Não foi possível enviar a imagem. Confira sua conexão e tente novamente.");
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.asset) throw new Error(payload.error || "Não foi possível enviar a imagem. Tente novamente.");
    return payload.asset as MediaDto;
  } finally {
    window.clearTimeout(timer);
    options.signal?.removeEventListener("abort", cancel);
  }
}

export async function discardImage(mediaId: string): Promise<void> {
  await fetch(`/api/personal/media/${encodeURIComponent(mediaId)}`, { method: "DELETE" }).catch(() => undefined);
}
