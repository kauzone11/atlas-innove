import Link from "next/link";
import { collaborationStatusLabels } from "@/lib/network/presentation";
import { projectStatusLabels } from "@/lib/participants/presentation";
import type { PeopleDiscoveryFilters, ProjectDiscoveryFilters } from "@/lib/network/discovery-schemas";

function SearchField({ label, value }: { label: string; value?: string }) {
  return <label className="block min-w-0 flex-1 space-y-2 text-sm font-medium"><span>{label}</span><input className="field-control" name="q" type="search" defaultValue={value} maxLength={100} /></label>;
}
function Select({ name, label, value, options, empty = "Todas" }: { name: string; label: string; value?: string; options: Record<string, string>; empty?: string }) {
  return <label className="block min-w-0 space-y-2 text-sm font-medium"><span>{label}</span><select className="field-control" name={name} defaultValue={value ?? ""}><option value="">{empty}</option>{Object.entries(options).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></label>;
}
export function PeopleDiscoveryFiltersForm({ filters, projects }: { filters: PeopleDiscoveryFilters; projects: Array<{ id: string; name: string }> }) {
  return <form method="get" className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end"><SearchField label="Buscar pessoa, competência ou tema" value={filters.q} /><button className="button-secondary">Buscar</button></div>
    <details className="border-y border-line py-2"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Filtros e contexto de colaboração</summary><div className="mt-3 grid gap-4 pb-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="block space-y-2 text-sm font-medium"><span>Competência ou tema</span><input className="field-control" name="topic" defaultValue={filters.topic} maxLength={80} placeholder="Ex.: Análise de dados" /></label>
      <label className="block space-y-2 text-sm font-medium"><span>Estado</span><input className="field-control" name="state" defaultValue={filters.state} maxLength={120} placeholder="Ex.: Ceará" /></label>
      <Select name="collaborationStatus" label="Disponibilidade" value={filters.collaborationStatus} options={collaborationStatusLabels} />
      {projects.length ? <Select name="projectId" label="Encontrar pessoas para" value={filters.projectId} options={Object.fromEntries(projects.slice(0, 40).map((project) => [project.id, project.name]))} empty="Meu perfil" /> : null}
      <div className="flex flex-wrap items-end gap-2"><button className="button-primary">Aplicar filtros</button><Link className="button-secondary" href="/app/personal/network/people">Limpar</Link></div>
    </div></details>
    <p className="text-xs leading-5 text-slate">A busca usa somente informações visíveis na plataforma. A afinidade é explicada por temas e localização; perfis sem disponibilidade ficam após os demais nesta página.</p>
  </form>;
}
export function ProjectDiscoveryFiltersForm({ filters }: { filters: ProjectDiscoveryFilters }) {
  return <form method="get" className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end"><SearchField label="Buscar projeto ou tema" value={filters.q} /><button className="button-secondary">Buscar</button></div>
    <details className="border-y border-line py-2"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Filtros de projetos</summary><div className="mt-3 grid gap-4 pb-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="block space-y-2 text-sm font-medium"><span>Área temática</span><input className="field-control" name="topic" defaultValue={filters.topic} maxLength={80} placeholder="Ex.: Saúde digital" /></label>
      <Select name="status" label="Situação" value={filters.status} options={Object.fromEntries(Object.entries(projectStatusLabels).filter(([key]) => key !== "ARCHIVED"))} />
      <Select name="collaborationOpen" label="Colaboração" value={filters.collaborationOpen} options={{ true: "Recebendo colaboradores", false: "Não buscando colaboradores agora" }} empty="Todos os projetos" />
      <div className="flex flex-wrap items-end gap-2"><button className="button-primary">Aplicar filtros</button><Link className="button-secondary" href="/app/personal/network/projects">Limpar</Link></div>
    </div></details>
    <p className="text-xs leading-5 text-slate">Projetos aparecem por escolha dos responsáveis. A descoberta compartilha a apresentação do projeto; o acesso ao espaço de trabalho exige colaboração vigente.</p>
  </form>;
}
