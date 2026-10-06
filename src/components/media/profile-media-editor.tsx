"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, LoaderCircle } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { Avatar } from "@/components/media/avatar";
import { MediaImage } from "@/components/media/media-image";
import { discardImage, imageSelectionError, uploadImage, type ImageCrop, type ProfileMediaKind } from "@/components/media/client";
import { personalRequest } from "@/components/personal/record-form";
import type { MediaDto } from "@/lib/media/types";

type Selection = { file: File; url: string; width: number; height: number; kind: ProfileMediaKind };

function cropFor(selection: Selection, zoom: number, horizontal: number, vertical: number): ImageCrop {
  const ratio = selection.kind === "PROFILE_AVATAR" ? 1 : 3;
  const imageRatio = selection.width / selection.height;
  const width = Math.min(1, ratio / imageRatio) / zoom;
  const height = Math.min(1, imageRatio / ratio) / zoom;
  return { x: (1 - width) * horizontal, y: (1 - height) * vertical, width, height };
}

export function ProfileMediaEditor({ fullName, avatarMedia, coverMedia, enabled }: { fullName: string; avatarMedia: MediaDto | null; coverMedia: MediaDto | null; enabled: boolean }) {
  const router = useRouter();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [zoom, setZoom] = useState(1);
  const [horizontal, setHorizontal] = useState(0.5);
  const [vertical, setVertical] = useState(0.5);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [removeKind, setRemoveKind] = useState<ProfileMediaKind | null>(null);
  const selectionRef = useRef(selection); selectionRef.current = selection;
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const selectionAttempt = useRef(0);
  const mounted = useRef(true);
  const uploadController = useRef<AbortController | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; selectionAttempt.current += 1; uploadController.current?.abort(); if (selectionRef.current) URL.revokeObjectURL(selectionRef.current.url); }; }, []);
  function close() { if (pending) return; if (selection) URL.revokeObjectURL(selection.url); setSelection(null); setError(null); }
  async function select(event: ChangeEvent<HTMLInputElement>, kind: ProfileMediaKind) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file || pending) return;
    setError(null); setNotice(null);
    const issue = imageSelectionError(file, kind); if (issue) { setError(issue); return; }
    const url = URL.createObjectURL(file); const attempt = ++selectionAttempt.current;
    const preview = new window.Image(); preview.src = url;
    try {
      await preview.decode();
      if (!mounted.current || attempt !== selectionAttempt.current) { URL.revokeObjectURL(url); return; }
      if (!preview.naturalWidth || !preview.naturalHeight || preview.naturalWidth > 10000 || preview.naturalHeight > 10000 || preview.naturalWidth * preview.naturalHeight > 40_000_000) throw new Error("Escolha uma imagem com dimensões menores, até 10.000 pixels por lado e 40 milhões de pixels no total.");
      if (selectionRef.current) URL.revokeObjectURL(selectionRef.current.url);
      setSelection({ file, url, width: preview.naturalWidth, height: preview.naturalHeight, kind }); setZoom(1); setHorizontal(0.5); setVertical(0.5);
    } catch (cause) { URL.revokeObjectURL(url); if (mounted.current) setError(cause instanceof Error && cause.message.startsWith("Escolha") ? cause.message : "Não foi possível abrir esta imagem. Escolha outro arquivo."); }
  }
  async function save() {
    if (!selection || pending) return;
    setPending(true); setUploading(true); setError(null);
    const abort = new AbortController(); uploadController.current = abort;
    let uploaded: MediaDto | null = null;
    try {
      uploaded = await uploadImage(selection.file, selection.kind, { crop: cropFor(selection, zoom, horizontal, vertical), signal: abort.signal });
      setUploading(false);
      await personalRequest("/api/personal/profile/media", "PATCH", { kind: selection.kind, mediaId: uploaded.id });
      URL.revokeObjectURL(selection.url); setSelection(null); setNotice(selection.kind === "PROFILE_AVATAR" ? "Foto de perfil atualizada." : "Imagem de capa atualizada."); router.refresh();
    } catch (cause) { if (uploaded) void discardImage(uploaded.id); setError(abort.signal.aborted ? "Envio interrompido. Você pode ajustar a imagem e tentar novamente." : cause instanceof Error ? cause.message : "Não foi possível salvar a imagem. Sua imagem anterior foi preservada."); }
    finally { setPending(false); setUploading(false); uploadController.current = null; }
  }
  async function remove() {
    if (!removeKind || pending) return;
    setPending(true); setError(null);
    try { await personalRequest("/api/personal/profile/media", "PATCH", { kind: removeKind, mediaId: null }); setNotice(removeKind === "PROFILE_AVATAR" ? "Foto de perfil removida." : "Imagem de capa removida."); setRemoveKind(null); router.refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível remover a imagem."); }
    finally { setPending(false); }
  }
  const crop = selection ? cropFor(selection, zoom, horizontal, vertical) : null;
  return <div className="space-y-5">
    <div className="profile-media-fields">
      <section className="space-y-3"><h3 className="text-sm font-semibold">Foto de perfil</h3><Avatar name={fullName} media={avatarMedia} size="profile" /><p className="text-sm leading-6 text-slate">JPEG, PNG ou WebP · Até 5 MB</p><div className="flex flex-wrap gap-2"><input type="file" className="sr-only" tabIndex={-1} aria-label="Selecionar foto de perfil" ref={avatarInput} accept="image/jpeg,image/png,image/webp" disabled={!enabled || pending} onChange={(event) => void select(event, "PROFILE_AVATAR")} /><button type="button" className="button-secondary" disabled={!enabled || pending} onClick={() => avatarInput.current?.click()}><Camera size={16} aria-hidden="true" />{avatarMedia ? "Alterar foto" : "Adicionar foto"}</button>{avatarMedia ? <button type="button" className="button-tertiary" disabled={pending} onClick={() => { setError(null); setRemoveKind("PROFILE_AVATAR"); }}>Remover foto</button> : null}</div></section>
      <section className="min-w-0 space-y-3"><h3 className="text-sm font-semibold">Imagem de capa</h3><div className="profile-media-cover-preview">{coverMedia ? <MediaImage media={coverMedia} alt="Sua imagem de capa" sizes="(max-width: 767px) 90vw, 500px" /> : <span>Atlas Innove</span>}</div><p className="text-sm leading-6 text-slate">JPEG, PNG ou WebP · Até 8 MB</p><div className="flex flex-wrap gap-2"><input type="file" className="sr-only" tabIndex={-1} aria-label="Selecionar imagem de capa" ref={coverInput} accept="image/jpeg,image/png,image/webp" disabled={!enabled || pending} onChange={(event) => void select(event, "PROFILE_COVER")} /><button type="button" className="button-secondary" disabled={!enabled || pending} onClick={() => coverInput.current?.click()}><ImagePlus size={16} aria-hidden="true" />{coverMedia ? "Alterar capa" : "Adicionar capa"}</button>{coverMedia ? <button type="button" className="button-tertiary" disabled={pending} onClick={() => { setError(null); setRemoveKind("PROFILE_COVER"); }}>Remover capa</button> : null}</div></section>
    </div>
    <p className="text-sm leading-6 text-slate">A foto e a capa acompanham a privacidade do seu perfil. Dados de localização e outros metadados do arquivo são removidos no envio.</p>
    {!enabled ? <p className="text-sm leading-6 text-slate">O envio de imagens está indisponível no momento. Seu perfil continua disponível com as informações já salvas.</p> : null}
    {notice ? <p className="text-sm text-success" role="status">{notice}</p> : null}
    {error && !selection && !removeKind ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
    <Dialog open={Boolean(selection)} onClose={close} title={selection?.kind === "PROFILE_AVATAR" ? "Ajustar foto de perfil" : "Ajustar imagem de capa"} description="Ajuste o enquadramento antes de salvar. Use os controles para aproximar e reposicionar.">
      {selection && crop ? <div className="space-y-4"><div className={`media-crop-preview ${selection.kind === "PROFILE_AVATAR" ? "media-crop-avatar" : "media-crop-cover"}`}>
        {/* The browser previews normalized coordinates; final cropping and validation happen on the server. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={selection.url} alt="Prévia do enquadramento" style={{ width: `${100 / crop.width}%`, height: `${100 / crop.height}%`, left: `${-crop.x / crop.width * 100}%`, top: `${-crop.y / crop.height * 100}%` }} />
      </div><fieldset className="space-y-3" disabled={pending}>{[
        { label: "Aproximar", value: zoom, set: setZoom, min: 1, max: 3 },
        { label: "Posição horizontal", value: horizontal, set: setHorizontal, min: 0, max: 1 },
        { label: "Posição vertical", value: vertical, set: setVertical, min: 0, max: 1 },
      ].map((control) => <label key={control.label} className="block text-sm font-medium"><span>{control.label}</span><input className="media-crop-range" type="range" min={control.min} max={control.max} step="0.01" value={control.value} onChange={(event) => control.set(Number(event.target.value))} /></label>)}</fieldset>{uploading ? <button type="button" className="button-tertiary" onClick={() => uploadController.current?.abort()}>Cancelar envio</button> : null}{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}<div className="flex flex-wrap justify-end gap-2"><button type="button" className="button-secondary" disabled={pending} onClick={close}>Cancelar</button><button type="button" className="button-primary min-w-36" aria-busy={pending} disabled={pending} onClick={() => void save()}>{pending ? <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}Salvar imagem</button></div><span role="status" className="sr-only">{pending ? "Preparando e salvando imagem" : ""}</span></div> : null}
    </Dialog>
    <Dialog open={Boolean(removeKind)} onClose={() => { if (!pending) setRemoveKind(null); }} title={removeKind === "PROFILE_AVATAR" ? "Remover foto de perfil?" : "Remover imagem de capa?"} description={removeKind === "PROFILE_AVATAR" ? "Seu perfil passará a mostrar suas iniciais." : "Seu perfil passará a mostrar a capa padrão do Atlas Innove."}>{error ? <p role="alert" className="mb-4 text-sm text-danger">{error}</p> : null}<div className="flex flex-wrap gap-2"><button data-autofocus type="button" className="button-secondary" disabled={pending} onClick={() => setRemoveKind(null)}>Cancelar</button><button type="button" className="button-danger" aria-busy={pending} disabled={pending} onClick={() => void remove()}>Remover imagem</button></div></Dialog>
  </div>;
}
