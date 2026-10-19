import Link from "next/link";
import { redirect } from "next/navigation";

import { MonitoringWaves } from "@/components/monitoring-waves";
import { PageHeader, Panel, PanelHeader, StatBar, StatTile } from "@/components/ui";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { getOrganizationMonitoring } from "@/lib/monitoring/read-model";

type PageProps = { searchParams: Promise<{ attention?: string | string[] }> };

export default async function FollowUpsPage({ searchParams }: PageProps) {
  const context = await getActiveOrganizationContext();
  if (!context) redirect("/app/organizations");
  const [waves, params] = await Promise.all([getOrganizationMonitoring(context.organization.id), searchParams]);
  const requested = typeof params.attention === "string" ? params.attention : "";
  const filter = ["OVERDUE", "OPEN", "UPCOMING", "CLOSED", "ARCHIVED"].includes(requested) ? requested : "";
  const visible = filter ? waves.filter((wave) => wave.attention === filter) : waves;
  const filters = [{ value: "", label: "Todas" }, { value: "OVERDUE", label: "Em atraso" }, { value: "OPEN", label: "Abertas no prazo" }, { value: "UPCOMING", label: "Próximas" }, { value: "CLOSED", label: "Encerradas" }, { value: "ARCHIVED", label: "Arquivadas" }];
  return <div className="min-w-0 space-y-6">
    <PageHeader title="Acompanhamentos" description="Ondas, cobertura e observações que precisam de atenção nos programas da organização." action={<Link className="button-secondary" href="/app/programs">Abrir programas</Link>} />
    <StatBar>
      {[{ value: "OVERDUE", label: "Ondas em atraso" }, { value: "OPEN", label: "Abertas no prazo" }, { value: "UPCOMING", label: "Próximas ondas" }].map((item) => <StatTile key={item.value} label={item.label} value={waves.filter((wave) => wave.attention === item.value).length} sub={`de ${waves.length} ${waves.length === 1 ? "onda" : "ondas"}`} href={`/app/follow-ups?attention=${item.value}`} />)}
    </StatBar>
    <Panel>
      <PanelHeader title="Agenda de acompanhamento" description="A cobertura usa as observações provisionadas para cada onda, incluindo o histórico das participações retiradas." />
      <nav aria-label="Filtrar ondas por situação" className="flex flex-wrap gap-2 px-5 py-3 sm:px-6">{filters.map((item) => <Link key={item.value} href={item.value ? `/app/follow-ups?attention=${item.value}` : "/app/follow-ups"} aria-current={filter === item.value ? "page" : undefined} className={`chip ${filter === item.value ? "on" : ""}`}>{item.label}</Link>)}</nav>
      {visible.length ? <MonitoringWaves waves={visible} /> : <div className="px-6 py-9 text-sm leading-6 text-slate"><p>{waves.length ? "Nenhuma onda nesta situação." : "As ondas organizam a baseline e os acompanhamentos de cada coorte. Crie uma onda no workspace da coorte para começar."}</p>{!waves.length ? <Link className="mt-4 inline-flex min-h-11 items-center font-semibold text-accent-hover hover:underline" href="/app/programs">Ver programas e coortes</Link> : null}</div>}
    </Panel>
  </div>;
}
