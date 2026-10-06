"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { FollowPolicy, PrimaryProfileAction } from "@prisma/client";
import { personalRequest } from "@/components/personal/record-form";

export function SocialSettings({ followPolicy, primaryProfileAction }: { followPolicy: FollowPolicy; primaryProfileAction: PrimaryProfileAction }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null); const [saved, setSaved] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); setPending(true); setSaved(false); setError(null); try { await personalRequest("/api/personal/social/settings", "PATCH", { followPolicy: form.get("followPolicy"), primaryProfileAction: form.get("primaryProfileAction") }); setSaved(true); router.refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar suas preferências."); } finally { setPending(false); } }
  return <form noValidate onSubmit={submit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-2 text-sm font-medium"><span>Quem pode seguir você</span><select name="followPolicy" className="field-control" defaultValue={followPolicy} disabled={pending}><option value="EVERYONE">Pessoas na plataforma</option><option value="CONNECTIONS_ONLY">Somente minhas conexões</option></select></label><label className="block space-y-2 text-sm font-medium"><span>Ação principal no perfil</span><select name="primaryProfileAction" className="field-control" defaultValue={primaryProfileAction} disabled={pending}><option value="CONNECT">Conectar</option><option value="FOLLOW">Seguir</option></select></label></div><p className="text-xs leading-6 text-slate">Seguir acompanha publicações. Conectar estabelece uma relação profissional e permite mensagens. Ao permitir somente conexões, os acompanhamentos de outras pessoas serão encerrados; publicações e histórico serão preservados.</p>{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}{saved ? <p role="status" className="text-sm text-success">Preferências salvas.</p> : null}<button className="button-secondary" disabled={pending} aria-busy={pending}>Salvar preferências</button></form>;
}

