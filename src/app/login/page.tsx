import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const params = await searchParams;
  const redirectTo = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/app";
  return <AuthShell title="Entrar" description="Acesse sua conta para continuar.">{params.reset === "done" ? <p className="mb-5 rounded-lg border border-success/20 bg-success-soft px-3 py-2 text-sm text-success" role="status">Senha atualizada. Entre com a nova senha.</p> : null}<AuthForm mode="login" redirectTo={redirectTo} /><div className="mt-6 border-t border-line pt-5 text-center"><p className="text-sm text-slate">Ainda não tem uma conta? <Link href="/signup" className="font-semibold text-accent-hover hover:underline">Criar conta</Link></p><Link href="/demo" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg border border-line px-4 text-sm font-semibold text-ink hover:bg-surface-subtle">Explorar demonstração</Link></div></AuthShell>;
}
