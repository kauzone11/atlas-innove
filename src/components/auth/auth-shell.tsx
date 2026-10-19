import Link from "next/link";
import type { ReactNode } from "react";

import { AtlasLogo } from "@/components/brand/logo";
import { Topo } from "@/components/brand/topo";
import { ThemeToggle } from "@/components/theme-toggle";

const chain = ["Instituição", "Programa", "Coorte", "Empreendimento", "Ondas", "Evidência"];

export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="relative min-h-[100dvh] bg-canvas text-ink">
      <div className="auth-tt"><ThemeToggle orientation="h" /></div>
      <div className="grid min-h-[100dvh] min-[900px]:grid-cols-2">
        <div className="relative isolate flex min-h-[7rem] overflow-hidden text-[#fff] min-[900px]:hidden" style={{ background: "linear-gradient(135deg, var(--grad-1), var(--grad-2))" }}>
          <Topo seed={7} n={9} w={700} h={200} cx={560} cy={60} className="topo absolute inset-0 -z-10 h-full w-full !text-[rgba(255,255,255,.25)]" />
          <p className="self-end px-5 pb-4 text-sm">Atlas Innove · acompanhamento longitudinal</p>
        </div>
        <main id="main-content" className="mx-auto flex w-full max-w-[35rem] flex-col justify-center gap-6 px-5 py-10 sm:px-10 min-[900px]:px-14">
          <Link href="/" aria-label="Atlas Innove" className="inline-flex w-fit"><AtlasLogo className="-ml-2 h-14 w-auto" /></Link>
          <div>
            <h1 className="text-[2.6rem] font-medium leading-none tracking-[-0.04em]">{title}</h1>
            <p className="mt-3 text-[0.95rem] leading-6 text-slate">{description}</p>
          </div>
          <div>{children}</div>
        </main>
        <aside className="relative isolate m-3 hidden flex-col justify-between overflow-hidden rounded-[28px] p-14 text-[#fff] min-[900px]:flex" style={{ background: "radial-gradient(120% 100% at 90% 0%, rgba(255,255,255,.22), transparent 55%), linear-gradient(135deg, var(--grad-1), var(--grad-2))", minHeight: "calc(100dvh - 1.5rem)" }}>
          <Topo seed={3} n={20} w={1000} h={1000} cx={650} cy={650} className="topo absolute inset-0 -z-10 h-full w-full !text-[rgba(255,255,255,.25)]" />
          <p className="text-sm text-[rgba(255,255,255,.9)]">Atlas Innove · acompanhamento longitudinal</p>
          <div>
            <p className="max-w-[14ch] text-[clamp(2.6rem,1.6rem+2.8vw,4rem)] font-medium leading-[1.02] tracking-[-0.04em]">O que acontece depois do edital.</p>
            <p className="mt-6 max-w-[44ch] text-[1.06rem] leading-relaxed text-[rgba(255,255,255,.9)]">Programas, equipes e empreendimentos acompanhados ao longo do tempo, com a evidência registrada em cada onda.</p>
          </div>
          <ol className="flex flex-wrap gap-2" aria-label="Como o acompanhamento se organiza">
            {chain.map((step, index) => <li key={step} className="inline-flex items-center gap-2 rounded-full bg-[rgba(255,255,255,.18)] px-3 py-1.5 text-xs font-medium"><span className="grid h-5 w-5 place-items-center rounded-full bg-[#fff] text-[0.68rem] font-semibold text-[#111114]">{index + 1}</span>{step}</li>)}
          </ol>
        </aside>
      </div>
    </div>
  );
}
