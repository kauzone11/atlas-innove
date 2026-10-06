"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { personalRequest } from "@/components/personal/record-form";

export function CreateDiscussion({ projectId }: { projectId: string }) {
  const router = useRouter(); const [open, setOpen] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setPending(true); setError(null);
    try { const result = await personalRequest(`/api/personal/projects/${projectId}/discussions`, "POST", { title: data.get("title"), body: data.get("body") }) as { discussion: { id: string } }; setOpen(false); router.push(`/app/personal/projects/${projectId}/discussions/${result.discussion.id}`); }
    catch (error) { setError(error instanceof Error ? error.message : "Não foi possível criar a discussão."); }
    finally { setPending(false); }
  }
  return <><button type="button" className="button-primary" onClick={() => setOpen(true)}><Plus size={16} aria-hidden="true" />Nova discussão</button><Dialog open={open} onClose={() => { if (!pending) setOpen(false); }} title="Nova discussão" description="Converse sobre uma decisão ou trabalho com os colaboradores atuais do projeto."><form className="space-y-4" onSubmit={submit}><label className="block space-y-2 text-sm font-medium"><span>Assunto</span><input className="field-control" name="title" required minLength={2} maxLength={180} /></label><label className="block space-y-2 text-sm font-medium"><span>Mensagem inicial</span><textarea className="field-control" name="body" required rows={5} maxLength={4000} /></label>{error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}<button className="button-primary w-full" disabled={pending}>{pending ? "Criando…" : "Criar discussão"}</button></form></Dialog></>;
}

export function DiscussionActions({ projectId, discussionId, subscribed, status, canManage, canSubscribe }: { projectId: string; discussionId: string; subscribed: boolean; status: "OPEN" | "CLOSED"; canManage: boolean; canSubscribe: boolean }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  async function action(kind: "subscription" | "status") {
    setPending(true); setError(null);
    try { const endpoint = `/api/personal/projects/${projectId}/discussions/${discussionId}`; await personalRequest(`${endpoint}${kind === "subscription" ? "/subscription" : ""}`, "PATCH", kind === "subscription" ? { subscribed: !subscribed } : { status: status === "OPEN" ? "CLOSED" : "OPEN" }); router.refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Não foi possível atualizar a discussão."); }
    finally { setPending(false); }
  }
  return <div className="space-y-2"><div className="flex flex-wrap gap-2">{canSubscribe ? <button type="button" className="button-secondary" disabled={pending} onClick={() => void action("subscription")}>{subscribed ? "Parar de acompanhar" : "Acompanhar discussão"}</button> : null}{canManage ? <button type="button" className="button-secondary" disabled={pending} onClick={() => void action("status")}>{status === "OPEN" ? "Encerrar discussão" : "Reabrir discussão"}</button> : null}</div>{error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}</div>;
}
