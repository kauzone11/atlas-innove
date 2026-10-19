"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Bookmark, BriefcaseBusiness, Building2, ChartNoAxesCombined, ChevronDown, ClipboardCheck, Compass, FolderKanban, House, Layers3, LogOut, Menu, MessageSquare, Network, Route, Search, SlidersHorizontal, UserRound, Users, UsersRound, Workflow, X, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { AtlasLogo, AtlasMark } from "@/components/brand/logo";
import { GlobalSearch } from "@/components/global-search";
import { Avatar } from "@/components/media/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import type { MediaDto } from "@/lib/media/types";

type AppShellProps = { children: React.ReactNode; organizationName?: string; userName: string; avatarMedia?: MediaDto | null; hasOrganization: boolean; unreadNotifications: number; isPlatformAdmin?: boolean };
type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean; short?: string };

const institutionTop: NavItem[] = [
  { href: "/app", label: "Visão geral", icon: House, exact: true, short: "Início" },
  { href: "/app/programs", label: "Programas", icon: FolderKanban },
  { href: "/app/execution", label: "Execução", icon: ClipboardCheck },
  { href: "/app/follow-ups", label: "Acompanhamentos", icon: Workflow, short: "Ondas" },
  { href: "/app/analytics", label: "Análises", icon: ChartNoAxesCombined },
];
const institutionRail: NavItem[] = [
  { href: "/app/ventures", label: "Empreendimentos", icon: BriefcaseBusiness },
  { href: "/app/opportunities", label: "Oportunidades externas", icon: Compass },
  { href: "/app/organizations", label: "Organizações", icon: Building2 },
  { href: "/app/members", label: "Membros", icon: Users },
  { href: "/app/settings", label: "Configurações", icon: SlidersHorizontal },
];
const personalTop: NavItem[] = [
  { href: "/app/personal/feed", label: "Início", icon: House },
  { href: "/app/personal", label: "Trajetória", icon: Route, exact: true },
  { href: "/app/personal/programs", label: "Programas", icon: FolderKanban },
  { href: "/app/personal/projects", label: "Projetos", icon: Layers3 },
  { href: "/app/personal/opportunities", label: "Oportunidades", icon: Compass, short: "Chamadas" },
  { href: "/app/personal/network", label: "Rede", icon: Network },
];
const personalRail: NavItem[] = [
  { href: "/app/personal/teams", label: "Equipes", icon: UsersRound },
  { href: "/app/personal/institutions", label: "Instituições seguidas", icon: Building2 },
  { href: "/app/personal/saved-posts", label: "Publicações salvas", icon: Bookmark },
  { href: "/app/personal/profile", label: "Perfil", icon: UserRound },
];
const personalTabs = [personalTop[0], personalTop[1], personalTop[4], personalTop[5]];
const institutionTabs = [institutionTop[0], institutionTop[1], institutionTop[3], institutionTop[4]];

const FOCUSABLE = 'a[href], button:not([tabindex="-1"]):not(:disabled)';

