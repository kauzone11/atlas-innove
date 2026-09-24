"use client";

import { useEffect, type RefObject } from "react";

type DemoDialogProps = {
  open: boolean;
  onClose: () => void;
  surfaceRef: RefObject<HTMLElement | null>;
};

export function useDemoDialog({ open, onClose, surfaceRef }: DemoDialogProps) {
  useEffect(() => {
    if (!open || !surfaceRef.current) return;

    const surface = surfaceRef.current;
    const restoreFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    surface.querySelector<HTMLElement>("button, a, input, select, textarea")?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(surface.querySelectorAll<HTMLElement>("button, a, input, select, textarea")).filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      restoreFocus?.focus();
    };
  }, [onClose, open, surfaceRef]);
}
