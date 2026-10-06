"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { PasswordField } from "@/components/auth/password-field";

type AuthMode = "login" | "register";

export function AuthForm({ mode, redirectTo }: { mode: AuthMode; redirectTo?: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, organizationName, email, password }),
      });
      const payload = (await response.json()) as { error?: string; redirectTo?: string };
      if (!response.ok) {
        setError(payload.error ?? "Não foi possível concluir.");
        return;
      }
      router.push(redirectTo ?? payload.redirectTo ?? "/app");
      router.refresh();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setPending(false);
    }
  }

  const isRegister = mode === "register";
  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {isRegister ? (
        <>
          <Field label="Seu nome" value={fullName} onChange={setFullName} autoComplete="name" required />
          <details><summary className="min-h-11 cursor-pointer text-sm font-medium text-ink">Criar também um espaço institucional (opcional)</summary><div className="mt-3"><Field label="Nome da organização" value={organizationName} onChange={setOrganizationName} /><p className="mt-2 text-xs leading-5 text-slate">Deixe em branco para começar como participante. A mesma conta poderá acessar instituições depois.</p></div></details>
        </>
      ) : null}
      <Field label="E-mail" type="email" value={email} onChange={setEmail} autoComplete="email" required />
      <PasswordField value={password} onChange={setPassword} autoComplete={isRegister ? "new-password" : "current-password"} required minLength={isRegister ? 12 : 1} />
      {!isRegister ? <div className="-mt-1 text-right"><Link href="/recover" className="text-sm font-medium text-accent-hover underline-offset-4 hover:underline">Esqueci minha senha</Link></div> : null}
      {error ? <p className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{error}</p> : null}
      <button type="submit" disabled={pending} className="button-primary w-full">
        {pending ? "Aguarde…" : isRegister ? "Criar conta" : "Entrar"}
      </button>
    </form>
  );
}

function Field({ label, value, onChange, type = "text", autoComplete, required, minLength }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <label className="block space-y-2 text-sm font-medium text-ink">
      <span>{label}</span>
      <input className="field-control" type={type} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} required={required} minLength={minLength} />
    </label>
  );
}
