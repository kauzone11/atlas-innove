import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronRight, Info, type LucideIcon } from "lucide-react";

import { Topo } from "@/components/brand/topo";

export function PageHeader({
  title,
  description,
  action,
  breadcrumbs,
  eyebrow,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  breadcrumbs?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <header className="page-header">
      <div className="min-w-0 max-w-full">
        {breadcrumbs}
        {eyebrow ? <span className="eyebrow mb-1.5 block">{eyebrow}</span> : null}
        <h1 className="break-words">{title}</h1>
        {description ? <p className="break-words">{description}</p> : null}
      </div>
      {action ? <div className="page-header-actions">{action}</div> : null}
    </header>
  );
}

export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav className="breadcrumbs" aria-label="Navegação estrutural">
      <ol>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex min-w-0 max-w-full items-center gap-2">
            {item.href ? <Link className="min-w-0 break-words" href={item.href}>{item.label}</Link> : <span className="min-w-0 break-words" aria-current="page">{item.label}</span>}
            {index < items.length - 1 ? <ChevronRight size={12} className="shrink-0 opacity-50" aria-hidden="true" /> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "accent" | "success" | "warning" | "danger" }) {
  return <span className={`status-badge status-${tone}`}>{label}</span>;
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>{children}</section>;
}

export function PanelHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="panel-header flex flex-col items-start justify-between gap-4 sm:flex-row">
      <div className="min-w-0 max-w-full">
        <h2 className="break-words">{title}</h2>
        {description ? <p className="break-words">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function statusTone(status: string): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (["ACTIVE", "OPEN"].includes(status)) return "success";
  if (["DRAFT", "PLANNED"].includes(status)) return "neutral";
  if (["CLOSED", "ARCHIVED", "DISABLED"].includes(status)) return "neutral";
  return "neutral";
}

/** Primary orange card that states what needs attention now. Optional aside holds secondary actions. */
export function Hero({ eyebrow, title, description, actions, aside, seed = 11 }: { eyebrow?: string; title: ReactNode; description?: ReactNode; actions?: ReactNode; aside?: ReactNode; seed?: number }) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <Topo seed={seed} n={16} w={1100} h={560} cx={820} cy={150} />
      <div className={`hero-grid ${aside ? "two" : ""}`}>
        <div className="min-w-0">
          {eyebrow ? <span className="eyebrow mb-3.5 block">{eyebrow}</span> : null}
          <h1 id="hero-title" className="hero-title">{title}</h1>
          {description ? <p className="lede mt-4">{description}</p> : null}
          {actions ? <div className="mt-6 flex flex-wrap gap-2.5">{actions}</div> : null}
        </div>
        {aside ? <div className="min-w-0">{aside}</div> : null}
      </div>
    </section>
  );
}

export function HeroAction({ href, children, solid }: { href: string; children: ReactNode; solid?: boolean }) {
  return <Link href={href} className={`btn-hero ${solid ? "solid" : ""}`}>{children}</Link>;
}

/** Row of tiles; the first tile uses the brand gradient. Every number states its universe through `sub`. */
export function StatBar({ children }: { children: ReactNode }) { return <div className="statbar">{children}</div>; }
export function StatTile({ label, value, sub, href }: { label: string; value: ReactNode; sub?: string; href?: string }) {
  const body = <><span className="stat-l">{label}</span><span className="stat-v">{value}</span>{sub ? <span className="stat-sub">{sub}</span> : null}</>;
  return href ? <Link href={href}>{body}</Link> : <div>{body}</div>;
}

export function EmptyState({ icon: Icon, title, description, children, seed = 9 }: { icon: LucideIcon; title: string; description: string; children?: ReactNode; seed?: number }) {
  return (
    <div className="empty-state">
      <Topo seed={seed} n={9} w={700} h={320} cx={600} cy={60} />
      <div className="empty-ico"><Icon size={22} aria-hidden="true" /></div>
      <h3>{title}</h3>
      <p>{description}</p>
      {children ? <div className="flex flex-wrap gap-2.5">{children}</div> : null}
    </div>
  );
}

export function Banner({ tone = "info", children }: { tone?: "info" | "warn" | "bad" | "ok"; children: ReactNode }) {
  const Icon = tone === "ok" ? CheckCircle2 : tone === "info" ? Info : AlertTriangle;
  return <div className={`banner ${tone}`} role={tone === "bad" ? "alert" : undefined}><Icon size={18} aria-hidden="true" /><div className="min-w-0">{children}</div></div>;
}

export function CoverageBar({ submitted, inProgress, pending, missed }: { submitted: number; inProgress: number; pending: number; missed: number }) {
  const total = submitted + inProgress + pending + missed || 1;
  const part = (value: number) => `${(value / total) * 100}%`;
  return (
    <div className="cov" role="img" aria-label={`${submitted} enviadas, ${inProgress} em preenchimento, ${pending} pendentes, ${missed} não respondidas, de ${submitted + inProgress + pending + missed} esperadas`}>
      {submitted ? <i className="s" style={{ width: part(submitted) }} /> : null}
      {inProgress ? <i className="ip" style={{ width: part(inProgress) }} /> : null}
      {pending ? <i className="p" style={{ width: part(pending) }} /> : null}
      {missed ? <i className="m" style={{ width: part(missed) }} /> : null}
    </div>
  );
}

/** How to read evidence: zero is a reported value, absence is hatched, pending is dashed. */
export function EvidenceLegend() {
  return (
    <div className="legend" aria-label="Legenda de evidências">
      <span><i className="sw-obs" />Valor observado</span>
      <span><i className="sw-zero" />Zero informado</span>
      <span><i className="sw-abs" />Sem dado</span>
      <span><i className="sw-pend" />Pendente</span>
    </div>
  );
}
