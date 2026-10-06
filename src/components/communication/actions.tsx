"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, RefreshCw, Send } from "lucide-react";
import { personalRequest } from "@/components/personal/record-form";

export function StartConversation({ otherUserId }: { otherUserId: string }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  async function start() {
    setPending(true); setError(null);
    try { const result = await personalRequest("/api/messages", "POST", { otherUserId }) as { conversationId: string }; router.push(`/app/messages/${result.conversationId}`); }
    catch (error) { setError(error instanceof Error ? error.message : "Não foi possível abrir a conversa."); }
    finally { setPending(false); }
  }
  return <div><button type="button" className="button-secondary" disabled={pending} onClick={() => void start()}><MessageSquare size={16} aria-hidden="true" />{pending ? "Abrindo…" : "Conversar"}</button>{error ? <p className="mt-2 text-sm text-danger" role="alert">{error}</p> : null}</div>;
}

export function RefreshCommunication() {
  const router = useRouter();
  return <button type="button" className="button-secondary" onClick={() => router.refresh()}><RefreshCw size={15} aria-hidden="true" />Atualizar</button>;
}

export function ConversationRead({ conversationId, lastMessageId }: { conversationId: string; lastMessageId?: string }) {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!lastMessageId) return;
    let active = true;
    personalRequest(`/api/messages/${conversationId}`, "PATCH", { lastMessageId }).then(() => { if (active) setError(null); }).catch(() => { if (active) setError("Não foi possível atualizar a contagem de mensagens não lidas. Atualize esta conversa para tentar novamente."); });
    return () => { active = false; };
  }, [conversationId, lastMessageId]);
  return error ? <p className="text-sm text-danger" role="status">{error}</p> : null;
}

export function MessageComposer({ endpoint, label = "Mensagem" }: { endpoint: string; label?: string }) {
  const router = useRouter(); const [body, setBody] = useState(""); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(null);
    try { await personalRequest(endpoint, "POST", { body }); setBody(""); router.refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Não foi possível enviar. Sua mensagem foi preservada."); }
    finally { setPending(false); }
  }
  return <form onSubmit={submit} className="space-y-3 border-t border-line pt-5"><label className="block space-y-2 text-sm font-medium"><span>{label}</span><textarea className="field-control min-h-28 resize-y" rows={4} value={body} onChange={(event) => setBody(event.target.value)} required maxLength={4000} disabled={pending} /></label><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate">{body.length.toLocaleString("pt-BR")} / 4.000 caracteres</p><button className="button-primary" disabled={pending || !body.trim()}><Send size={16} aria-hidden="true" />{pending ? "Enviando…" : "Enviar"}</button></div>{error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}</form>;
}
