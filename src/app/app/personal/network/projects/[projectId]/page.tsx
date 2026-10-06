import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Breadcrumbs, PageHeader, StatusBadge, statusTone } from "@/components/ui";
import { RelevanceExplanation } from "@/components/network/discovery-list";
import { ProjectNetworkActions } from "@/components/network/project-actions";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { getDiscoverableProject } from "@/lib/network/projects";
import { getProjectRequestState } from "@/lib/network/requests";
import { projectStatusLabels } from "@/lib/participants/presentation";

export default async function NetworkProject({ params }: { params: Promise<{ projectId: string }> }) {
  const { user } = await requireAuthenticatedSession(); const { projectId } = await params;
  const project = await getDiscoverableProject(user.id, projectId); if (!project) notFound();
  const request = await getProjectRequestState(user.id, projectId);
  return <div className="min-w-0 space-y-6"><PageHeader title={project.name} description={project.summary} breadcrumbs={<Breadcrumbs items={[{ label: "Rede", href: "/app/personal/network" }, { label: "Projetos", href: "/app/personal/network/projects" }, { label: project.name }]} />} /><div className="flex flex-wrap items-center justify-between gap-3"><StatusBadge label={projectStatusLabels[project.status]} tone={statusTone(project.status)} /><ProjectNetworkActions projectId={projectId} {...request} /></div><section className="border-y border-line py-5"><h2 className="font-semibold">Colaboração</h2><p className="mt-2 text-sm">{project.collaborationOpen ? "Aberto a novas colaborações." : "Não está buscando colaboradores agora."}</p>{project.collaborationNote ? <p className="mt-2 max-w-3xl whitespace-pre-line break-words text-sm leading-6 text-slate">{project.collaborationNote}</p> : null}{project.thematicAreas.length ? <p className="mt-3 break-words text-sm text-slate">Temas: {project.thematicAreas.join(" · ")}</p> : null}</section>{project.relevance.reasons.length ? <RelevanceExplanation relevance={project.relevance} /> : null}{project.description ? <section><h2 className="font-semibold">Sobre o projeto</h2><p className="mt-3 max-w-3xl whitespace-pre-line break-words text-sm leading-7 text-slate">{project.description}</p></section> : null}{project.websiteUrl || project.repositoryUrl || project.demoUrl ? <section className="border-t border-line pt-5"><h2 className="font-semibold">Links do projeto</h2><ul className="mt-2 flex flex-wrap gap-3">{[["Site", project.websiteUrl], ["Repositório", project.repositoryUrl], ["Demonstração", project.demoUrl]].map(([label, url]) => url ? <li key={label}><a className="button-tertiary" href={url} target="_blank" rel="noopener noreferrer">{label}<ArrowUpRight size={15} aria-hidden="true" /></a></li> : null)}</ul></section> : null}<p className="border-t border-line pt-5 text-xs leading-5 text-slate">Esta apresentação contém somente as informações compartilhadas na Rede. Tarefas, recursos e candidaturas pertencem ao espaço de trabalho do projeto.</p></div>;
}
