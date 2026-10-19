import Link from "next/link";
import { Compass } from "lucide-react";

import { EmptyState } from "@/components/ui";

export const metadata = { title: "Página não encontrada" };

export default function AppNotFound() {
  return (
    <div className="mx-auto max-w-2xl pt-6">
      <EmptyState icon={Compass} title="Este conteúdo não existe ou você não tem acesso" description="O endereço pode ter mudado, o registro pode ter sido removido ou pertencer a outra organização. Volte ao início do espaço de trabalho.">
        <Link href="/app" className="button-primary">Ir para a visão geral</Link>
        <Link href="/app/personal/feed" className="button-secondary">Abrir meu espaço</Link>
      </EmptyState>
    </div>
  );
}
