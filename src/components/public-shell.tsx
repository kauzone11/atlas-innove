import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

import { getAuthenticatedSession } from "@/lib/auth/session";

export async function PublicShell({ children }: { children: ReactNode }) {
  const auth = await getAuthenticatedSession();
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a href="#main-content" className="skip-link">Ir para o conteúdo</a>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/opportunities" className="inline-flex min-h-11 items-center" aria-label="Atlas Innove — oportunidades">
            <Image src="/brand/atlas-innove-lockup.svg" alt="Atlas Innove" width={154} height={40} />
          </Link>
          <nav aria-label="Navegação pública" className="flex flex-wrap items-center gap-2 text-sm">
            <Link href="/opportunities" className="inline-flex min-h-11 items-center rounded-md px-3 text-slate hover:text-ink">Oportunidades</Link>
            <Link href="/institutions" className="inline-flex min-h-11 items-center rounded-md px-3 text-slate hover:text-ink">Instituições</Link>
            <Link href="/results" className="inline-flex min-h-11 items-center rounded-md px-3 text-slate hover:text-ink">Resultados</Link>
            {auth ? <Link href="/app/personal" className="button-primary">Meu espaço</Link> : <>
              <Link href="/login" className="button-secondary">Entrar</Link>
              <Link href="/signup" className="button-primary">Criar conta</Link>
            </>}
          </nav>
        </div>
      </header>
      <main id="main-content" className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>
      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-6 text-xs text-slate sm:px-6">
        <span>Atlas Innove · Identidade e trajetória de inovação</span>
        <span>As informações públicas são compartilhadas por escolha de seus responsáveis.</span>
      </footer>
    </div>
  );
}
