import Link from "next/link";
import type { ReactNode } from "react";

import { AtlasLogo } from "@/components/brand/logo";
import { PublicNav } from "@/components/public-nav";
import { getAuthenticatedSession } from "@/lib/auth/session";

export async function PublicShell({ children }: { children: ReactNode }) {
  const auth = await getAuthenticatedSession();
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a href="#main-content" className="skip-link">Ir para o conteúdo</a>
      <PublicNav authenticated={Boolean(auth)} />
      <main id="main-content" className="mx-auto w-full max-w-[1320px] px-4 pb-16 pt-6 sm:px-9 sm:pt-10" tabIndex={-1}>{children}</main>
      <footer className="pubfoot">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <AtlasLogo className="h-8 w-auto opacity-90" />
          <nav aria-label="Rodapé" className="flex flex-wrap gap-x-5 gap-y-2"><Link href="/demo">Demonstração pública</Link><Link href="/results">Resultados</Link><Link href="/institutions">Instituições</Link></nav>
        </div>
        <p className="mt-4 max-w-[70ch]">Atlas Innove é infraestrutura para acompanhar programas de fomento ao longo do tempo. As informações públicas são compartilhadas por escolha de seus responsáveis e não atribuem, por si só, causa ao programa.</p>
      </footer>
    </div>
  );
}
