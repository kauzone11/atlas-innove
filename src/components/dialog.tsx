"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type SurfaceProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  mode?: "dialog" | "sheet";
};

export function Dialog({ open, onClose, title, description, children, mode = "dialog" }: SurfaceProps) {
  const [mounted, setMounted] = useState(false);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || !mounted) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusableSelector = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
    const initialFocus = surfaceRef.current?.querySelector<HTMLElement>("[data-autofocus]")
      ?? surfaceRef.current?.querySelector<HTMLElement>("input, select, textarea")
      ?? surfaceRef.current?.querySelector<HTMLElement>("button, a[href]");
    window.requestAnimationFrame(() => initialFocus?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab" || !surfaceRef.current) return;
      const elements = Array.from(surfaceRef.current.querySelectorAll<HTMLElement>(focusableSelector));
      if (!elements.length) return;
      const first = elements[0]; const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      restoreFocusRef.current?.focus();
    };
  }, [mounted, onClose, open]);

  if (!open || !mounted) return null;
  const headingId = `${mode}-title`;
  const descriptionId = description ? `${mode}-description` : undefined;
  const backdropClassName = mode === "sheet" ? "sheet-backdrop" : "dialog-backdrop";
  const surfaceClassName = mode === "sheet" ? "sheet-surface" : "dialog-surface";
  return createPortal(
    <div className={backdropClassName} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={surfaceRef} className={surfaceClassName} role="dialog" aria-modal="true" aria-labelledby={headingId} aria-describedby={descriptionId}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0"><h2 id={headingId} className="text-lg font-semibold tracking-[-0.02em] text-ink">{title}</h2>{description ? <p id={descriptionId} className="mt-1 text-sm leading-6 text-slate">{description}</p> : null}</div>
          <button type="button" className="button-secondary min-h-11 shrink-0 px-3" onClick={onClose} aria-label="Fechar janela"><X size={18} aria-hidden="true" /></button>
        </div>
        <div className="px-5 py-5 sm:px-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
