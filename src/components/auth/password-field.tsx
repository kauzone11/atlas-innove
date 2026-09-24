"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";

type PasswordFieldProps = { label?: string; value: string; onChange: (value: string) => void; autoComplete?: string; required?: boolean; minLength?: number; id?: string };

export function PasswordField({ label = "Senha", value, onChange, autoComplete, required, minLength, id }: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);
  return <label htmlFor={inputId} className="block space-y-2 text-sm font-medium text-ink"><span>{label}</span><span className="relative block"><input id={inputId} className="field-control pr-12" type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} required={required} minLength={minLength} /><button type="button" className="absolute right-0 top-0 grid h-11 w-11 place-items-center text-slate transition-colors hover:text-ink" onClick={() => setVisible((current) => !current)} aria-label={visible ? "Ocultar senha" : "Mostrar senha"}>{visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button></span></label>;
}
