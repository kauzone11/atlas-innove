"use client";

import { Briefcase, FolderKanban, Search, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Dialog } from "@/components/dialog";
import type { GlobalSearchResult } from "@/lib/search/global";

type Group = { key: keyof GlobalSearchResult; label: string; icon: typeof Search };
const groups: Group[] = [
  { key: "programs", label: "Programas", icon: FolderKanban },
  { key: "ventures", label: "Empreendimentos", icon: Briefcase },
  { key: "people", label: "Pessoas", icon: UserRound },
];

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<GlobalSearchResult | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmed = query.trim();

  useEffect(() => { if (!open) { setQuery(""); setResult(null); setStatus("idle"); setActive(0); } }, [open]);

  useEffect(() => {
    if (!open || trimmed.length < 2) { setResult(null); setStatus("idle"); return; }
    const controller = new AbortController();
    setStatus("loading");
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("search failed");
        setResult(await response.json() as GlobalSearchResult);
        setStatus("idle");
        setActive(0);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setStatus("error");
      }
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [open, trimmed]);

  const flat = useMemo(() => result ? groups.flatMap((group) => result[group.key].map((item) => ({ ...item, group }))) : [], [result]);

  function go(href: string) { onClose(); router.push(href); }
  function onKeyDown(event: React.KeyboardEvent) {
    if (!flat.length) return;
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((value) => (value + 1) % flat.length); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive((value) => (value - 1 + flat.length) % flat.length); }
    else if (event.key === "Enter") { event.preventDefault(); go(flat[active].href); }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Buscar" description="Programas, empreendimentos e pessoas que você pode acessar. Os resultados respeitam seu papel e a organização ativa.">
      <div className="search-field" role="search">
        <Search size={17} aria-hidden="true" />
        <input ref={inputRef} data-autofocus className="field-control" type="search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={onKeyDown} placeholder="Programa, empreendimento ou pessoa" aria-label="Buscar" role="combobox" aria-expanded={flat.length > 0} aria-controls={listId} aria-activedescendant={flat.length ? `${listId}-${active}` : undefined} autoComplete="off" maxLength={80} />
      </div>
      <div className="mt-4 min-h-24" aria-live="polite">
        {trimmed.length < 2 ? <p className="text-sm text-slate">Digite ao menos 2 caracteres.</p>
          : status === "error" ? <p className="text-sm text-danger" role="alert">Não foi possível buscar agora. Tente novamente.</p>
          : status === "loading" && !result ? <div className="space-y-2" aria-label="Buscando"><div className="skeleton h-10" /><div className="skeleton h-10" /></div>
          : result && !flat.length ? <p className="text-sm text-slate">Nenhum resultado para “{trimmed}”.</p>
          : <ul id={listId} role="listbox" aria-label="Resultados da busca" className="space-y-3">
              {groups.map((group) => {
                const items = flat.map((item, index) => ({ item, index })).filter(({ item }) => item.group.key === group.key);
                if (!items.length) return null;
                const Icon = group.icon;
                return <li key={group.key} role="presentation"><p className="eyebrow mb-1 px-3">{group.label}</p><ul role="presentation">{items.map(({ item, index }) => (
                  <li key={item.id} role="presentation"><button type="button" id={`${listId}-${index}`} role="option" aria-selected={index === active} onMouseEnter={() => setActive(index)} onClick={() => go(item.href)} className="list-row" style={index === active ? { background: "var(--bg-sub)" } : undefined}><span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-surface-subtle text-ink"><Icon size={16} aria-hidden="true" /></span><span className="min-w-0"><span className="block truncate font-semibold">{item.name}</span><span className="block truncate text-xs text-slate">{item.hint}</span></span></button></li>
                ))}</ul></li>;
              })}
            </ul>}
      </div>
    </Dialog>
  );
}
