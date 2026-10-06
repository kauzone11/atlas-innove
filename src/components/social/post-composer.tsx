"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { PostVisibility } from "@prisma/client";
import { Dialog } from "@/components/dialog";
import { personalRequest } from "@/components/personal/record-form";
import { profileMonogram } from "@/components/profiles/profile-renderer";
import { commentPolicyLabels, postVisibilityLabels } from "@/components/social/presentation";
import type { SocialPostDto } from "@/lib/social/types";

export function PostComposer({ fullName, ready = true, publicProfile = false, post, repost, compact = false, onDone }: { fullName: string; ready?: boolean; publicProfile?: boolean; post?: SocialPostDto; repost?: SocialPostDto; compact?: boolean; onDone?: () => void }) {
  const router = useRouter(); const [open, setOpen] = useState(false); const [body, setBody] = useState(post?.body ?? ""); const [url, setUrl] = useState(post?.externalUrl ?? ""); const [visibility, setVisibility] = useState<PostVisibility>(post?.visibility ?? "PLATFORM"); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null); const [discard, setDiscard] = useState(false); const textarea = useRef<HTMLTextAreaElement>(null);
  const title = post ? "Editar publicação" : repost ? "Repostar publicação" : "Criar publicação";
  const baseline = useRef({ body: post?.body ?? "", url: post?.externalUrl ?? "" });
  const acknowledgedEdit = useRef<{ postId: string; previousEditedAt: string | null; body: string; url: string } | null>(null);
  const dirty = body !== baseline.current.body || url !== baseline.current.url;
  function openComposer() {
    const saved = acknowledgedEdit.current;
    const values = post && saved?.postId === post.id && saved.previousEditedAt === post.editedAt
      ? saved : { body: post?.body ?? "", url: post?.externalUrl ?? "" };
    baseline.current = { body: values.body, url: values.url };
    setError(null); setDiscard(false); setBody(values.body); setUrl(values.url); setOpen(true);
  }
  function close() { if (pending) return; if (dirty) setDiscard(true); else setOpen(false); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setError(null);
    if ((!body.trim() && !url.trim() && !repost) || body.trim().length > 3000) { setError("Escreva uma publicação com até 3.000 caracteres ou adicione um link."); textarea.current?.focus(); return; }
    if (url.trim()) { try { const parsed = new URL(url); if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error(); } catch { setError("Informe um link HTTPS válido, sem credenciais."); return; } }
    setPending(true);
    try {
      await personalRequest(post ? `/api/personal/social/posts/${post.id}` : repost ? `/api/personal/social/posts/${repost.id}/repost` : "/api/personal/social/posts", post ? "PATCH" : "POST", { body: body.trim() || null, ...(!repost ? { externalUrl: url.trim() || null } : {}), ...(!post ? { visibility, commentPolicy: form.get("commentPolicy"), allowReposts: form.get("allowReposts") === "on" } : {}) });
      if (post) acknowledgedEdit.current = { postId: post.id, previousEditedAt: post.editedAt, body: body.trim(), url: url.trim() };
      else { setBody(""); setUrl(""); }
      setOpen(false); router.refresh(); onDone?.();
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível publicar. Seu texto foi preservado."); }
    finally { setPending(false); }
  }
  if (!ready) return <div className="border-l-2 border-accent py-2 pl-4"><p className="text-sm text-slate">Complete seu nome, endereço e apresentação para compartilhar sua atuação.</p><Link href="/app/personal/profile/edit" className="button-tertiary mt-2">Completar perfil</Link></div>;
  return <><button type="button" className={compact || post || repost ? "button-secondary" : "social-composer-trigger"} onClick={openComposer}>{!compact && !post && !repost ? <span aria-hidden="true" className="social-avatar">{profileMonogram(fullName)}</span> : null}{post ? "Editar publicação" : repost ? "Repostar" : compact ? "Criar publicação" : "Compartilhe uma atualização…"}</button><Dialog open={open} onClose={close} title={title} description={repost ? "A publicação original mantém suas próprias regras de acesso." : "Compartilhe uma atualização, aprendizado ou conquista."}><form noValidate onSubmit={submit} className="space-y-4"><fieldset className="min-w-0 space-y-4" disabled={pending}><label className="block space-y-2 text-sm font-medium"><span>{repost ? "Seu comentário (opcional)" : "Publicação"}</span><textarea ref={textarea} className="field-control resize-none" name="body" rows={7} value={body} onChange={(event) => setBody(event.target.value)} maxLength={3000} placeholder="O que você está construindo, pesquisando ou aprendendo?" aria-describedby="post-character-count" /><span id="post-character-count" className="block text-right text-xs font-normal tabular-nums text-slate">{body.length}/3.000</span></label>{!repost ? <label className="block space-y-2 text-sm font-medium"><span>Link externo (opcional)</span><input className="field-control" type="url" value={url} onChange={(event) => setUrl(event.target.value)} maxLength={2000} placeholder="https://" /></label> : null}{!post ? <><div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-2 text-sm font-medium"><span>Visibilidade</span><select className="field-control" value={visibility} onChange={(event) => setVisibility(event.target.value as PostVisibility)}>{Object.entries(postVisibilityLabels).map(([value, label]) => <option key={value} value={value} disabled={value === "PUBLIC" && (!publicProfile || repost?.visibility === "PLATFORM")}>{label}</option>)}</select></label><label className="block space-y-2 text-sm font-medium"><span>Quem pode comentar</span><select name="commentPolicy" className="field-control" defaultValue="EVERYONE">{Object.entries(commentPolicyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>{!publicProfile ? <p className="text-xs leading-6 text-slate">Publicações públicas exigem um perfil publicado. Você pode compartilhar com pessoas na plataforma ou <Link href="/app/personal/profile/edit" className="underline">configurar seu perfil</Link>.</p> : null}<label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="allowReposts" defaultChecked />Permitir repostagens</label></> : null}</fieldset>{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}{discard ? <div className="space-y-3 border-t border-line pt-4"><p className="text-sm">Descartar o texto desta publicação?</p><div className="flex flex-wrap gap-2"><button type="button" className="button-secondary" onClick={() => setDiscard(false)}>Continuar escrevendo</button><button type="button" className="button-danger" onClick={() => { setOpen(false); setDiscard(false); }}>Descartar texto</button></div></div> : <div className="social-composer-footer"><button type="button" className="button-secondary" disabled={pending} onClick={close}>Cancelar</button><button className="button-primary min-w-28" disabled={pending} aria-busy={pending}>{post ? "Salvar alterações" : repost ? "Repostar" : "Publicar"}</button></div>}</form></Dialog></>;
}
