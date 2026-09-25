"use client";

import Link from "next/link";
import { BriefcaseBusiness, Building2, ChevronDown, FolderKanban, LineChart, Menu, Settings, Users, X, type LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { LogoutButton } from "@/components/logout-button";

type AppShellProps = { children: React.ReactNode; organizationName?: string; userName: string; hasOrganization: boolean };
type NavigationItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

const workspaceNavigation: NavigationItem[] = [
  { href: "/app", label: "Visão geral", icon: Building2, exact: true },
  { href: "/app/programs", label: "Programas", icon: FolderKanban },
  { href: "/app/follow-ups", label: "Acompanhamentos", icon: LineChart },
  { href: "/app/ventures", label: "Empreendimentos", icon: BriefcaseBusiness },
  { href: "/app/team", label: "Equipe", icon: Users },
];

const administrationNavigation: NavigationItem[] = [
  { href: "/app/organizations", label: "Organizações", icon: Building2 },
  { href: "/app/settings", label: "Configurações", icon: Settings },
];

export function AppShell({ children, organizationName, userName, hasOrganization }: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [mobileOpen]);

  const closeMobile = () => {
    setMobileOpen(false);
    window.requestAnimationFrame(() => menuButtonRef.current?.focus());
  };

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a className="skip-link" href="#main-content">Ir para o conteúdo</a>
      <div className="grid min-h-screen lg:grid-cols-[15.5rem_minmax(0,1fr)]">
        <aside className="hidden border-r border-line bg-white lg:flex lg:flex-col" aria-label="Navegação principal">
          <ShellBrand organizationName={organizationName} />
          <div className="flex-1 px-3 py-5"><ShellNavigation pathname={pathname} hasOrganization={hasOrganization} /></div>
          <div className="px-5 pb-5"><p className="truncate text-[0.5625rem] font-medium text-faint">{organizationName ?? "Nenhuma organização ativa"}</p></div>
        </aside>

        <div className="app-main">
          <header className="sticky top-0 z-20 flex min-h-[4.375rem] items-center justify-between gap-4 border-b border-line bg-white px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button ref={menuButtonRef} type="button" className="button-secondary px-3 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu de navegação" aria-expanded={mobileOpen}>
                <Menu size={18} aria-hidden="true" />
              </button>
              <Link href="/app" className="truncate text-[0.9375rem] font-semibold tracking-[-0.02em] text-ink lg:hidden">Atlas Innove</Link>
              <span className="hidden truncate text-xs text-slate sm:block">{organizationName ?? "Selecione uma organização"}</span>
            </div>
            <AccountControl userName={userName} organizationName={organizationName} />
          </header>
          <main id="main-content" className="app-content">{children}</main>
        </div>
      </div>

      {mobileOpen ? <MobileNavigation pathname={pathname} organizationName={organizationName} hasOrganization={hasOrganization} userName={userName} onClose={closeMobile} /> : null}
    </div>
  );
}

function ShellBrand({ organizationName }: { organizationName?: string }) {
  return <div className="px-5 pb-5 pt-6"><Link href="/app" className="block text-[1rem] font-semibold tracking-[-0.025em] text-ink">Atlas Innove</Link><p className="mt-1 truncate text-[0.5625rem] text-slate">{organizationName ?? "Nenhuma organização ativa"}</p></div>;
}

function ShellNavigation({ pathname, hasOrganization }: { pathname: string; hasOrganization: boolean }) {
  const workspaceItems = hasOrganization ? workspaceNavigation : [workspaceNavigation[0]];
  return <nav aria-label="Navegação da organização" className="space-y-1"><div className="space-y-1">{workspaceItems.map((item) => <NavItem key={item.href} item={item} pathname={pathname} />)}</div><div className="my-4 border-t border-line" /><div className="space-y-1">{administrationNavigation.map((item) => <NavItem key={item.href} item={item} pathname={pathname} />)}</div></nav>;
}

