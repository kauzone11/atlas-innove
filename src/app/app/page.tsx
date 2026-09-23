import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { redirect } from "next/navigation";

import { getActiveOrganizationContext, getAuthenticatedSession } from "@/lib/auth/session";

export default async function AppHomePage() {
  const auth = await getAuthenticatedSession();
  if (!auth) {
    redirect("/login");
  }
  const context = await getActiveOrganizationContext();
  if (!context && auth.memberships.length > 1) {
    redirect("/app/organizations");
  }

  if (!context) {
    return <EmptyWorkspace />;
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Visão geral</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{context.organization.name}</h1>
        <p className="mt-3 max-w-2xl text-slate">A fundação institucional está pronta. Os módulos de programas, coortes e acompanhamento longitudinal entram na próxima fase do produto.</p>
      </div>

      <section className="grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-6 shadow-panel">
          <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 text-accent" size={20} aria-hidden="true" /><div><h2 className="font-semibold text-ink">Espaço protegido</h2><p className="mt-2 text-sm leading-6 text-slate">Sua sessão e sua associação ativa são validadas no servidor em cada operação.</p></div></div>
        </div>
        <div className="rounded-2xl border border-line bg-white p-6 shadow-panel">
          <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 text-accent" size={20} aria-hidden="true" /><div><h2 className="font-semibold text-ink">Equipe e contexto</h2><p className="mt-2 text-sm leading-6 text-slate">Convide pessoas, atribua papéis e selecione a organização de trabalho quando houver mais de uma.</p></div></div>
        </div>
      </section>

      <section className="rounded-2xl border border-dashed border-line bg-white p-7">
        <p className="text-sm font-semibold text-accent">Próximo eixo de produto</p>
        <h2 className="mt-2 text-xl font-semibold text-ink">Acompanhar evolução com evidências</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate">Quando o domínio longitudinal for adicionado, esta área receberá programas, coortes, empreendimentos, ondas de acompanhamento e análises. Nenhum indicador de negócio é inventado nesta fundação.</p>
        <Link href="/app/team" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:text-accent-dark">Administrar equipe <ArrowRight size={16} aria-hidden="true" /></Link>
      </section>
    </div>
  );
}

function EmptyWorkspace() {
  return <section className="rounded-2xl border border-line bg-white p-8 shadow-panel"><h1 className="text-2xl font-semibold text-ink">Escolha uma organização</h1><p className="mt-2 text-slate">Selecione o espaço institucional em que deseja trabalhar.</p><Link href="/app/organizations" className="mt-6 inline-flex rounded-lg bg-accent px-4 py-2.5 font-semibold text-white hover:bg-accent-dark">Ver organizações</Link></section>;
}
