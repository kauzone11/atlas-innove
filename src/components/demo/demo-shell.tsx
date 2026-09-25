"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Activity, BarChart3, ChartNoAxesCombined, ChevronRight, ClipboardCheck, Compass, Files, FolderKanban, LayoutDashboard, Menu, Network, PanelLeft, UserRound, Users, X } from "lucide-react";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";

import { useDemoDialog } from "@/components/demo/demo-dialog";

type Perspective = "instituicao" | "participante";
type PreviewKey = "team" | "projects" | "evaluation" | "ranking" | "profile" | "network";

const previewContent: Record<PreviewKey, { title: string; description: string; icon: typeof Users; bullets: string[] }> = {
  team: { title: "Workspace da equipe", description: "Um espaço compartilhado para organizar membros, papéis, projetos, documentos, participação em programas e histórico de atividade.", icon: Users, bullets: ["Papéis e responsabilidades", "Documentos e histórico de atividade", "Participações em programas"] },
  projects: { title: "Projetos", description: "Projetos mantêm a identidade da iniciativa desenvolvida pela equipe e podem participar de diferentes oportunidades ao longo do tempo, sem serem confundidos com o empreendimento resultante.", icon: FolderKanban, bullets: ["Identidade própria da iniciativa", "Vínculos com oportunidades", "Histórico preservado"] },
  evaluation: { title: "Avaliação", description: "Estrutura critérios, fases, pareceres e notas do processo seletivo com histórico e rastreabilidade.", icon: ClipboardCheck, bullets: ["Critérios por edital", "Fases e pareceres", "Histórico auditável"] },
  ranking: { title: "Classificação do edital", description: "Apresenta a classificação das propostas a partir dos critérios e avaliações daquele edital. Não representa um ranking geral de startups ou pessoas.", icon: BarChart3, bullets: ["Classificação por chamada", "Critérios contextualizados", "Rastreabilidade da decisão"] },
  profile: { title: "Perfil de inovação", description: "Uma identidade profissional opt-in para reunir projetos, experiências, competências e participações verificadas no ecossistema de inovação.", icon: UserRound, bullets: ["Experiências verificadas", "Projetos e competências", "Visibilidade sob controle da pessoa"] },
  network: { title: "Rede e conexões", description: "Um espaço para descobrir pessoas, equipes e competências relacionadas ao ecossistema de inovação, sem prometer matching automático.", icon: Network, bullets: ["Busca por competências", "Contexto de participação", "Conexões com consentimento"] },
};

