import Link from "next/link";

import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata = { title: "Criar conta" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const redirectTo = next?.startsWith("/app") && !/[\\\r\n]/.test(next) ? next : undefined;
  return <AuthShell title="Criar conta" description="Comece sua trajetória de inovação ou organize o espaço de uma instituição."><AuthForm mode="register" redirectTo={redirectTo} /><p className="mt-6 text-center text-sm text-slate">Já possui uma conta? <Link href={redirectTo ? `/login?next=${encodeURIComponent(redirectTo)}` : "/login"} className="font-semibold text-accent-hover hover:underline">Entrar</Link></p></AuthShell>;
}
