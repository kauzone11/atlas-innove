"use client";

import { useEffect, useRef, type RefObject } from "react";

type DemoDialogProps = {
  open: boolean;
  onClose: () => void;
  surfaceRef: RefObject<HTMLElement | null>;
};

export function useDemoDialog({ open, onClose, surfaceRef }: DemoDialogProps) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || !surfaceRef.current) return;

    const surface = surfaceRef.current;
    const restoreFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const focusableSelector = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
    const initialFocus = surface.querySelector<HTMLElement>("[data-autofocus]") ?? surface.querySelector<HTMLElement>(focusableSelector);
    const overlay = surface.parentElement;
    const background = overlay?.parentElement;
    const inertedElements = background ? Array.from(background.children).filter((element) => element !== overlay) : [];
    const previousInert = inertedElements.map((element) => ({ element, inert: (element as HTMLElement).inert }));
    document.body.style.overflow = "hidden";
    inertedElements.forEach((element) => { (element as HTMLElement).inert = true; });
    const focusFrame = window.requestAnimationFrame(() => initialFocus?.focus());

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(surface.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => !element.hasAttribute("disabled") && !element.closest("[inert]"));
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
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      previousInert.forEach(({ element, inert }) => { (element as HTMLElement).inert = inert; });
      document.removeEventListener("keydown", onKeyDown);
      if (restoreFocus?.isConnected) restoreFocus.focus();
    };
  }, [open, surfaceRef]);
}