const institutionalNavigation = [
  { href: "/demo", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { href: "/demo/programas", label: "Programas", icon: Files },
  { href: "/demo/acompanhamentos", label: "Acompanhamentos", icon: ChartNoAxesCombined },
  { href: "/demo/oportunidades", label: "Oportunidades", icon: Compass },
];

const participantNavigation = [
  { href: "/demo", label: "Minha trajetória", icon: Activity, exact: true },
  { href: "/demo/programas", label: "Meus programas", icon: Files },
  { href: "/demo/oportunidades", label: "Oportunidades", icon: Compass },
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
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setPerspective(initialPerspective), [initialPerspective]);
  useEffect(() => setMobileOpen(false), [pathname]);
  function changePerspective(nextPerspective: Perspective) {
    setPerspective(nextPerspective);
    const params = new URLSearchParams(searchParams.toString());
    params.set("perspectiva", nextPerspective);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const navigation = perspective === "instituicao" ? institutionalNavigation : participantNavigation;
  const isParticipant = perspective === "participante";

  return (
    <div className="demo-shell min-h-screen">
      <a className="skip-link" href="#demo-main-content">Ir para o conteúdo</a>
      <div className="demo-layout">
        <aside className="demo-sidebar hidden lg:flex" aria-label="Navegação da demonstração">
          <DemoBrand />
          <div className="demo-sidebar-section">
            <p className="demo-sidebar-kicker">Perspectiva</p>
            <PerspectiveSwitch value={perspective} onChange={changePerspective} compact />
          </div>
          <nav className="demo-nav" aria-label={perspective === "instituicao" ? "Navegação institucional" : "Navegação do participante"}>
            <p className="demo-sidebar-kicker">{perspective === "instituicao" ? "Instituição" : "Participante"}</p>
            {navigation.map((item) => <DemoNavItem key={item.href + item.label} item={item} pathname={pathname} perspective={perspective} />)}
            <div className="demo-nav-divider" />
            {perspective === "instituicao" ? <>
              <PreviewNavButton icon={Users} label="Equipes" onClick={() => setPreview("team")} />
              <PreviewNavButton icon={ClipboardCheck} label="Avaliação" onClick={() => setPreview("evaluation")} />
              <PreviewNavButton icon={BarChart3} label="Ranking" onClick={() => setPreview("ranking")} />
            </> : <>
              <PreviewNavButton icon={FolderKanban} label="Meus projetos" onClick={() => setPreview("projects")} />
              <PreviewNavButton icon={Users} label="Minhas equipes" onClick={() => setPreview("team")} />
              <PreviewNavButton icon={UserRound} label="Perfil" onClick={() => setPreview("profile")} />
            </>}
          </nav>
          <div className="demo-sidebar-footer">
            <span className="demo-footnote-dot" aria-hidden="true" />
            <span>Ambiente demonstrativo</span>
          </div>
        </aside>

        <div className="demo-main">
          <header className="demo-topbar">
            <div className="flex min-w-0 items-center gap-3">
              <button ref={menuButtonRef} type="button" className="demo-icon-button lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu da demonstração" aria-expanded={mobileOpen}><Menu size={18} aria-hidden="true" /></button>
              <Link href={`/demo?perspectiva=${perspective}`} className="demo-mobile-brand lg:hidden"><span className="demo-mobile-brand-logo-wrap"><Image src="/brand/atlas-innove-lockup.svg" alt="Atlas Innove" width={250} height={83} priority className="demo-mobile-brand-logo" /></span></Link>
              <span className="demo-topbar-context hidden sm:inline">Demonstração pública · acompanhamento longitudinal</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="demo-status-chip"><span aria-hidden="true" /> Dados fictícios</span>
              <div className="hidden sm:block"><PerspectiveSwitch value={perspective} onChange={changePerspective} /></div>
              <div className="demo-avatar" aria-label={isParticipant ? "Marina Duarte" : "Visão institucional"}>
                {isParticipant ? <Image src="/demo/marina-duarte-profile.webp" alt="" width={32} height={32} className="demo-profile-image" /> : "VI"}
              </div>
            </div>
          </header>
          <div className="demo-mobile-switch sm:hidden"><PerspectiveSwitch value={perspective} onChange={changePerspective} /></div>
          <main id="demo-main-content" className="demo-content">{children}</main>
        </div>
      </div>

      {mobileOpen ? <MobileDemoNavigation perspective={perspective} navigation={navigation} pathname={pathname} onChangePerspective={changePerspective} onClose={() => { setMobileOpen(false); menuButtonRef.current?.focus(); }} onPreview={setPreview} /> : null}
      {preview ? <FeaturePreview preview={preview} onClose={() => setPreview(null)} /> : null}
    </div>
  );
}

function DemoBrand() {
  return <div className="demo-brand-block"><div className="demo-brand-logo-wrap"><Image src="/brand/atlas-innove-lockup.svg" alt="Atlas Innove" width={250} height={83} priority className="demo-brand-logo" /></div></div>;
}

function PerspectiveSwitch({ value, onChange, compact = false }: { value: Perspective; onChange: (value: Perspective) => void; compact?: boolean }) {
  return <div className={`demo-perspective-switch ${compact ? "demo-perspective-switch-compact" : ""}`} role="group" aria-label="Trocar perspectiva"><button type="button" className={value === "instituicao" ? "is-active" : ""} onClick={() => onChange("instituicao")} aria-pressed={value === "instituicao"}>Instituição</button><button type="button" className={value === "participante" ? "is-active" : ""} onClick={() => onChange("participante")} aria-pressed={value === "participante"}>Participante</button></div>;
}

function DemoNavItem({ item, pathname, perspective }: { item: (typeof institutionalNavigation)[number]; pathname: string; perspective: Perspective }) {
  const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
  const params = `?perspectiva=${perspective}`;
  const Icon = item.icon;
  return <Link href={`${item.href}${params}`} aria-current={active ? "page" : undefined} className={`demo-nav-item ${active ? "is-active" : ""}`}><Icon size={16} strokeWidth={active ? 2 : 1.7} aria-hidden="true" /><span>{item.label}</span>{active ? <ChevronRight size={13} className="ml-auto" aria-hidden="true" /> : null}</Link>;
}

function PreviewNavButton({ icon: Icon, label, onClick }: { icon: typeof Users; label: string; onClick: () => void }) {
  return <button type="button" className="demo-nav-item demo-nav-button" onClick={onClick}><Icon size={16} strokeWidth={1.7} aria-hidden="true" /><span>{label}</span><PanelLeft size={12} className="ml-auto opacity-50" aria-hidden="true" /></button>;
}

function MobileDemoNavigation({ perspective, navigation, pathname, onChangePerspective, onClose, onPreview }: { perspective: Perspective; navigation: typeof institutionalNavigation; pathname: string; onChangePerspective: (value: Perspective) => void; onClose: () => void; onPreview: (key: PreviewKey) => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDemoDialog({ open: true, onClose, surfaceRef: dialogRef });
  return <div className="demo-mobile-overlay"><button type="button" className="demo-mobile-scrim" onClick={onClose} aria-label="Fechar menu" /><div ref={dialogRef} className="demo-mobile-drawer" role="dialog" aria-modal="true" aria-label="Menu da demonstração"><div className="flex items-center justify-between border-b border-[#e9e4d9] px-5 py-4"><DemoBrand /><button type="button" className="demo-icon-button" onClick={onClose} aria-label="Fechar menu"><X size={18} aria-hidden="true" /></button></div><div className="p-4"><p className="demo-sidebar-kicker">Perspectiva</p><PerspectiveSwitch value={perspective} onChange={onChangePerspective} /><nav className="demo-nav mt-5" aria-label="Menu móvel">{navigation.map((item) => <DemoNavItem key={item.href + item.label} item={item} pathname={pathname} perspective={perspective} />)}<div className="demo-nav-divider" />{perspective === "instituicao" ? <><PreviewNavButton icon={Users} label="Equipes" onClick={() => { onPreview("team"); onClose(); }} /><PreviewNavButton icon={ClipboardCheck} label="Avaliação" onClick={() => { onPreview("evaluation"); onClose(); }} /><PreviewNavButton icon={BarChart3} label="Ranking" onClick={() => { onPreview("ranking"); onClose(); }} /></> : <><PreviewNavButton icon={FolderKanban} label="Meus projetos" onClick={() => { onPreview("projects"); onClose(); }} /><PreviewNavButton icon={Users} label="Minhas equipes" onClick={() => { onPreview("team"); onClose(); }} /><PreviewNavButton icon={UserRound} label="Perfil" onClick={() => { onPreview("profile"); onClose(); }} /></>}</nav></div><div className="mt-auto border-t border-[#e9e4d9] px-5 py-4 text-xs text-[#9e9688]">Ambiente demonstrativo</div></div></div>;
}

function FeaturePreview({ preview, onClose }: { preview: PreviewKey; onClose: () => void }) {
  const content = previewContent[preview];
  const Icon = content.icon;
  const surfaceRef = useRef<HTMLDivElement>(null);
  useDemoDialog({ open: true, onClose, surfaceRef });
  return <div className="demo-preview-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div ref={surfaceRef} className="demo-preview-surface" role="dialog" aria-modal="true" aria-labelledby="demo-preview-title" aria-describedby="demo-preview-description"><div className="flex items-start justify-between gap-4 border-b border-[#e9e4d9] px-6 py-5"><div className="flex min-w-0 items-center gap-3"><div className="demo-preview-icon"><Icon size={18} aria-hidden="true" /></div><div><p className="demo-eyebrow">Prévia de funcionalidade</p><h2 id="demo-preview-title" className="mt-1 text-[1.1rem] font-semibold tracking-[-0.025em] text-[#2e2b26]">{content.title}</h2></div></div><button type="button" className="demo-icon-button" onClick={onClose} aria-label="Fechar prévia"><X size={18} aria-hidden="true" /></button></div><div className="px-6 py-6"><p id="demo-preview-description" className="max-w-[44ch] text-sm leading-6 text-[#6f695f]">{content.description}</p><ul className="demo-preview-list">{content.bullets.map((bullet) => <li key={bullet}><span aria-hidden="true" />{bullet}</li>)}</ul><button type="button" className="demo-button-secondary mt-7 w-full sm:w-auto" onClick={onClose}>Fechar</button></div></div></div>;
}
