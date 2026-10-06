"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function FundingCallNavigation({ programId, callId }: { programId: string; callId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/app/programs/${programId}/calls/${callId}`;
  const items = [
    { label: "Visão geral", href: base },
    { label: "Candidaturas", href: `${base}/applications` },
    { label: "Avaliação", href: `${base}/evaluation` },
    { label: "Classificação", href: `${base}/ranking` },
    { label: "Acompanhamento", href: `${base}/tracking` },
  ];
  const active = items.find((item) => item.href === pathname || (item.href !== base && pathname.startsWith(`${item.href}/`)))?.href ?? base;

  return <nav aria-label="Seções do edital" className="border-b border-line pb-3">
    <label className="block space-y-2 text-sm font-medium text-ink md:hidden"><span>Seção do edital</span><select className="field-control" value={active} onChange={(event) => router.push(event.target.value)}>{items.map((item) => <option key={item.href} value={item.href}>{item.label}</option>)}</select></label>
    <ul className="hidden flex-wrap gap-1 md:flex">{items.map((item) => <li key={item.href}><Link href={item.href} aria-current={active === item.href ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-md px-4 py-2 text-sm font-medium transition-colors ${active === item.href ? "bg-accent-soft text-accent-hover" : "text-slate hover:bg-surface-subtle hover:text-ink"}`}>{item.label}</Link></li>)}</ul>
  </nav>;
}
