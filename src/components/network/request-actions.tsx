"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { personalRequest } from "@/components/personal/record-form";

export function NetworkRequestActions({ url, incoming, invitation = false, acceptedHref }: { url: string; incoming: boolean; invitation?: boolean; acceptedHref?: string }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  async function action(value: string) { setPending(true); setError(null); try { await personalRequest(url, "PATCH", { action: value }); if (value === "accept" && acceptedHref) router.push(acceptedHref); else router.refresh(); } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível responder."); } finally { setPending(false); } }
  return <div className="space-y-2"><div className="flex flex-wrap gap-2">{incoming ? <><button className="button-primary" disabled={pending} onClick={() => void action("accept")}>{pending ? "Registrando…" : "Aceitar"}</button><button className="button-secondary" disabled={pending} onClick={() => void action("decline")}>Recusar</button></> : <button className="button-secondary" disabled={pending} onClick={() => void action(invitation ? "revoke" : "cancel")}>{invitation ? "Revogar convite" : "Cancelar solicitação"}</button>}</div>{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}</div>;
}

export function UnblockAction({ userId }: { userId: string }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  return <div><button className="button-secondary" disabled={pending} onClick={async () => { setPending(true); setError(null); try { await personalRequest("/api/personal/network/blocks", "DELETE", { blockedUserId: userId }); router.refresh(); } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível desbloquear."); } finally { setPending(false); } }}>Desbloquear</button>{error ? <p className="mt-2 text-sm text-danger" role="alert">{error}</p> : null}</div>;
}
