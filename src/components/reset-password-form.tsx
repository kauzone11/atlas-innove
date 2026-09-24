"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { PasswordField } from "@/components/auth/password-field";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null);
    if (password !== confirmation) { setError("As senhas precisam ser iguais."); return; }
    setPending(true);
    try {
      const response = await fetch("/api/auth/recover/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) { setError(payload.error ?? "Não foi possível redefinir a senha."); return; }
      router.push("/login?reset=done");
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }

  return <form onSubmit={submit} className="space-y-5"><PasswordField label="Nova senha" value={password} onChange={setPassword} autoComplete="new-password" required minLength={12} /><PasswordField label="Repetir nova senha" value={confirmation} onChange={setConfirmation} autoComplete="new-password" required minLength={12} />{error ? <p className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{error}</p> : null}<button type="submit" disabled={pending} className="button-primary w-full">{pending ? "Salvando…" : "Redefinir senha"}</button><p className="text-center text-sm text-slate"><Link href="/login" className="font-medium text-accent-hover hover:underline">Voltar para entrar</Link></p></form>;
}
