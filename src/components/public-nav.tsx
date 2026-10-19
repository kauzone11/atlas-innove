"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Compass, Landmark, Menu, Play, User, UserPlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AtlasLogo, AtlasMark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";

const items = [
  { href: "/opportunities", label: "Oportunidades", icon: Compass },
  { href: "/institutions", label: "Instituições", icon: Landmark },
  { href: "/results", label: "Resultados", icon: BarChart3 },
  { href: "/demo", label: "Demonstração", icon: Play },
];

function active(href: string, pathname: string) { return pathname === href || pathname.startsWith(`${href}/`); }

export function PublicNav({ authenticated }: { authenticated: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("a[href], button")?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); buttonRef.current?.focus(); return; }
      if (event.key !== "Tab" || !panel) return;
      const els = Array.from(panel.querySelectorAll<HTMLElement>('a[href], button:not([tabindex="-1"])'));
      const first = els[0]; const last = els[els.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", onKeyDown); };
  }, [open]);

  return (
    <>
      <header className="topbar">
        <div className="tb-l"><Link href="/opportunities" className="pill brandpill" aria-label="Atlas Innove — oportunidades"><AtlasMark /><span className="brand-t">Atlas Innove</span></Link></div>
        <nav className="pnav static hide-narrow" aria-label="Navegação pública">
          {items.map((item) => <Link key={item.href} href={item.href} aria-current={active(item.href, pathname) ? "page" : undefined}>{item.label}</Link>)}
        </nav>
        <div className="tb-r">
          <ThemeToggle orientation="h" />
          {authenticated
            ? <Link href="/app/personal" className="button-primary hide-narrow">Meu espaço</Link>
            : <><Link href="/login" className="button-secondary hide-narrow">Entrar</Link><Link href="/signup" className="button-primary hide-narrow">Criar conta</Link></>}
          <button ref={buttonRef} type="button" className="ibtn pill show-narrow" onClick={() => setOpen(true)} aria-label="Abrir menu" aria-haspopup="dialog" aria-expanded={open}><Menu size={20} aria-hidden="true" /></button>
        </div>
      </header>
      {open ? <div className="fixed inset-0 z-50 flex" style={{ background: "var(--scrim)", backdropFilter: "blur(4px)" }}>
        <button type="button" tabIndex={-1} className="absolute inset-0 cursor-default" aria-label="Fechar menu" onClick={() => { setOpen(false); buttonRef.current?.focus(); }} />
        <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Menu" className="relative flex h-full w-[min(20rem,calc(100%-2.75rem))] flex-col gap-1 overflow-y-auto bg-surface p-4" style={{ borderRadius: "0 28px 28px 0", boxShadow: "var(--shadow-pop)", animation: "drawer .24s ease-out" }}>
          <div className="mb-2 flex items-center justify-between"><Link href="/opportunities" aria-label="Atlas Innove"><AtlasLogo className="h-11 w-auto" /></Link><button type="button" className="ibtn" onClick={() => { setOpen(false); buttonRef.current?.focus(); }} aria-label="Fechar menu"><X size={20} aria-hidden="true" /></button></div>
          {items.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} className="nav-link" aria-current={active(item.href, pathname) ? "page" : undefined}><Icon size={18} aria-hidden="true" />{item.label}</Link>; })}
          <hr className="my-2 border-0 border-t border-line" />
          {authenticated ? <Link href="/app/personal" className="nav-link"><User size={18} aria-hidden="true" />Meu espaço</Link> : <><Link href="/login" className="nav-link"><User size={18} aria-hidden="true" />Entrar</Link><Link href="/signup" className="nav-link"><UserPlus size={18} aria-hidden="true" />Criar conta</Link></>}
        </div>
      </div> : null}
    </>
  );
}
