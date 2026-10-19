import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const params = await searchParams;
  const redirectTo = params.next?.startsWith("/app") && !/[\\\r\n]/.test(params.next) ? params.next : "/app";
  return <AuthShell eyebrow="Bem-vindo de volta" title="Entrar" description="Acesse sua conta para continuar.">{params.reset === "done" ? <p className="banner ok mb-5" role="status">Senha atualizada. Entre com a nova senha.</p> : null}<AuthForm mode="login" redirectTo={redirectTo} /><div className="mt-6 border-t border-line pt-5 text-center"><p className="text-sm text-slate">Ainda não tem uma conta? <Link href={`/signup?next=${encodeURIComponent(redirectTo)}`} className="font-semibold text-accent-hover hover:underline">Criar conta</Link></p><Link href="/demo" className="button-secondary mt-4">Explorar demonstração</Link></div></AuthShell>;
}
