"use client";
import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { supportTypeLabels, territoryScopeLabels, brazilianStates } from "@/lib/opportunities/presentation";
import type { OpportunityFilters } from "@/lib/opportunities/schemas";

export function OpportunityFiltersForm({ filters, projects = [], personal = false }: { filters: OpportunityFilters; projects?: Array<{ id: string; name: string }>; personal?: boolean }) {
  const [open, setOpen] = useState(false);
  const controls = <>
    <Select name="source" label="Fonte" value={filters.source} options={{ INTERNAL: "Instituições no Innove", EXTERNAL: "Fonte externa" }} />
    <Select name="support" label="Tipo de apoio" value={filters.support} options={supportTypeLabels} />
    <Select name="territory" label="Abrangência" value={filters.territory} options={territoryScopeLabels} />
    <Select name="state" label="UF informada no edital" value={filters.state} options={Object.fromEntries(brazilianStates.map((state) => [state, state]))} />
    <label className="block space-y-2 text-sm font-medium"><span>Área temática</span><input name="topic" defaultValue={filters.topic} className="field-control" maxLength={80} placeholder="Ex.: Saúde" /></label>
    <Select name="deadline" label="Prazo de inscrição" value={filters.deadline} options={{ "7": "Próximos 7 dias", "30": "Próximos 30 dias" }} />
    <Select name="status" label="Situação" value={filters.status} options={{ OPEN: "Abertas", UPCOMING: "Em breve", CLOSED: "Encerradas", ALL: "Todas, incluindo histórico" }} empty="Abertas e em breve" />
    {personal && projects.length ? <Select name="projectId" label="Contexto do projeto" value={filters.projectId} options={Object.fromEntries(projects.map((project) => [project.id, project.name]))} empty="Meu perfil" /> : null}
  </>;
  return <div className="space-y-4"><form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="block flex-1 space-y-2 text-sm font-medium"><span>Buscar edital ou instituição</span><input className="field-control" name="q" type="search" defaultValue={filters.q} maxLength={200} /></label>{Object.entries(filters).filter(([key, value]) => key !== "q" && value && typeof value === "string").map(([key, value]) => <input key={key} type="hidden" name={key} value={String(value)} />)}<div className="flex flex-wrap gap-2"><button className="button-secondary">Buscar</button><button type="button" className="button-secondary lg:hidden" onClick={() => setOpen(true)}><SlidersHorizontal size={16} aria-hidden="true" />Filtros</button></div></form>
    <details className="hidden border-y border-line py-3 lg:block"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Filtros de descoberta</summary><form method="get" className="mt-4 grid gap-4 lg:grid-cols-4"><input type="hidden" name="q" value={filters.q ?? ""} />{controls}<div className="flex items-end gap-3"><button className="button-primary">Aplicar</button><a href={personal ? "/app/personal/opportunities" : "/opportunities"} className="button-secondary">Limpar</a></div></form></details>
    <Dialog open={open} onClose={() => setOpen(false)} mode="sheet" title="Filtrar oportunidades" description="Escolha o contexto relevante para sua busca."><form method="get" className="space-y-4"><input type="hidden" name="q" value={filters.q ?? ""} />{controls}<button className="button-primary w-full">Aplicar filtros</button><a href={personal ? "/app/personal/opportunities" : "/opportunities"} className="button-secondary w-full">Limpar filtros</a></form></Dialog><p className="text-xs text-slate">Até 150 oportunidades por consulta. Use os filtros para refinar os resultados.</p>
  </div>;
}
function Select({ name, label, value, options, empty = "Todas" }: { name: string; label: string; value?: string; options: Record<string, string>; empty?: string }) {
  return <label className="block min-w-0 space-y-2 text-sm font-medium"><span>{label}</span><select className="field-control" name={name} defaultValue={value ?? ""}><option value="">{empty}</option>{Object.entries(options).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></label>;
}
