"use client";

import { CircleUserRound, Landmark } from "lucide-react";

type Perspective = "instituicao" | "participante";

/** Icon-only switch between the institution and participant perspectives, styled like the theme switch. */
export function PerspectiveToggle({ value, onChange, orientation = "h", className = "" }: { value: Perspective; onChange: (value: Perspective) => void; orientation?: "h" | "v"; className?: string }) {
  const participant = value === "participante";
  return (
    <button type="button" role="switch" aria-checked={participant} aria-label="Ver como participante" title={participant ? "Ver como instituição" : "Ver como participante"} data-value={value} className={`tt pv ${orientation} ${className}`} onClick={() => onChange(participant ? "instituicao" : "participante")}>
      <span className="tt-thumb" aria-hidden="true" />
      <span className={`tt-i ${participant ? "" : "on"}`}><Landmark size={17} aria-hidden="true" /></span>
      <span className={`tt-i ${participant ? "on" : ""}`}><CircleUserRound size={17} aria-hidden="true" /></span>
    </button>
  );
}