function NavItem({ item, pathname }: { item: NavigationItem; pathname: string }) {
  const Icon = item.icon;
  const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
  return <Link href={item.href} aria-current={active ? "page" : undefined} className={`flex min-h-10 items-center gap-2.5 rounded-[0.6875rem] px-2.5 text-xs font-medium transition-[background-color,color] duration-150 ${active ? "bg-surface-selected font-semibold text-ink" : "text-slate hover:bg-surface-subtle hover:text-ink"}`}><Icon size={16} strokeWidth={active ? 2 : 1.7} className={active ? "text-ink" : undefined} aria-hidden="true" /><span>{item.label}</span></Link>;
}

function AccountControl({ userName, organizationName }: { userName: string; organizationName?: string }) {
  const [open, setOpen] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);
  const initials = userName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "AI";

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!controlRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => { document.removeEventListener("pointerdown", handlePointerDown); document.removeEventListener("keydown", handleKeyDown); };
  }, [open]);

  return <div ref={controlRef} className="account-menu">
    <button type="button" className="flex min-h-10 items-center gap-2 rounded-[0.6875rem] px-1.5 text-left transition-[background-color] hover:bg-surface-subtle" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="dialog" aria-label={`Abrir menu de ${userName}`}>
      <span className="profile-monogram h-8 w-8 rounded-full bg-surface-selected text-data-purple" aria-hidden="true">{initials}</span>
      <span className="hidden max-w-36 truncate text-xs font-medium text-ink sm:block">{userName}</span>
      <ChevronDown size={14} className="shrink-0 text-slate" aria-hidden="true" />
    </button>
    {open ? <div className="account-menu-popover !bottom-auto !top-[calc(100%+0.6rem)]" role="group" aria-label="Menu da conta">
      <div className="border-b border-line px-2 pb-3 pt-1"><p className="truncate text-xs font-semibold text-ink">{userName}</p><p className="mt-1 truncate text-[0.6875rem] text-slate">{organizationName ?? "Nenhuma organização ativa"}</p></div>
      <Link href="/app/organizations" className="mt-1 flex min-h-10 items-center gap-2 rounded-md px-2 text-xs text-slate hover:bg-surface-subtle hover:text-ink" onClick={() => setOpen(false)}><Building2 size={15} aria-hidden="true" /> Trocar organização</Link>
      <LogoutButton className="text-xs" />
    </div> : null}
  </div>;
}

function MobileNavigation({ pathname, organizationName, hasOrganization, userName, onClose }: { pathname: string; organizationName?: string; hasOrganization: boolean; userName: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const drawer = dialogRef.current;
    if (!drawer) return;
    const surface = drawer;
    const focusable = surface.querySelector<HTMLElement>("a[href], button:not([disabled])");
    focusable?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== "Tab") return;
      const elements = Array.from(surface.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"));
      if (!elements.length) return;
      const first = elements[0]; const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dialogRef]);

  return <div className="fixed inset-0 z-50 lg:hidden" role="presentation"><button type="button" className="absolute inset-0 bg-ink/30" onClick={onClose} aria-label="Fechar menu de navegação" /><div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Menu de navegação" className="relative flex h-full w-[min(19rem,calc(100%-2rem))] flex-col bg-white shadow-floating"><div className="flex items-center justify-between border-b border-line px-5 py-4"><div className="min-w-0"><Link href="/app" className="font-semibold tracking-[-0.02em] text-ink" onClick={onClose}>Atlas Innove</Link><p className="mt-1 max-w-48 truncate text-[0.6875rem] text-slate">{organizationName ?? "Nenhuma organização ativa"}</p></div><button type="button" className="button-secondary px-3" onClick={onClose} aria-label="Fechar menu de navegação"><X size={18} aria-hidden="true" /></button></div><div className="flex-1 overflow-y-auto px-3 py-5"><ShellNavigation pathname={pathname} hasOrganization={hasOrganization} /></div><div className="border-t border-line p-4"><AccountControl userName={userName} organizationName={organizationName} /></div></div></div>;
}
