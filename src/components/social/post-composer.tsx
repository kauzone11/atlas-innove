"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Link2, Repeat2 } from "lucide-react";
import type { PostCommentPolicy, PostVisibility } from "@prisma/client";
import { Dialog } from "@/components/dialog";
import { Avatar } from "@/components/media/avatar";
import { discardImage } from "@/components/media/client";
import { PostImagePicker, type PostImageDraft } from "@/components/media/post-image-picker";
import { personalRequest } from "@/components/personal/record-form";
import { commentPolicyLabels, postVisibilityLabels } from "@/components/social/presentation";
import type { MediaDto } from "@/lib/media/types";
import type { SocialPostDto } from "@/lib/social/types";

type ComposerDraft = { body: string; url: string; images: PostImageDraft[]; visibility: PostVisibility; commentPolicy: PostCommentPolicy; allowReposts: boolean };
const signature = (draft: ComposerDraft) => JSON.stringify({ ...draft, images: draft.images.map(({ mediaId, altText }) => ({ mediaId, altText })) });
function postDraft(post?: SocialPostDto): ComposerDraft {
  return { body: post?.body ?? "", url: post?.externalUrl ?? "", images: post?.media?.map((media) => ({ mediaId: media.mediaId ?? media.id, altText: media.altText ?? "", media })) ?? [], visibility: post?.visibility ?? "PLATFORM", commentPolicy: post?.commentPolicy ?? "EVERYONE", allowReposts: post?.allowReposts ?? true };
}

