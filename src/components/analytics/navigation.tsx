import Link from "next/link";
import { Files, GitCompareArrows, ListChecks, Network, Ruler } from "lucide-react";

const destinations = [
  { href: "/app/analytics", label: "Portfólio", icon: Network },
  { href: "/app/analytics/compare", label: "Comparar coortes", icon: GitCompareArrows },
  { href: "/app/analytics/quality", label: "Qualidade dos dados", icon: ListChecks },
  { href: "/app/analytics/reports", label: "Relatórios", icon: Files },
];

export function AnalyticsNavigation({ current, canConfigure }: { current: string; canConfigure: boolean }) {
  const items = canConfigure ? [...destinations, { href: "/app/analytics/metrics", label: "Métricas", icon: Ruler }] : destinations;
  return <nav className="analytics-navigation" aria-label="Áreas de análise">{items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={current === href ? "page" : undefined}><Icon size={16} strokeWidth={1.7} aria-hidden="true" />{label}</Link>)}</nav>;
}