function isPersonalPath(pathname: string) { return pathname.startsWith("/app/personal") || pathname.startsWith("/app/messages"); }
function isActive(item: NavItem, pathname: string) { return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`); }

export function AppShell({ children, organizationName, userName, avatarMedia, hasOrganization, unreadNotifications, isPlatformAdmin }: AppShellProps) {
  const pathname = usePathname();
  const personal = isPersonalPath(pathname);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeMobileNavigation = useCallback(() => {
    setMobileOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [mobileOpen]);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const top = personal ? personalTop : hasOrganization ? institutionTop : institutionTop.slice(0, 1);
  const rail = personal ? personalRail : hasOrganization ? institutionRail : [institutionRail[2]];
  const tabs = personal ? personalTabs : hasOrganization ? institutionTabs : [institutionTop[0], institutionRail[2]];
  const brandHref = personal ? "/app/personal/feed" : "/app";

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Ir para o conteúdo</a>
      <div className="app-grid has-rail app-boot">
        <header className="topbar">
          <div className="tb-l">
            <button ref={menuButtonRef} type="button" className="ibtn pill show-lt-lg" onClick={() => setMobileOpen(true)} aria-label="Abrir menu de navegação" aria-expanded={mobileOpen} aria-haspopup="dialog"><Menu size={20} aria-hidden="true" /></button>
            <Link href={brandHref} className="pill brandpill" aria-label="Atlas Innove, início"><AtlasMark /><span className="brand-t">Atlas Innove</span></Link>
          </div>
          <PillNav items={top} pathname={pathname} label={personal ? "Seções do participante" : "Seções da organização"} />
          <div className="tb-r">
            <span className="pill actpill">
              <button type="button" className="ibtn hide-narrow" onClick={() => setSearchOpen(true)} aria-label="Buscar" aria-keyshortcuts="Control+K Meta+K"><Search size={19} aria-hidden="true" /></button>
              <Link href="/app/messages" className="ibtn" aria-label="Mensagens"><MessageSquare size={19} aria-hidden="true" /></Link>
              <Link href="/app/notifications" className="ibtn" aria-label={`Notificações${unreadNotifications ? `, ${unreadNotifications} não lidas` : ""}`}><Bell size={19} aria-hidden="true" />{unreadNotifications > 0 ? <span className="dot" aria-hidden="true">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span> : null}</Link>
            </span>
            <span className="show-lt-lg"><ThemeToggle orientation="h" /></span>
            <AccountControl userName={userName} avatarMedia={avatarMedia} organizationName={organizationName} personal={personal} isPlatformAdmin={isPlatformAdmin} />
          </div>
        </header>

        <aside className="rail hide-lt-lg" aria-label="Atalhos">
          <ThemeToggle orientation="v" />
          <nav className="rail-nav" aria-label="Atalhos">{rail.map((item) => <RailLink key={item.href} item={item} pathname={pathname} />)}</nav>
          <div className="rail-bot">
            <Link className="rl-btn" href={hasOrganization ? "/app" : "/app/organizations"} aria-label="Instituição" data-tip="Perspectiva Instituição" aria-current={!personal ? "page" : undefined}><Building2 size={20} aria-hidden="true" /></Link>
            <Link className="rl-btn" href="/app/personal/feed" aria-label="Participante" data-tip="Perspectiva Participante" aria-current={personal ? "page" : undefined}><UserRound size={20} aria-hidden="true" /></Link>
            <LogoutRailButton />
          </div>
        </aside>

        <div className="app-main"><main id="main-content" className="app-content" tabIndex={-1}>{children}</main></div>

        <nav className="tabbar" aria-label="Navegação principal">
          {tabs.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} aria-current={isActive(item, pathname) ? "page" : undefined}><Icon size={22} aria-hidden="true" /><span>{item.short ?? item.label}</span></Link>; })}
          <button type="button" onClick={() => setMobileOpen(true)} aria-haspopup="dialog" aria-label="Mais opções de navegação"><Menu size={22} aria-hidden="true" /><span>Mais</span></button>
        </nav>
      </div>

      {mobileOpen ? <MobileNavigation pathname={pathname} personal={personal} organizationName={organizationName} hasOrganization={hasOrganization} userName={userName} avatarMedia={avatarMedia} isPlatformAdmin={isPlatformAdmin} onClose={closeMobileNavigation} /> : null}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

function PillNav({ items, pathname, label }: { items: NavItem[]; pathname: string; label: string }) {
  const navRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const previous = useRef<{ left: number; width: number } | null>(null);

  const place = useCallback((animate: boolean) => {
    const nav = navRef.current; const indicator = indicatorRef.current;
    if (!nav || !indicator) return;
    const current = nav.querySelector<HTMLElement>('[aria-current="page"]');
    if (!current) { indicator.style.opacity = "0"; previous.current = null; return; }
    const left = current.offsetLeft; const width = current.offsetWidth;
    indicator.style.cssText = `left:${left}px;width:${width}px;opacity:1`;
    const before = previous.current;
    previous.current = { left, width };
    if (animate && before && (before.left !== left || before.width !== width) && !window.matchMedia("(prefers-reduced-motion: reduce)").matches && indicator.animate) {
      indicator.animate([{ transform: `translateX(${before.left - left}px)`, width: `${before.width}px` }, { transform: "translateX(0)", width: `${width}px` }], { duration: 340, easing: "cubic-bezier(.3,.7,.2,1)" });
    }
  }, []);

  useLayoutEffect(() => { place(true); }, [pathname, place, items]);
  useEffect(() => {
    const onResize = () => place(false);
    window.addEventListener("resize", onResize);
    document.fonts?.ready.then(() => place(false)).catch(() => undefined);
    return () => window.removeEventListener("resize", onResize);
  }, [place]);

  return (
    <nav ref={navRef} className="pnav hide-lt-lg" aria-label={label}>
      <span ref={indicatorRef} className="pnav-ind" aria-hidden="true" />
      {items.map((item) => <Link key={item.href} href={item.href} aria-current={isActive(item, pathname) ? "page" : undefined}>{item.label}</Link>)}
    </nav>
  );
}

function RailLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  return <Link href={item.href} className="rl-btn" aria-label={item.label} data-tip={item.label} aria-current={isActive(item, pathname) ? "page" : undefined}><Icon size={20} aria-hidden="true" /></Link>;
}

function LogoutRailButton() {
  const router = useRouter();
  return <button type="button" className="rl-btn" aria-label="Sair" data-tip="Sair" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }}><LogOut size={20} aria-hidden="true" /></button>;
}

function AccountControl({ userName, avatarMedia, organizationName, personal, isPlatformAdmin, placement = "top" }: { userName: string; avatarMedia?: MediaDto | null; organizationName?: string; personal: boolean; isPlatformAdmin?: boolean; placement?: "top" | "bottom" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const context = personal ? "Participante" : organizationName ?? "Sem organização";

  useEffect(() => {
    if (!open) return;
    const items = () => Array.from(controlRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    items()[0]?.focus();
    function handlePointerDown(event: PointerEvent) { if (!controlRef.current?.contains(event.target as Node)) setOpen(false); }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); triggerRef.current?.focus(); return; }
      if (event.key === "Tab") { setOpen(false); return; }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const list = items(); if (!list.length) return;
      const index = list.indexOf(document.activeElement as HTMLElement);
      const next = event.key === "ArrowDown" ? (index + 1) % list.length : (index - 1 + list.length) % list.length;
      list[next]?.focus();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => { document.removeEventListener("pointerdown", handlePointerDown); document.removeEventListener("keydown", handleKeyDown); };
  }, [open]);

  const close = () => setOpen(false);
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return <div ref={controlRef} className="account-menu">
    <button ref={triggerRef} type="button" className="userbtn" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="menu" aria-label={`Abrir menu de ${userName}`}>
      <Avatar name={userName} media={avatarMedia} size="medium" />
      <span className="up-t"><b>{userName}</b><small>{context}</small></span>
      <span className="up-c"><ChevronDown size={14} aria-hidden="true" /></span>
    </button>
    {open ? <div className="account-menu-popover" role="menu" aria-label={`Menu da conta de ${userName}`} style={placement === "bottom" ? { top: "auto", bottom: "calc(100% + 8px)", right: "auto", left: 0 } : undefined}>
      <div className="px-3.5 pb-1.5 pt-2.5"><p className="truncate text-sm font-semibold text-ink">{userName}</p><p className="truncate text-xs text-slate">{context}</p></div>
      <Link href="/app/personal/profile" role="menuitem" className="menu-item" onClick={close}><UserRound size={17} aria-hidden="true" /> Meu perfil</Link>
      <Link href="/app/personal/saved-posts" role="menuitem" className="menu-item" onClick={close}><Bookmark size={17} aria-hidden="true" /> Publicações salvas</Link>
      <Link href="/app/personal/profile/edit" role="menuitem" className="menu-item" onClick={close}><SlidersHorizontal size={17} aria-hidden="true" /> Editar perfil e privacidade</Link>
      {isPlatformAdmin ? <Link href="/app/platform/safety" role="menuitem" className="menu-item" onClick={close}><Network size={17} aria-hidden="true" /> Revisar denúncias</Link> : null}
      <hr className="my-1.5 border-0 border-t border-line" />
      <Link href="/app/organizations" role="menuitem" className="menu-item" onClick={close}><Building2 size={17} aria-hidden="true" /> Trocar organização</Link>
      <button type="button" role="menuitem" className="menu-item danger" onClick={logout}><LogOut size={17} aria-hidden="true" /> Sair</button>
    </div> : null}
  </div>;
}

function MobileNavigation({ pathname, personal, organizationName, hasOrganization, userName, avatarMedia, isPlatformAdmin, onClose }: { pathname: string; personal: boolean; organizationName?: string; hasOrganization: boolean; userName: string; avatarMedia?: MediaDto | null; isPlatformAdmin?: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const groups = personal
    ? [{ label: "Meu espaço", items: [...personalTop, ...personalRail.filter((item) => item.href !== "/app/personal/profile"), personalRail[3]] }]
    : [{ label: "Espaço", items: hasOrganization ? [...institutionTop, institutionRail[0], institutionRail[1]] : [institutionTop[0]] }, { label: "Administração", items: hasOrganization ? institutionRail.slice(2) : [institutionRail[2]] }];

  useEffect(() => {
    const mobileDialog = dialogRef.current;
    if (!mobileDialog) return;
    mobileDialog.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { if (mobileDialog!.querySelector('[role="menu"]')) return; event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab") return;
      const elements = Array.from(mobileDialog!.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!elements.length) return;
      const first = elements[0]; const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return <div className="fixed inset-0 z-50 flex lg:hidden" role="presentation" style={{ background: "var(--scrim)", backdropFilter: "blur(4px)", animation: "fade .18s ease-out" }}>
    <button type="button" className="absolute inset-0 cursor-default" tabIndex={-1} onClick={onClose} aria-label="Fechar menu de navegação" />
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Menu de navegação" className="relative flex h-full w-[min(20rem,calc(100%-2.75rem))] flex-col overflow-y-auto bg-surface text-ink" style={{ borderRadius: "0 28px 28px 0", boxShadow: "var(--shadow-pop)", animation: "drawer .24s ease-out" }}>
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
        <Link href={personal ? "/app/personal/feed" : "/app"} aria-label="Atlas Innove" onClick={onClose} className="inline-flex"><AtlasLogo className="h-11 w-auto" /></Link>
        <span className="flex items-center gap-1"><ThemeToggle orientation="h" /><button type="button" className="ibtn" onClick={onClose} aria-label="Fechar menu de navegação"><X size={20} aria-hidden="true" /></button></span>
      </div>
      <div className="space-y-3 px-4 pt-2">
        <p className="eyebrow">Perspectiva</p>
        <div className="persp" role="group" aria-label="Trocar perspectiva">
          <Link href={hasOrganization ? "/app" : "/app/organizations"} aria-current={!personal ? "page" : undefined}>Instituição</Link>
          <Link href="/app/personal/feed" aria-current={personal ? "page" : undefined}>Participante</Link>
        </div>
        {!personal ? <Link href="/app/organizations" className="orgchip" aria-label={`Organização ativa: ${organizationName ?? "nenhuma"}. Trocar.`}><span className="grid h-8 w-8 flex-none place-items-center rounded-[14px] bg-surface text-xs font-semibold"><Building2 size={16} aria-hidden="true" /></span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{organizationName ?? "Sem organização ativa"}</b><span className="block truncate text-xs text-slate">Trocar organização</span></span></Link> : null}
      </div>
      <nav className="flex-1 space-y-3 px-3 py-4" aria-label="Navegação completa">
        {groups.map((group) => <div key={group.label}><p className="eyebrow px-3 pb-1.5">{group.label}</p>{group.items.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} className="nav-link" aria-current={isActive(item, pathname) ? "page" : undefined} onClick={onClose}><Icon size={18} aria-hidden="true" />{item.label}</Link>; })}</div>)}
      </nav>
      <div className="border-t border-line p-4"><AccountControl userName={userName} avatarMedia={avatarMedia} organizationName={organizationName} personal={personal} isPlatformAdmin={isPlatformAdmin} placement="bottom" /></div>
    </div>
  </div>;
}
