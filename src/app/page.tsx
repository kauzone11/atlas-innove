import Link from "next/link";
import { ArrowRight, BarChart3, Building2, ShieldCheck } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-canvas">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-6 lg:px-8">
        <Link href="/" className="text-lg font-semibold tracking-tight text-ink" aria-label="Atlas Innove, início">
          Atlas Innove
        </Link>
        <nav className="flex items-center gap-2" aria-label="Navegação principal">
          <Link href="/login" className="button-tertiary">Entrar</Link>
          <Link href="/signup" className="button-primary">Criar conta</Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:gap-20 lg:px-8 lg:pb-24 lg:pt-24">
        <div>
          <p className="mb-5 max-w-xl text-base font-medium text-brand">Acompanhamento institucional com contexto</p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-ink sm:text-6xl">
            Entenda como iniciativas apoiadas evoluem ao longo do tempo.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate sm:text-lg sm:leading-8">
            Atlas Innove é uma plataforma SaaS para acompanhamento longitudinal de empreendimentos, startups e projetos apoiados por programas de inovação e financiamento.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/signup" className="button-primary px-5">
              Começar uma organização <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link href="/login" className="button-secondary px-5">Acessar plataforma</Link>
          </div>
        </div>

        <div className="border-y border-line py-7 lg:mt-4 lg:border-y-0 lg:border-l lg:pl-10">
          <p className="text-sm font-semibold text-ink">Modelo de acompanhamento</p>
          <ol className="mt-6 space-y-0">
            <TrailItem label="Programa" detail="política ou iniciativa institucional" />
            <TrailItem label="Coorte" detail="ciclo de entrada comparável" />
            <TrailItem label="Empreendimento" detail="identidade preservada ao longo do tempo" />
            <TrailItem label="Acompanhamento" detail="evidências organizadas por ondas" last />
          </ol>
          <p className="mt-7 max-w-md text-sm leading-6 text-slate">
            Organize ciclos de apoio e mantenha a identidade de cada empreendimento separada dos registros de participação e das observações.
          </p>
        </div>
      </section>

      <section className="border-t border-line bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-6 md:grid-cols-3 lg:px-8 lg:py-16">
          <Feature icon={<Building2 size={20} aria-hidden="true" />} title="Contexto institucional" text="Cada organização possui seu próprio espaço, equipe e configuração." />
          <Feature icon={<ShieldCheck size={20} aria-hidden="true" />} title="Acesso explícito" text="Sessões e papéis são validados no servidor antes de qualquer operação." />
          <Feature icon={<BarChart3 size={20} aria-hidden="true" />} title="Visão longitudinal" text="Estruture evidências comparáveis sem confundir monitoramento com causalidade." />
        </div>
      </section>
    </main>
  );
}

function TrailItem({ label, detail, last = false }: { label: string; detail: string; last?: boolean }) {
  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {!last ? <span className="absolute left-[0.45rem] top-5 h-full w-px bg-line" aria-hidden="true" /> : null}
      <span className="relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
      <span><span className="block font-medium text-ink">{label}</span><span className="mt-1 block text-sm text-slate">{detail}</span></span>
    </li>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="space-y-3">
      <div className="text-brand">{icon}</div>
      <h2 className="font-semibold text-ink">{title}</h2>
      <p className="max-w-sm text-sm leading-6 text-slate">{text}</p>
    </div>
  );
}