export function PostComposer({ fullName, avatarMedia, ready = true, publicProfile = false, post, repost, compact = false, onDone }: { fullName: string; avatarMedia?: MediaDto | null; ready?: boolean; publicProfile?: boolean; post?: SocialPostDto; repost?: SocialPostDto; compact?: boolean; onDone?: () => void }) {
  const router = useRouter(); const countId = useId();
  const [open, setOpen] = useState(false); const [draft, setDraft] = useState<ComposerDraft>(() => postDraft(post));
  const [pending, setPending] = useState(false); const [uploading, setUploading] = useState(false); const [error, setError] = useState<string | null>(null); const [discard, setDiscard] = useState(false); const [showLink, setShowLink] = useState(Boolean(post?.externalUrl));
  const textarea = useRef<HTMLTextAreaElement>(null); const linkInput = useRef<HTMLInputElement>(null);
  const baseline = useRef<ComposerDraft>(postDraft(post));
  const acknowledgedEdit = useRef<{ postId: string; previousEditedAt: string | null; draft: ComposerDraft } | null>(null);
  const title = post ? "Editar publicação" : repost ? "Repostar publicação" : "Criar publicação";
  const dirty = signature(draft) !== signature(baseline.current);
  function update(part: Partial<ComposerDraft>) { setDraft((value) => ({ ...value, ...part })); }
  function openComposer() {
    const saved = acknowledgedEdit.current;
    const values = post && saved?.postId === post.id && saved.previousEditedAt === post.editedAt ? saved.draft : postDraft(post);
    baseline.current = values;
    setError(null); setDiscard(false); setDraft(values); setShowLink(Boolean(values.url)); setOpen(true);
  }
  function close() { if (pending || uploading) return; if (dirty) setDiscard(true); else setOpen(false); }
  function discardDraft() {
    const attached = new Set(baseline.current.images.map((image) => image.mediaId));
    for (const image of draft.images) if (!attached.has(image.mediaId)) void discardImage(image.mediaId);
    setDraft(baseline.current); setOpen(false); setDiscard(false);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending || uploading) return; setError(null);
    if ((!draft.body.trim() && !draft.url.trim() && !draft.images.length && !repost) || draft.body.trim().length > 3000) { setError("Escreva uma publicação com até 3.000 caracteres ou adicione um link ou imagem."); textarea.current?.focus(); return; }
    if (draft.url.trim()) { try { const parsed = new URL(draft.url); if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error(); } catch { setError("Informe um link HTTPS válido, sem credenciais."); linkInput.current?.focus(); return; } }
    setPending(true);
    try {
      await personalRequest(post ? `/api/personal/social/posts/${post.id}` : repost ? `/api/personal/social/posts/${repost.id}/repost` : "/api/personal/social/posts", post ? "PATCH" : "POST", {
        body: draft.body.trim() || null,
        ...(!repost ? { externalUrl: draft.url.trim() || null, media: draft.images.map(({ mediaId, altText }) => ({ mediaId, altText: altText.trim() || null })) } : {}),
        ...(!post ? { visibility: draft.visibility, commentPolicy: draft.commentPolicy, allowReposts: draft.allowReposts } : {}),
      });
      if (post) acknowledgedEdit.current = { postId: post.id, previousEditedAt: post.editedAt, draft: { ...draft, body: draft.body.trim(), url: draft.url.trim() } };
      else setDraft(postDraft());
      setOpen(false); router.refresh(); onDone?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível publicar. Seu texto e as imagens preparadas foram preservados."); }
    finally { setPending(false); }
  }
  if (!ready) return <div className="social-composer-incomplete"><p className="text-sm leading-6 text-slate">Complete seu nome, endereço e apresentação para compartilhar sua atuação.</p><Link href="/app/personal/profile/edit" className="button-tertiary mt-2">Completar perfil</Link></div>;
  return <>
    <button type="button" className={post ? "button-tertiary" : repost ? "social-action" : compact ? "button-primary" : "social-composer-trigger"} aria-label={!compact && !post && !repost ? "Compartilhe uma atualização…" : undefined} onClick={openComposer}>
      {!compact && !post && !repost ? <><Avatar name={fullName} media={avatarMedia} /><span>Compartilhe uma atualização, aprendizado ou conquista…</span></> : repost ? <><Repeat2 size={17} aria-hidden="true" />Repostar</> : post ? "Editar publicação" : "Criar publicação"}
    </button>
    <Dialog open={open} onClose={close} title={title} description={repost ? "A publicação original mantém suas próprias regras de acesso." : undefined}>
      <form noValidate onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-3"><Avatar name={fullName} media={avatarMedia} /><div className="min-w-0"><p className="break-words text-sm font-semibold">{fullName}</p><p className="mt-1 text-sm text-slate">{postVisibilityLabels[draft.visibility]}</p></div></div>
        <fieldset className="min-w-0 space-y-4" disabled={pending}>
          <label className="block space-y-2 text-sm font-medium"><span>{repost ? "Seu comentário (opcional)" : "Publicação"}</span><textarea ref={textarea} className="field-control social-composer-text resize-none" name="body" rows={7} value={draft.body} onChange={(event) => update({ body: event.target.value })} maxLength={3000} placeholder="O que você está construindo, pesquisando ou aprendendo?" aria-describedby={countId} /><span id={countId} className="block text-right text-sm font-normal tabular-nums text-slate">{draft.body.length}/3.000</span></label>
          {!repost ? <><PostImagePicker value={draft.images} onChange={(images) => update({ images })} disabled={pending} onUploadingChange={setUploading} />{showLink ? <label className="block space-y-2 text-sm font-medium"><span>Link externo (opcional)</span><input ref={linkInput} className="field-control" type="url" value={draft.url} onChange={(event) => update({ url: event.target.value })} maxLength={2000} placeholder="https://" /></label> : <button className="button-tertiary" type="button" onClick={() => setShowLink(true)}><Link2 size={17} aria-hidden="true" />Adicionar link</button>}</> : null}
          {!post ? <><div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-2 text-sm font-medium"><span>Visibilidade</span><select className="field-control" value={draft.visibility} onChange={(event) => update({ visibility: event.target.value as PostVisibility })}>{Object.entries(postVisibilityLabels).map(([value, label]) => <option key={value} value={value} disabled={value === "PUBLIC" && (!publicProfile || repost?.visibility === "PLATFORM")}>{label}</option>)}</select></label><label className="block space-y-2 text-sm font-medium"><span>Quem pode comentar</span><select name="commentPolicy" className="field-control" value={draft.commentPolicy} onChange={(event) => update({ commentPolicy: event.target.value as PostCommentPolicy })}>{Object.entries(commentPolicyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>{!publicProfile ? <p className="text-sm leading-6 text-slate">Publicações públicas exigem um perfil publicado. Você pode compartilhar com pessoas na plataforma ou <Link href="/app/personal/profile/edit" className="underline">configurar seu perfil</Link>.</p> : null}<label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="allowReposts" checked={draft.allowReposts} onChange={(event) => update({ allowReposts: event.target.checked })} />Permitir repostagens</label></> : null}
        </fieldset>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        {discard ? <div className="space-y-3 border-t border-line pt-4"><p className="text-sm">Descartar as alterações desta publicação, incluindo as imagens preparadas?</p><div className="flex flex-wrap gap-2"><button type="button" className="button-secondary" onClick={() => setDiscard(false)}>Continuar escrevendo</button><button type="button" className="button-danger" onClick={discardDraft}>Descartar alterações</button></div></div> : <div className="social-composer-footer"><button type="button" className="button-secondary" disabled={pending || uploading} onClick={close}>Cancelar</button><button className="button-primary min-w-28" disabled={pending || uploading} aria-busy={pending}>{post ? "Salvar alterações" : repost ? "Repostar" : "Publicar"}</button></div>}
      </form>
    </Dialog>
  </>;
}
