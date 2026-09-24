"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export function RecoverForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [developmentToken, setDevelopmentToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(null); setMessage(null); setDevelopmentToken(null);
    try {
      const response = await fetch("/api/auth/recover/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const payload = (await response.json()) as { message?: string; developmentToken?: string; error?: string };
      if (!response.ok) { setError(payload.error ?? "Não foi possível iniciar a recuperação."); return; }
      setMessage(payload.message ?? "Se o e-mail estiver cadastrado, você receberá as instruções de recuperação.");
      setDevelopmentToken(payload.developmentToken ?? null);
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }

  return <form onSubmit={submit} className="space-y-5"><label className="block space-y-2 text-sm font-medium text-ink"><span>E-mail</span><input className="field-control" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>{message ? <div className="space-y-3 rounded-lg border border-success/20 bg-success-soft px-3 py-3 text-sm text-success" role="status"><p>{message}</p>{developmentToken ? <Link href={`/recover/reset?token=${encodeURIComponent(developmentToken)}`} className="font-semibold underline underline-offset-4">Continuar para redefinir a senha</Link> : null}</div> : null}{error ? <p className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{error}</p> : null}<button type="submit" disabled={pending} className="button-primary w-full">{pending ? "Enviando…" : "Enviar instruções"}</button><p className="text-center text-sm text-slate"><Link href="/login" className="font-medium text-accent-hover hover:underline">Voltar para entrar</Link></p></form>;
}
