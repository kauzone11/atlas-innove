"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ThumbsUp, ChevronDown, Heart, Lightbulb, HandHeart, PartyPopper, Smile } from "lucide-react";
import type { ReactionType } from "@prisma/client";
import { reactionLabels } from "@/components/social/presentation";

const reactionIcons = { LIKE: ThumbsUp, CELEBRATE: PartyPopper, SUPPORT: HandHeart, LOVE: Heart, INSIGHTFUL: Lightbulb, FUNNY: Smile };
export function ReactionPicker({ value, disabled, onChange, small = false }: { value: ReactionType | null; disabled?: boolean; onChange: (value: ReactionType | null) => void; small?: boolean }) {
  const [open, setOpen] = useState(false); const pickerId = useId(); const container = useRef<HTMLDivElement>(null); const toggle = useRef<HTMLButtonElement>(null);
  const Icon = value ? reactionIcons[value] : ThumbsUp;
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) { if (!container.current?.contains(event.target as Node)) setOpen(false); }
    function escape(event: KeyboardEvent) { if (event.key === "Escape") { event.preventDefault(); setOpen(false); toggle.current?.focus(); } }
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div ref={container} className={`social-reaction ${small ? "social-reaction-small" : ""}`} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}><div className="social-reaction-trigger"><button type="button" className="social-action" disabled={disabled} aria-pressed={Boolean(value)} onClick={() => onChange(value ? null : "LIKE")}><Icon size={small ? 15 : 17} aria-hidden="true" /><span>{value ? reactionLabels[value] : "Curtir"}</span></button><button ref={toggle} type="button" className="social-reaction-toggle" disabled={disabled} aria-label="Escolher reação" aria-expanded={open} aria-controls={pickerId} onClick={() => setOpen(!open)}><ChevronDown size={14} aria-hidden="true" /></button></div>{open ? <div id={pickerId} className="social-reaction-options" role="group" aria-label="Reações">{Object.entries(reactionLabels).map(([type, label]) => { const ReactionIcon = reactionIcons[type as ReactionType]; return <button key={type} className="social-action" type="button" aria-pressed={value === type} disabled={disabled} onClick={() => { onChange(value === type ? null : type as ReactionType); setOpen(false); toggle.current?.focus(); }}><ReactionIcon size={18} aria-hidden="true" />{label}</button>; })}</div> : null}</div>;
}
