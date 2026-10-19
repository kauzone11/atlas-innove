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
    { label: "Execução", href: `${base}/execution` },
    { label: "Acompanhamento", href: `${base}/tracking` },
  ];
  const active = items.find((item) => item.href === pathname || (item.href !== base && pathname.startsWith(`${item.href}/`)))?.href ?? base;

  return <nav aria-label="Seções do edital" className="tabs-wrap">
    <label className="block space-y-2 text-sm font-medium text-ink md:hidden"><span>Seção do edital</span><select className="field-control" value={active} onChange={(event) => router.push(event.target.value)}>{items.map((item) => <option key={item.href} value={item.href}>{item.label}</option>)}</select></label>
    <ul className="tabs hidden !mb-0 md:flex">{items.map((item) => <li key={item.href}><Link href={item.href} aria-current={active === item.href ? "page" : undefined}>{item.label}</Link></li>)}</ul>
  </nav>;
}
