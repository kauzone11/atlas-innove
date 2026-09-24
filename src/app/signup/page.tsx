import Link from "next/link";

import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata = { title: "Criar conta" };

export default function SignupPage() {
  return <AuthShell title="Criar conta" description="Crie sua conta e o primeiro espaço da organização."><AuthForm mode="register" /><p className="mt-6 text-center text-sm text-slate">Já possui uma conta? <Link href="/login" className="font-semibold text-accent-hover hover:underline">Entrar</Link></p></AuthShell>;
}
