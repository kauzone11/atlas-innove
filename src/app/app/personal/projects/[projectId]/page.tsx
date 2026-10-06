import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs, PageHeader, Panel, PanelHeader, StatusBadge, statusTone } from "@/components/ui";
import { ParticipantRecordForm, ArchiveParticipantRecord } from "@/components/personal/record-form";
import { ParticipantMembers, GrantProjectMember } from "@/components/personal/members";
import { ProjectPublication } from "@/components/personal/project-publication";
import { ParticipantEmpty } from "@/components/personal/record-list";
import { PersonalApplicationList } from "@/components/personal/applications";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { getProject, listTeams } from "@/lib/participants/service";
import { projectStatusLabels } from "@/lib/participants/presentation";
import { listPersonalApplications } from "@/lib/selection/service";

export default async function PersonalProject({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params; const { user } = await requireAuthenticatedSession(); const [project, teams, applications] = await Promise.all([getProject(user.id, projectId), listTeams(user.id), listPersonalApplications(user.id)]); if (!project) notFound();
  const participations = applications.filter((application) => application.projectId === projectId);
  return <div className="min-w-0 space-y-6"><PageHeader title={project.name} description={project.summary} breadcrumbs={<Breadcrumbs items={[{ label: "Projetos", href: "/app/personal/projects" }, { label: project.name }]} />} action={project.canManage ? <div className="flex flex-wrap gap-2"><ParticipantRecordForm kind="project" record={project} teams={teams} />{project.canArchive ? <ArchiveParticipantRecord kind="projects" id={project.id} /> : null}</div> : undefined} /><div className="flex flex-wrap items-center gap-3"><StatusBadge label={projectStatusLabels[project.status]} tone={statusTone(project.status)} />{project.primaryTeamId && teams.some((team) => team.id === project.primaryTeamId) ? <Link href={`/app/personal/teams/${project.primaryTeamId}`} className="button-tertiary">{project.teamName}</Link> : <span className="text-sm text-slate">{project.teamName ?? "Projeto independente"}</span>}</div><ProjectPublication project={project} />{project.thematicAreas.length ? <p className="text-sm text-slate">Áreas temáticas: {project.thematicAreas.join(" · ")}</p> : null}{project.description ? <Panel className="p-5"><h2 className="mb-3 font-semibold">Sobre o projeto</h2><p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate">{project.description}</p></Panel> : null}<Panel><PanelHeader title="Pessoas no projeto" description="Os membros atuais da equipe principal também têm acesso conforme seu perfil. Vínculos diretos continuam mesmo após mudanças na equipe." /><ParticipantMembers kind="projects" record={project} userId={user.id} /><GrantProjectMember project={project} /></Panel><Panel><PanelHeader title="Participações em programas" action={!project.archivedAt ? <Link className="button-secondary" href="/app/personal/opportunities">Explorar editais</Link> : undefined} />{participations.length ? <PersonalApplicationList applications={participations} /> : <ParticipantEmpty title="Este projeto ainda não tem candidaturas" description="Explore editais abertos e prepare uma candidatura. Cada envio preservará uma cópia das informações apresentadas." />}</Panel></div>;
}
