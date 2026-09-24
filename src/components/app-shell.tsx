"use client";

import Link from "next/link";
import { BriefcaseBusiness, Building2, ChevronDown, FolderKanban, Menu, Settings, Users, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { LogoutButton } from "@/components/logout-button";

type AppShellProps = { children: React.ReactNode; organizationName?: string; userName: string; hasOrganization: boolean };

const primaryNavigation = [
  { href: "/app", label: "Visão geral", icon: Building2, exact: true },
  { href: "/app/programs", label: "Programas", icon: FolderKanban },
  { href: "/app/ventures", label: "Empreendimentos", icon: BriefcaseBusiness },
];

const administrationNavigation = [
  { href: "/app/organizations", label: "Organizações", icon: Building2 },
  { href: "/app/team", label: "Equipe", icon: Users },
  { href: "/app/settings", label: "Configurações", icon: Settings },
];

export function AppShell({ children, organizationName, userName, hasOrganization }: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a className="skip-link" href="#main-content">Ir para o conteúdo</a>
      <div className="grid min-h-screen lg:grid-cols-[15rem_1fr]">
        <aside className="hidden border-r border-line bg-white lg:flex lg:flex-col">
          <ShellBrand organizationName={organizationName} />
          <div className="flex-1 px-3 py-6"><ShellNavigation pathname={pathname} hasOrganization={hasOrganization} /></div>
          <div className="border-t border-line p-4"><p className="truncate px-2 text-xs text-slate">{organizationName ?? "Nenhuma organização ativa"}</p></div>
        </aside>

        <div className="app-main">
          <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
            <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
              <div className="flex min-w-0 items-center gap-3">
                <button ref={menuButtonRef} type="button" className="button-secondary px-3 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu de navegação" aria-expanded={mobileOpen}>
                  <Menu size={18} aria-hidden="true" />
                </button>
                <Link href="/app" className="truncate text-[0.9375rem] font-semibold tracking-[-0.02em] text-ink lg:hidden">Atlas Innove</Link>
                <span className="hidden truncate text-sm text-slate sm:block">{organizationName ?? "Selecione uma organização"}</span>
              </div>
              <AccountControl userName={userName} organizationName={organizationName} placement="top" />
            </div>
          </header>
          <main id="main-content" className="app-content">{children}</main>
        </div>
      </div>

      {mobileOpen ? <MobileNavigation pathname={pathname} organizationName={organizationName} hasOrganization={hasOrganization} userName={userName} onClose={() => { setMobileOpen(false); menuButtonRef.current?.focus(); }} /> : null}
    </div>
  );
}

function ShellBrand({ organizationName }: { organizationName?: string }) {
  return <div className="border-b border-line px-5 py-5"><Link href="/app" className="block text-[1.05rem] font-semibold tracking-[-0.025em] text-ink">Atlas Innove</Link><p className="mt-1 truncate text-xs text-slate">{organizationName ?? "Nenhuma organização ativa"}</p></div>;
}

function ShellNavigation({ pathname, hasOrganization }: { pathname: string; hasOrganization: boolean }) {
  return <nav aria-label="Navegação da organização" className="space-y-7"><NavGroup label="Espaço" items={hasOrganization ? primaryNavigation : [primaryNavigation[0]]} pathname={pathname} /><NavGroup label="Administração" items={administrationNavigation.filter((item) => item.href === "/app/organizations" || hasOrganization)} pathname={pathname} /></nav>;
}

function NavGroup({ label, items, pathname }: { label: string; items: typeof primaryNavigation; pathname: string }) {
  if (!items.length) return null;
  return <div><p className="px-3 pb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-slate">{label}</p><div className="space-y-1">{items.map((item) => <NavItem key={item.href} item={item} pathname={pathname} />)}</div></div>;
}

function NavItem({ item, pathname }: { item: (typeof primaryNavigation)[number]; pathname: string }) {
  const Icon = item.icon;
  const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
  return <Link href={item.href} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150 ${active ? "bg-accent-soft/70 text-ink" : "text-slate hover:bg-surface-subtle hover:text-ink"}`}><Icon size={17} strokeWidth={active ? 2 : 1.7} className={active ? "text-accent" : undefined} aria-hidden="true" /><span>{item.label}</span></Link>;
}

function AccountControl({ userName, organizationName, placement = "top" }: { userName: string; organizationName?: string; placement?: "top" | "bottom" }) {
  const [open, setOpen] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!controlRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => { document.removeEventListener("pointerdown", handlePointerDown); document.removeEventListener("keydown", handleKeyDown); };
  }, [open]);

  const initials = userName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "AI";
  return <div ref={controlRef} className={`account-menu ${placement === "top" ? "ml-2" : ""}`}>
    <button type="button" className="flex min-h-11 max-w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-subtle" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="menu" aria-label={`Abrir menu de ${userName}`}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-white" aria-hidden="true">{initials}</span>
      <span className="hidden max-w-36 truncate text-sm font-medium text-ink sm:block">{userName}</span>
      <ChevronDown size={16} className="shrink-0 text-slate" aria-hidden="true" />
    </button>
    {open ? <div className={`account-menu-popover ${placement === "top" ? "!bottom-auto !top-[calc(100%+0.6rem)]" : ""}`} role="menu">
      <div className="border-b border-line px-2 pb-3 pt-1"><p className="truncate text-sm font-semibold text-ink">{userName}</p><p className="mt-1 truncate text-xs text-slate">{organizationName ?? "Nenhuma organização ativa"}</p></div>
      <Link href="/app/organizations" role="menuitem" className="mt-1 flex min-h-11 items-center gap-2 rounded-md px-2 text-sm text-slate hover:bg-surface-subtle hover:text-ink" onClick={() => setOpen(false)}><Building2 size={16} aria-hidden="true" /> Trocar organização</Link>
      <LogoutButton />
    </div> : null}
  </div>;
}

function MobileNavigation({ pathname, organizationName, hasOrganization, userName, onClose }: { pathname: string; organizationName?: string; hasOrganization: boolean; userName: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mobileDialog = dialogRef.current;
    if (!mobileDialog) return;
    const focusable = mobileDialog.querySelector<HTMLElement>("a, button");
    focusable?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab") return;
      const elements = Array.from(mobileDialog!.querySelectorAll<HTMLElement>("a, button"));
      if (!elements.length) return;
      const first = elements[0]; const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return <div className="fixed inset-0 z-50 lg:hidden" role="presentation"><button type="button" className="absolute inset-0 bg-ink/30" onClick={onClose} aria-label="Fechar menu de navegação" /><div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Menu de navegação" className="relative flex h-full w-[min(19rem,calc(100%-2rem))] flex-col bg-white shadow-floating"><div className="flex items-center justify-between border-b border-line px-5 py-4"><div className="min-w-0"><Link href="/app" className="font-semibold tracking-[-0.02em] text-ink" onClick={onClose}>Atlas Innove</Link><p className="mt-1 max-w-48 truncate text-xs text-slate">{organizationName ?? "Nenhuma organização ativa"}</p></div><button type="button" className="button-secondary px-3" onClick={onClose} aria-label="Fechar menu de navegação"><X size={18} aria-hidden="true" /></button></div><div className="flex-1 overflow-y-auto px-3 py-6"><ShellNavigation pathname={pathname} hasOrganization={hasOrganization} /></div><div className="border-t border-line p-4"><AccountControl userName={userName} organizationName={organizationName} placement="bottom" /></div></div></div>;
}
