import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata = { title: "Redefinir senha" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <AuthShell title="Redefinir senha" description="Escolha uma nova senha para sua conta.">{token ? <ResetPasswordForm token={token} /> : <p className="text-sm leading-6 text-danger" role="alert">O link de recuperação está incompleto ou expirou. <Link href="/recover" className="font-semibold underline underline-offset-4">Solicite outro link</Link>.</p>}</AuthShell>;
}
import Link from "next/link";
