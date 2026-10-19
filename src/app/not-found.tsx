import Link from "next/link";
import { Compass } from "lucide-react";

import { PublicShell } from "@/components/public-shell";
import { EmptyState } from "@/components/ui";

export const metadata = { title: "Página não encontrada" };

export default function NotFound() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-2xl pt-6">
        <EmptyState icon={Compass} title="Esta página não existe ou não está disponível" description="O endereço pode ter mudado, o conteúdo pode não ser público ou você pode não ter acesso a ele. Volte ao início ou explore as oportunidades publicadas.">
          <Link href="/" className="button-primary">Ir para o início</Link>
          <Link href="/opportunities" className="button-secondary">Ver oportunidades</Link>
        </EmptyState>
      </div>
    </PublicShell>
  );
}
