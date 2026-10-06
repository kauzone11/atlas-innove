"use client";

import { useState } from "react";
import { ThumbsUp, ChevronDown } from "lucide-react";
import type { ReactionType } from "@prisma/client";
import { reactionLabels } from "@/components/social/presentation";

export function ReactionPicker({ value, disabled, onChange, small = false }: { value: ReactionType | null; disabled?: boolean; onChange: (value: ReactionType | null) => void; small?: boolean }) {
  const [open, setOpen] = useState(false);
  return <div className={`social-reaction ${small ? "social-reaction-small" : ""}`}><div className="flex"><button type="button" className="social-action" disabled={disabled} aria-pressed={Boolean(value)} onClick={() => onChange(value ? null : "LIKE")}><ThumbsUp size={16} aria-hidden="true" /><span>{value ? reactionLabels[value] : "Curtir"}</span></button><button type="button" className="social-reaction-toggle" disabled={disabled} aria-label="Escolher reação" aria-expanded={open} onClick={() => setOpen(!open)}><ChevronDown size={13} aria-hidden="true" /></button></div>{open ? <div className="social-reaction-options" role="group" aria-label="Reações">{Object.entries(reactionLabels).map(([type, label]) => <button key={type} className="social-action" type="button" aria-pressed={value === type} disabled={disabled} onClick={() => { onChange(value === type ? null : type as ReactionType); setOpen(false); }}>{label}</button>)}</div> : null}</div>;
}
