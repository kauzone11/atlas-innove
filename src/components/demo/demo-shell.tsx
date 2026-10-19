"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ArrowUpRight, BookMarked, CircleUserRound, ClipboardCheck, FolderKanban, Handshake, Landmark, Menu, Route, Telescope, Trophy, UsersRound, Waypoints, Workflow, X } from "lucide-react";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";

import { AtlasLogo, AtlasMark } from "@/components/brand/logo";
import { useDemoDialog } from "@/components/demo/demo-dialog";
import { PerspectiveToggle } from "@/components/demo/perspective-toggle";
import { ThemeToggle } from "@/components/theme-toggle";

type Perspective = "instituicao" | "participante";
type PreviewKey = "team" | "projects" | "evaluation" | "ranking" | "profile" | "network";

const previewContent: Record<PreviewKey, { title: string; description: string; icon: typeof Landmark; bullets: string[] }> = {
  team: { title: "Workspace da equipe", description: "Um espaço compartilhado para organizar membros, papéis, projetos, documentos, participação em programas e histórico de atividade.", icon: UsersRound, bullets: ["Papéis e responsabilidades", "Documentos e histórico de atividade", "Participações em programas"] },
  projects: { title: "Projetos", description: "Projetos mantêm a identidade da iniciativa desenvolvida pela equipe e podem participar de diferentes oportunidades ao longo do tempo, sem serem confundidos com o empreendimento resultante.", icon: FolderKanban, bullets: ["Identidade própria da iniciativa", "Vínculos com oportunidades", "Histórico preservado"] },
  evaluation: { title: "Avaliação", description: "Estrutura critérios, fases, pareceres e notas do processo seletivo com histórico e rastreabilidade.", icon: ClipboardCheck, bullets: ["Critérios por edital", "Fases e pareceres", "Histórico auditável"] },
  ranking: { title: "Classificação do edital", description: "Apresenta a classificação das propostas a partir dos critérios e avaliações daquele edital. Não representa um ranking geral de startups ou pessoas.", icon: Trophy, bullets: ["Classificação por chamada", "Critérios contextualizados", "Rastreabilidade da decisão"] },
  profile: { title: "Perfil de inovação", description: "Uma identidade profissional opt-in para reunir projetos, experiências, competências e participações verificadas no ecossistema de inovação.", icon: CircleUserRound, bullets: ["Experiências verificadas", "Projetos e competências", "Visibilidade sob controle da pessoa"] },
  network: { title: "Rede e conexões", description: "Um espaço para descobrir pessoas, equipes e competências relacionadas ao ecossistema de inovação, sem prometer matching automático.", icon: Waypoints, bullets: ["Busca por competências", "Contexto de participação", "Conexões com consentimento"] },
};

const institutionalNavigation = [
  { href: "/demo", label: "Visão geral", short: "Início", icon: Landmark, exact: true },
  { href: "/demo/programas", label: "Programas", icon: BookMarked },
  { href: "/demo/acompanhamentos", label: "Acompanhamentos", short: "Ondas", icon: Workflow },
  { href: "/demo/oportunidades", label: "Oportunidades", icon: Telescope },
];

const participantNavigation = [
  { href: "/demo", label: "Minha trajetória", short: "Trajetória", icon: Route, exact: true },
  { href: "/demo/programas", label: "Meus programas", short: "Programas", icon: BookMarked },
  { href: "/demo/oportunidades", label: "Oportunidades", icon: Telescope },
];

export function DemoShell({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="demo-shell min-h-screen" /> }><DemoShellContent>{children}</DemoShellContent></Suspense>;
}

function DemoShellContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialPerspective = searchParams.get("perspectiva") === "participante" ? "participante" : "instituicao";
  const [perspective, setPerspective] = useState<Perspective>(initialPerspective);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewKey | null>(null);
  const [welcomeOpen, setWelcomeOpen] = useState(() => pathname === "/demo");
  const welcomeHasBeenShownRef = useRef(pathname === "/demo");
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setPerspective(initialPerspective), [initialPerspective]);
  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    if (pathname === "/demo" && !welcomeHasBeenShownRef.current) {
      welcomeHasBeenShownRef.current = true;
      setWelcomeOpen(true);
    }
  }, [pathname]);
  function changePerspective(nextPerspective: Perspective) {
    setPerspective(nextPerspective);
    const params = new URLSearchParams(searchParams.toString());
    params.set("perspectiva", nextPerspective);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const navigation = perspective === "instituicao" ? institutionalNavigation : participantNavigation;
  const previews: Array<{ key: PreviewKey; label: string; icon: typeof Landmark }> = perspective === "instituicao"
    ? [{ key: "team", label: "Equipes", icon: UsersRound }, { key: "evaluation", label: "Avaliação", icon: ClipboardCheck }, { key: "ranking", label: "Classificação", icon: Trophy }]
    : [{ key: "projects", label: "Meus projetos", icon: FolderKanban }, { key: "team", label: "Minhas equipes", icon: Handshake }, { key: "profile", label: "Perfil", icon: CircleUserRound }];
  const homeHref = `/demo?perspectiva=${perspective}`;

  return (
    <div className="demo-shell app-shell">
      <a className="skip-link" href="#demo-main-content">Ir para o conteúdo</a>
      <div className="app-grid has-rail app-boot">
        <header className="topbar">
          <div className="tb-l">
            <button ref={menuButtonRef} type="button" className="ibtn pill show-lt-lg" onClick={() => setMobileOpen(true)} aria-label="Abrir menu da demonstração" aria-expanded={mobileOpen}><Menu size={20} aria-hidden="true" /></button>
            <Link href={homeHref} className="pill brandpill" aria-label="Atlas Innove, início da demonstração"><AtlasMark /><span className="brand-t">Atlas Innove</span></Link>
          </div>
          <nav className="pnav static hide-lt-lg" aria-label={perspective === "instituicao" ? "Navegação institucional" : "Navegação do participante"}>
            {navigation.map((item) => <DemoNavLink key={item.href + item.label} item={item} pathname={pathname} perspective={perspective} />)}
          </nav>
          <div className="tb-r">
            <span className="show-lt-lg"><ThemeToggle orientation="h" /></span>
            <Link href="/login" className="button-secondary hide-narrow">Entrar</Link>
            <Link href="/signup" className="button-primary">Criar conta</Link>
          </div>
        </header>

        <aside className="rail hide-lt-lg" aria-label="Atalhos da demonstração">
          <ThemeToggle orientation="v" />
          <PerspectiveToggle orientation="v" value={perspective} onChange={changePerspective} />
          <nav className="rail-nav" aria-label="Funções em prévia">
            {previews.map((item) => { const Icon = item.icon; return <button key={item.key} type="button" className="rl-btn" aria-label={`${item.label} (prévia)`} data-tip={item.label} onClick={() => setPreview(item.key)}><Icon size={20} aria-hidden="true" /></button>; })}
          </nav>
        </aside>

        <div className="app-main"><main id="demo-main-content" className="app-content demo-content" tabIndex={-1}>{children}</main></div>

        <nav className="tabbar" aria-label="Navegação da demonstração">
          {navigation.map((item) => { const Icon = item.icon; const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`); return <Link key={item.href + item.label} href={`${item.href}?perspectiva=${perspective}`} aria-current={active ? "page" : undefined}><Icon size={22} aria-hidden="true" /><span>{("short" in item ? item.short : item.label.split(" ")[0])}</span></Link>; })}
          <button type="button" onClick={() => setMobileOpen(true)} aria-haspopup="dialog" aria-label="Mais opções da demonstração"><UsersRound size={22} aria-hidden="true" /><span>Mais</span></button>
        </nav>
      </div>

      {mobileOpen ? <MobileDemoNavigation perspective={perspective} navigation={navigation} previews={previews} pathname={pathname} onChangePerspective={changePerspective} onClose={() => { setMobileOpen(false); menuButtonRef.current?.focus(); }} onPreview={setPreview} /> : null}
      {preview ? <FeaturePreview preview={preview} onClose={() => setPreview(null)} /> : null}
      {welcomeOpen ? <WelcomeOverlay onClose={() => setWelcomeOpen(false)} onSelectPerspective={(nextPerspective) => { changePerspective(nextPerspective); setWelcomeOpen(false); }} /> : null}
    </div>
  );
}

function DemoNavLink({ item, pathname, perspective }: { item: (typeof institutionalNavigation)[number]; pathname: string; perspective: Perspective }) {
  const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
  return <Link href={`${item.href}?perspectiva=${perspective}`} aria-current={active ? "page" : undefined}>{item.label}</Link>;
}

function MobileDemoNavigation({ perspective, navigation, previews, pathname, onChangePerspective, onClose, onPreview }: { perspective: Perspective; navigation: typeof institutionalNavigation; previews: Array<{ key: PreviewKey; label: string; icon: typeof Landmark }>; pathname: string; onChangePerspective: (value: Perspective) => void; onClose: () => void; onPreview: (key: PreviewKey) => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDemoDialog({ open: true, onClose, surfaceRef: dialogRef });
  return <div className="fixed inset-0 z-[70] flex" style={{ background: "var(--scrim)", backdropFilter: "blur(4px)" }}>
    <button type="button" className="absolute inset-0 cursor-default" tabIndex={-1} onClick={onClose} aria-label="Fechar menu" />
    <div ref={dialogRef} className="relative flex h-full w-[min(20rem,calc(100%-2.75rem))] flex-col overflow-y-auto bg-surface text-ink" role="dialog" aria-modal="true" aria-label="Menu da demonstração" style={{ borderRadius: "0 28px 28px 0", boxShadow: "var(--shadow-pop)", animation: "drawer .24s ease-out" }}>
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4"><Link href={`/demo?perspectiva=${perspective}`} aria-label="Atlas Innove" onClick={onClose}><AtlasLogo className="h-11 w-auto" /></Link><span className="flex items-center gap-1"><ThemeToggle orientation="h" /><button type="button" className="ibtn" onClick={onClose} aria-label="Fechar menu"><X size={20} aria-hidden="true" /></button></span></div>
      <div className="space-y-3 px-4 pt-2"><p className="eyebrow">Perspectiva</p><PerspectiveSwitch value={perspective} onChange={onChangePerspective} /></div>
      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Menu móvel">
        {navigation.map((item) => { const Icon = item.icon; const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`); return <Link key={item.href + item.label} href={`${item.href}?perspectiva=${perspective}`} className="nav-link" aria-current={active ? "page" : undefined}><Icon size={18} aria-hidden="true" />{item.label}</Link>; })}
        <hr className="my-2 border-0 border-t border-line" />
        {previews.map((item) => { const Icon = item.icon; return <button key={item.key} type="button" className="nav-link" onClick={() => { onPreview(item.key); onClose(); }}><Icon size={18} aria-hidden="true" />{item.label}</button>; })}
      </nav>
      <div className="border-t border-line px-5 py-4 text-xs text-slate">Ambiente demonstrativo</div>
    </div>
  </div>;
}

