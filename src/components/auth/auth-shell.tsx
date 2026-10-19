import Link from "next/link";
import type { ReactNode } from "react";

import { AtlasLogo } from "@/components/brand/logo";
import { Topo } from "@/components/brand/topo";
import { ThemeToggle } from "@/components/theme-toggle";

const chain = ["Instituição", "Programa", "Coorte", "Empreendimento", "Ondas", "Evidência"];

export function AuthShell({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description: string; children: ReactNode }) {
  return (
    <div className="relative min-h-[100dvh] bg-canvas text-ink">
      <div className="auth-tt"><ThemeToggle orientation="h" /></div>
      <div className="grid min-h-[100dvh] min-[900px]:grid-cols-2">
        <div className="relative isolate flex min-h-[14rem] flex-col justify-end overflow-hidden text-[#fff] min-[900px]:hidden" style={{ background: "linear-gradient(135deg, var(--grad-1), var(--grad-2))" }}>
          <Topo seed={7} n={9} w={700} h={200} cx={560} cy={60} className="topo absolute inset-0 -z-10 h-full w-full !text-[rgba(255,255,255,.25)]" />
          <div className="flex flex-col gap-3 px-5 pb-14 pt-16">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[rgba(255,255,255,.85)]">Atlas Innove · acompanhamento longitudinal</p>
            <p className="max-w-[18ch] text-[1.9rem] font-medium leading-[1.08] tracking-[-0.03em]">O que acontece depois do edital.</p>
          </div>
        </div>
        <main id="main-content" className="mx-auto flex w-full max-w-[35rem] flex-col justify-center gap-6 px-5 py-10 sm:px-10 min-[900px]:px-14 max-[899px]:relative max-[899px]:z-10 max-[899px]:-mt-8 max-[899px]:justify-start max-[899px]:rounded-t-[28px] max-[899px]:bg-canvas max-[899px]:pt-9 max-[899px]:shadow-[0_-10px_30px_rgba(17,17,20,.08)]">
          <Link href="/" aria-label="Atlas Innove" className="inline-flex w-fit"><AtlasLogo className="-ml-2 h-14 w-auto" /></Link>
          <div>
            {eyebrow ? <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate min-[900px]:hidden">{eyebrow}</p> : null}
            <h1 className="text-[2.6rem] font-medium leading-none tracking-[-0.04em]">{title}</h1>
            <p className="mt-3 text-[0.95rem] leading-6 text-slate">{description}</p>
          </div>
          <div>{children}</div>
          <p className="mt-4 text-xs text-slate min-[900px]:hidden">© {new Date().getFullYear()} Atlas Innove</p>
        </main>
        <aside className="relative isolate m-3 hidden flex-col justify-between overflow-hidden rounded-[28px] p-14 text-[#fff] min-[900px]:flex" style={{ background: "radial-gradient(120% 100% at 90% 0%, rgba(255,255,255,.22), transparent 55%), linear-gradient(135deg, var(--grad-1), var(--grad-2))", minHeight: "calc(100dvh - 1.5rem)" }}>
          <Topo seed={3} n={20} w={1000} h={1000} cx={650} cy={650} className="topo absolute inset-0 -z-10 h-full w-full !text-[rgba(255,255,255,.25)]" />
          <p className="text-sm text-[rgba(255,255,255,.9)]">Atlas Innove · acompanhamento longitudinal</p>
          <div>
            <p className="max-w-[14ch] text-[clamp(2.6rem,1.6rem+2.8vw,4rem)] font-medium leading-[1.02] tracking-[-0.04em]">O que acontece depois do edital.</p>
            <p className="mt-6 max-w-[44ch] text-[1.06rem] leading-relaxed text-[rgba(255,255,255,.9)]">Programas, equipes e empreendimentos acompanhados ao longo do tempo, com a evidência registrada em cada onda.</p>
          </div>
          <ol className="flex flex-wrap gap-2" aria-label="Como o acompanhamento se organiza">
            {chain.map((step, index) => <li key={step} className="inline-flex items-center gap-2 rounded-full bg-[rgba(255,255,255,.18)] px-3 py-1.5 text-xs font-medium"><span className="grid h-5 w-5 place-items-center rounded-full bg-[#fff] text-xs font-semibold text-[#111114]">{index + 1}</span>{step}</li>)}
          </ol>
        </aside>
      </div>
    </div>
  );
}
