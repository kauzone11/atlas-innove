"use client";

import { Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";

function currentTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Sun/moon switch. The change is revealed as a circle from the button when View Transitions are available. */
export function ThemeToggle({ orientation = "h", className = "" }: { orientation?: "h" | "v"; className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(currentTheme());
    const observer = new MutationObserver(() => setTheme(currentTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const apply = useCallback((next: Theme) => {
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("atlas-theme", next); } catch { /* storage may be unavailable */ }
  }, []);

  const toggle = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    const root = document.documentElement;
    if (prefersReducedMotion()) { apply(next); return; }
    root.classList.add("theme-switching");
    const settle = () => root.classList.remove("theme-switching", "vt-soft");
    const transitions = document as Document & { startViewTransition?: (callback: () => void) => { ready: Promise<void>; finished: Promise<void> } };
    if (!transitions.startViewTransition) {
      root.classList.add("tfade");
      apply(next);
      window.setTimeout(() => { root.classList.remove("tfade"); settle(); }, 450);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const end = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const soft = typeof CSS !== "undefined" && "registerProperty" in CSS && CSS.supports("mask-image", "radial-gradient(#000,#000)");
    root.style.setProperty("--tx", `${x}px`);
    root.style.setProperty("--ty", `${y}px`);
    if (soft) root.classList.add("vt-soft");
    const transition = transitions.startViewTransition(() => apply(next));
    transition.ready.then(() => {
      if (soft) root.animate({ "--r": ["0px", `${end + 160}px`] } as unknown as PropertyIndexedKeyframes, { duration: 1000, easing: "cubic-bezier(.6,.04,.2,1)", pseudoElement: "::view-transition-new(root)" });
      else root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] }, { duration: 800, easing: "cubic-bezier(.6,.04,.2,1)", pseudoElement: "::view-transition-new(root)" });
    }).catch(() => undefined);
    transition.finished.finally(settle);
  }, [apply]);

  const dark = theme === "dark";
  return (
    <button type="button" role="switch" aria-checked={dark} aria-label="Modo escuro" title={dark ? "Mudar para o modo claro" : "Mudar para o modo escuro"} className={`tt ${orientation} ${className}`} onClick={toggle}>
      <span className="tt-thumb" aria-hidden="true" />
      <span className="tt-i sun"><Sun size={17} aria-hidden="true" /></span>
      <span className="tt-i moon"><Moon size={17} aria-hidden="true" /></span>
    </button>
  );
}