function PerspectiveSwitch({ value, onChange }: { value: Perspective; onChange: (value: Perspective) => void }) {
  return <div className="persp" role="group" aria-label="Trocar perspectiva"><button type="button" aria-pressed={value === "instituicao"} aria-current={value === "instituicao" ? "page" : undefined} onClick={() => onChange("instituicao")}>Instituição</button><button type="button" aria-pressed={value === "participante"} aria-current={value === "participante" ? "page" : undefined} onClick={() => onChange("participante")}>Participante</button></div>;
}

function WelcomeOverlay({ onClose, onSelectPerspective }: { onClose: () => void; onSelectPerspective: (perspective: Perspective) => void }) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  useDemoDialog({ open: true, onClose, surfaceRef });
  return <div className="demo-welcome-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div ref={surfaceRef} className="demo-welcome-surface" role="dialog" aria-modal="true" aria-labelledby="demo-welcome-title" aria-describedby="demo-welcome-description"><header className="demo-welcome-header"><Image src="/brand/atlas-innove-lockup.svg" alt="Atlas Innove" width={180} height={60} className="demo-welcome-logo" /><span className="demo-welcome-kicker">Demonstração pública</span><button type="button" className="demo-icon-button demo-welcome-close" onClick={onClose} aria-label="Fechar boas-vindas"><X size={18} aria-hidden="true" /></button></header><div className="demo-welcome-body"><div className="demo-welcome-intro"><p className="demo-eyebrow">Uma leitura em duas perspectivas</p><h2 id="demo-welcome-title">Bem-vindo ao Atlas Innove</h2><p className="demo-welcome-lede">Uma plataforma para conectar programas de fomento, iniciativas inovadoras e acompanhamento ao longo do tempo.</p><p id="demo-welcome-description" className="demo-welcome-description">Nesta demonstração, você pode explorar a experiência sob as perspectivas de Instituição e Participante. Metadados públicos de programas podem ser reais; pessoas, empreendimentos e resultados apresentados são fictícios.</p></div><div className="demo-welcome-perspectives" aria-label="Perspectivas disponíveis"><button type="button" className="demo-welcome-perspective" onClick={() => onSelectPerspective("instituicao")}><span className="demo-welcome-perspective-icon"><Landmark size={19} strokeWidth={1.8} aria-hidden="true" /></span><span className="demo-welcome-perspective-copy"><strong>Instituição</strong><small>Acompanhe programas, coortes e evidências ao longo do tempo.</small></span><ArrowUpRight size={15} aria-hidden="true" /></button><button type="button" className="demo-welcome-perspective" onClick={() => onSelectPerspective("participante")}><span className="demo-welcome-perspective-icon is-purple"><Route size={19} strokeWidth={1.8} aria-hidden="true" /></span><span className="demo-welcome-perspective-copy"><strong>Participante</strong><small>Explore a trajetória de uma persona demonstrativa no ecossistema de inovação.</small></span><ArrowUpRight size={15} aria-hidden="true" /></button></div></div><footer className="demo-welcome-footer"><p><span aria-hidden="true" /> Ambiente somente para exploração</p><button type="button" data-autofocus className="demo-button-primary" onClick={onClose}>Explorar demonstração <ArrowRight size={15} aria-hidden="true" /></button></footer></div></div>;
}

