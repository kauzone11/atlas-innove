"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/dialog";
import { personalRequest } from "@/components/personal/record-form";
import type { ProjectRequestState } from "@/lib/network/requests";

export function ProjectNetworkActions({ projectId, state, requestId }: { projectId: string } & ProjectRequestState) {
  const router = useRouter(); const [open, setOpen] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  async function send(input: unknown, cancel = false) { setPending(true); setError(null); try { await personalRequest(`/api/personal/network/projects/${projectId}/requests${cancel ? `/${requestId}` : ""}`, cancel ? "PATCH" : "POST", input); setOpen(false); router.refresh(); } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível enviar a solicitação."); } finally { setPending(false); } }
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); await send({ message: new FormData(event.currentTarget).get("message") || null }); }
  return <div className="space-y-3">{state === "MEMBER" ? <Link href={`/app/personal/projects/${projectId}`} className="button-secondary">Abrir projeto</Link> : state === "AVAILABLE" ? <button className="button-primary" onClick={() => setOpen(true)}>Tenho interesse em colaborar</button> : state === "PENDING" ? <div className="flex flex-wrap items-center gap-3"><p className="text-sm text-slate">Solicitação enviada.</p><button className="button-secondary" disabled={pending} onClick={() => void send({ action: "cancel" }, true)}>Cancelar solicitação</button></div> : <p className="text-sm text-slate">Não está buscando colaboradores agora.</p>}{error && !open ? <p role="alert" className="text-sm text-danger">{error}</p> : null}<Dialog open={open} onClose={() => { if (!pending) setOpen(false); }} title="Interesse em colaborar" description="A liderança do projeto poderá analisar sua solicitação. Ao aceitar, você será membro do projeto, sem entrar automaticamente na equipe."><form onSubmit={submit} className="space-y-4"><label className="block text-sm font-medium"><span>Como você gostaria de contribuir? (opcional)</span><textarea className="field-control mt-2" name="message" rows={4} maxLength={500} /></label>{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}<button className="button-primary" disabled={pending}>{pending ? "Enviando…" : "Enviar solicitação"}</button></form></Dialog></div>;
}
