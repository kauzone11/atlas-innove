import Link from "next/link";
import { ArrowRight, BarChart3, Building2, ShieldCheck } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-canvas">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-7 lg:px-8">
        <Link href="/" className="text-lg font-semibold tracking-tight text-ink" aria-label="Atlas Innove, início">
          Atlas Innove
        </Link>
        <nav className="flex items-center gap-3" aria-label="Navegação principal">
          <Link href="/login" className="rounded-lg px-4 py-2 text-sm font-medium text-slate hover:bg-white hover:text-ink">
            Entrar
          </Link>
          <Link href="/signup" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark">
            Criar conta
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl gap-16 px-6 pb-20 pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:pt-24">
        <div>
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-accent">Acompanhamento com contexto</p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-6xl">
            Entenda como iniciativas apoiadas evoluem ao longo do tempo.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate">
            Atlas Innove é uma plataforma SaaS para acompanhamento longitudinal de empreendimentos, startups e projetos apoiados por programas de inovação e financiamento.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 font-semibold text-white hover:bg-accent-dark">
              Começar uma organização <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link href="/login" className="rounded-lg border border-line bg-white px-5 py-3 font-semibold text-ink hover:border-accent">
              Acessar plataforma
            </Link>
          </div>
        </div>

        <div className="grid content-start gap-4 rounded-2xl border border-line bg-white p-7 shadow-panel">
          <p className="text-sm font-semibold text-accent">Modelo de acompanhamento</p>
          <div className="space-y-1 text-lg font-medium text-ink">
            <p>Programa</p><p className="pl-5 text-slate">→ Coorte</p><p className="pl-10 text-slate">→ Empreendimento</p><p className="pl-14 text-slate">→ acompanhamento ao longo do tempo</p>
          </div>
          <p className="border-t border-line pt-5 text-sm leading-6 text-slate">
            Organize ciclos de apoio e mantenha a identidade de cada empreendimento separada dos registros de participação e das observações ao longo do tempo.
          </p>
        </div>
      </section>

      <section className="border-t border-line bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-14 md:grid-cols-3 lg:px-8">
          <Feature icon={<Building2 size={20} aria-hidden="true" />} title="Contexto institucional" text="Cada organização possui seu próprio espaço, equipe e configuração." />
          <Feature icon={<ShieldCheck size={20} aria-hidden="true" />} title="Acesso explícito" text="Sessões e papéis são validados no servidor antes de qualquer operação." />
          <Feature icon={<BarChart3 size={20} aria-hidden="true" />} title="Visão longitudinal" text="Estruture evidências comparáveis para compreender trajetórias sem confundir monitoramento com causalidade." />
        </div>
      </section>
    </main>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="space-y-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e7f2f0] text-accent">{icon}</div>
      <h2 className="font-semibold text-ink">{title}</h2>
      <p className="text-sm leading-6 text-slate">{text}</p>
    </div>
  );
}