function FeaturePreview({ preview, onClose }: { preview: PreviewKey; onClose: () => void }) {
  const content = previewContent[preview];
  const Icon = content.icon;
  const surfaceRef = useRef<HTMLDivElement>(null);
  useDemoDialog({ open: true, onClose, surfaceRef });
  return <div className="demo-preview-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div ref={surfaceRef} className="demo-preview-surface" role="dialog" aria-modal="true" aria-labelledby="demo-preview-title" aria-describedby="demo-preview-description"><div className="flex items-start justify-between gap-4 border-b border-[#e9e4d9] px-6 py-5"><div className="flex min-w-0 items-center gap-3"><div className="demo-preview-icon"><Icon size={18} aria-hidden="true" /></div><div><p className="demo-eyebrow">Prévia de funcionalidade</p><h2 id="demo-preview-title" className="mt-1 text-[1.1rem] font-semibold tracking-[-0.025em] text-[#2e2b26]">{content.title}</h2></div></div><button type="button" className="demo-icon-button" onClick={onClose} aria-label="Fechar prévia"><X size={18} aria-hidden="true" /></button></div><div className="px-6 py-6"><p id="demo-preview-description" className="max-w-[44ch] text-sm leading-6 text-[#6f695f]">{content.description}</p><ul className="demo-preview-list">{content.bullets.map((bullet) => <li key={bullet}><span aria-hidden="true" />{bullet}</li>)}</ul><button type="button" className="demo-button-secondary mt-7 w-full sm:w-auto" onClick={onClose}>Fechar</button></div></div></div>;
}
