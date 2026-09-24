import Link from "next/link";

import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const redirectTo = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/app";
  return <AuthShell title="Entrar na plataforma" description="Acesse o espaço institucional da sua organização."><AuthForm mode="login" redirectTo={redirectTo} /><p className="mt-6 text-center text-sm text-slate">Ainda não tem uma conta? <Link href="/signup" className="font-semibold text-brand hover:text-brand-hover">Criar conta</Link></p></AuthShell>;
}

function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-5 py-10 sm:px-6 sm:py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center text-lg font-semibold tracking-tight text-ink">Atlas Innove</Link>
        <section className="panel p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          <p className="mt-2 mb-7 text-sm leading-6 text-slate">{description}</p>
          {children}
        </section>
      </div>
    </main>
  );
}
