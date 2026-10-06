"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NotificationActions({ id, href, read }: { id?: string; href?: string; read?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function act(action: "read" | "archive" | "readAll", open = false) {
    setPending(true); setError(null);
    try {
      const response = await fetch(`/api/notifications${id ? `/${id}` : ""}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível atualizar a notificação.");
      if (open && href) router.push(href);
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível concluir a operação."); }
    finally { setPending(false); }
  }
  return <div>
    <div className="flex flex-wrap gap-2">
      {id ? <><button className="button-secondary" disabled={pending} onClick={() => act("read", true)}>Abrir</button>{!read ? <button className="button-secondary" disabled={pending} onClick={() => act("read")}>Marcar como lida</button> : null}<button className="button-secondary" disabled={pending} onClick={() => act("archive")}>Arquivar</button></> : <button className="button-secondary" disabled={pending} onClick={() => act("readAll")}>Marcar todas como lidas</button>}
    </div>
    {error ? <p role="alert" className="mt-2 text-sm text-danger">{error}</p> : null}
  </div>;
}
