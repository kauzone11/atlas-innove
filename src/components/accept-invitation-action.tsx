"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AcceptInvitationAction({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function accept() {
    setPending(true); setError(null);
    try {
      const response = await fetch("/api/invitations/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) { setError(payload.error ?? "Não foi possível aceitar o convite."); return; }
      router.push("/app");
      router.refresh();
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }

  return <div><p className="mt-3 text-sm leading-6 text-slate">Você está autenticado. Aceite o convite para entrar na organização.</p><button type="button" onClick={accept} disabled={pending} className="mt-6 rounded-lg bg-accent px-4 py-2.5 font-semibold text-white hover:bg-accent-dark disabled:opacity-60">{pending ? "Aceitando…" : "Aceitar convite"}</button>{error ? <p className="mt-4 text-sm text-red-800" role="alert">{error}</p> : null}</div>;
}
