"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ArrowDown, ArrowUp, ImagePlus, LoaderCircle, X } from "lucide-react";
import { MediaImage } from "@/components/media/media-image";
import { discardImage, imageSelectionError, uploadImage } from "@/components/media/client";
import type { MediaDto } from "@/lib/media/types";

export type PostImageDraft = { mediaId: string; altText: string; media: MediaDto };

export function PostImagePicker({ value, onChange, disabled = false, onUploadingChange }: { value: PostImageDraft[]; onChange: (images: PostImageDraft[]) => void; disabled?: boolean; onUploadingChange?: (uploading: boolean) => void }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const current = useRef(value); current.current = value;
  const changeRef = useRef(onChange); changeRef.current = onChange;
  const busyRef = useRef(onUploadingChange); busyRef.current = onUploadingChange;
  useEffect(() => {
    const abort = new AbortController();
    void fetch("/api/personal/media/config", { signal: abort.signal }).then((response) => response.ok ? response.json() : null).then((result) => setEnabled(Boolean(result?.enabled))).catch(() => { if (!abort.signal.aborted) setEnabled(false); });
    return () => { abort.abort(); controller.current?.abort(); };
  }, []);
  async function select(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []); event.target.value = "";
    if (!files.length || uploading || disabled) return;
    if (files.length + current.current.length > 4) { setError("Você pode incluir até quatro imagens por publicação."); return; }
    for (const file of files) { const issue = imageSelectionError(file, "POST_IMAGE"); if (issue) { setError(`${file.name}: ${issue}`); return; } }
    setError(null); setUploading(true); busyRef.current?.(true);
    const abort = new AbortController(); controller.current = abort;
    try {
      for (const file of files) {
        const media = await uploadImage(file, "POST_IMAGE", { signal: abort.signal });
        if (abort.signal.aborted) { void discardImage(media.id); break; }
        const next = [...current.current, { mediaId: media.id, altText: "", media }];
        current.current = next; changeRef.current(next);
      }
    } catch (cause) {
      if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : "Não foi possível enviar a imagem. Sua publicação ainda não foi criada.");
    } finally { if (!abort.signal.aborted) { setUploading(false); busyRef.current?.(false); } }
  }
  function remove(index: number) {
    const removed = value[index]; onChange(value.filter((_, itemIndex) => itemIndex !== index));
    // Attached media is removed only with the post transaction; this endpoint accepts unattached drafts only.
    void discardImage(removed.mediaId);
  }
  function cancelUpload() {
    controller.current?.abort(); setUploading(false); busyRef.current?.(false);
    setError("Envio interrompido. As imagens já preparadas foram mantidas.");
  }
  function reorder(index: number, offset: number) { const next = [...value]; [next[index], next[index + offset]] = [next[index + offset], next[index]]; onChange(next); }
  return <section aria-label="Imagens da publicação" className="space-y-3">
    <div className="flex flex-wrap items-center gap-3"><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" tabIndex={-1} aria-label="Selecionar imagens da publicação" onChange={select} disabled={disabled || uploading || !enabled || value.length >= 4} /><button type="button" className="button-secondary" disabled={disabled || uploading || !enabled || value.length >= 4} onClick={() => inputRef.current?.click()}>{uploading ? <LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ImagePlus size={18} aria-hidden="true" />}Foto</button><p className="text-sm text-slate">{uploading ? "Enviando e preparando imagem…" : `${value.length}/4 imagens · Até 10 MB cada`}</p></div>
    {uploading ? <button type="button" className="button-tertiary" disabled={disabled} onClick={cancelUpload}>Cancelar envio</button> : null}
    {enabled === false ? <p className="text-sm leading-6 text-slate">O envio de imagens está indisponível no momento. Você pode publicar texto e links.</p> : null}
    {value.length ? <ol className="post-image-drafts">{value.map((entry, index) => <li key={entry.mediaId} className="post-image-draft"><MediaImage media={entry.media} alt={entry.altText || `Prévia da imagem ${index + 1}`} sizes="240px" /><div className="min-w-0 space-y-2"><div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">Imagem {index + 1}</span><div className="flex"><button type="button" className="social-action" aria-label={`Mover imagem ${index + 1} para antes`} disabled={disabled || uploading || index === 0} onClick={() => reorder(index, -1)}><ArrowUp size={16} aria-hidden="true" /></button><button type="button" className="social-action" aria-label={`Mover imagem ${index + 1} para depois`} disabled={disabled || uploading || index === value.length - 1} onClick={() => reorder(index, 1)}><ArrowDown size={16} aria-hidden="true" /></button><button type="button" className="social-action" aria-label={`Remover imagem ${index + 1}`} disabled={disabled || uploading} onClick={() => remove(index)}><X size={16} aria-hidden="true" /></button></div></div><label className="block space-y-1 text-sm"><span>Descrição da imagem (opcional)</span><input className="field-control" value={entry.altText} maxLength={500} disabled={disabled || uploading} onChange={(event) => onChange(value.map((item, itemIndex) => itemIndex === index ? { ...item, altText: event.target.value } : item))} /></label></div></li>)}</ol> : null}
    {value.length ? <p className="text-sm leading-6 text-slate">Descreva o que a imagem mostra para quem usa leitor de tela.</p> : null}
    <span className="sr-only" role="status">{uploading ? "Enviando imagem" : `${value.length} imagens preparadas`}</span>
    {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
  </section>;
}
