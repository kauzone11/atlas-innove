import Link from "next/link";

import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Criar conta" };

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-10 block text-center text-lg font-semibold tracking-tight text-ink">Atlas Innove</Link>
        <section className="rounded-2xl border border-line bg-white p-7 shadow-panel sm:p-9">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Criar espaço institucional</h1>
          <p className="mb-7 mt-2 text-sm leading-6 text-slate">Comece com sua conta e a primeira organização.</p>
          <AuthForm mode="register" />
          <p className="mt-6 text-center text-sm text-slate">Já possui uma conta? <Link href="/login" className="font-semibold text-accent hover:text-accent-dark">Entrar</Link></p>
        </section>
      </div>
    </main>
  );
}
