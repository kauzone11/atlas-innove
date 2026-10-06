import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, ArrowRight, CheckSquare, Link2, Users } from "lucide-react";
import { Breadcrumbs, PageHeader, Panel, PanelHeader, StatusBadge, statusTone } from "@/components/ui";
import { ParticipantRecordForm, ArchiveParticipantRecord } from "@/components/personal/record-form";
import { ParticipantMembers, GrantProjectMember } from "@/components/personal/members";
import { ProjectPublication } from "@/components/personal/project-publication";
import { ParticipantEmpty } from "@/components/personal/record-list";
import { PersonalApplicationList } from "@/components/personal/applications";
import { ProjectTasks } from "@/components/personal/project-tasks";
import { ProjectResources } from "@/components/personal/project-resources";
import { AwardSummaryList } from "@/components/execution/award-list";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { getProject, listTeams } from "@/lib/participants/service";
import { projectStatusLabels } from "@/lib/participants/presentation";
import { listPersonalApplications } from "@/lib/selection/service";
import { listPersonalAwards } from "@/lib/awards/service";
import { getProjectCollaboration } from "@/lib/project-collaboration/service";
import { getProjectActivity } from "@/lib/project-collaboration/activity";
import { taskIsTerminal } from "@/lib/project-collaboration/state";
import { formatMonitoringDate } from "@/lib/monitoring/format";

const sections = [{ id: "overview", label: "Visão geral" }, { id: "tasks", label: "Tarefas" }, { id: "resources", label: "Recursos" }, { id: "programs", label: "Programas" }, { id: "people", label: "Pessoas" }, { id: "activity", label: "Atividade" }];

export default async function PersonalProject({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ section?: string; taskFilter?: string; taskPage?: string }> }) {
  const { projectId } = await params; const { user } = await requireAuthenticatedSession();
  const project = await getProject(user.id, projectId); if (!project) notFound();
  const query = await searchParams; const requested = query.section; const section = sections.some((item) => item.id === requested) ? requested : "overview";
  const taskFilter = ["all", "completed"].includes(query.taskFilter ?? "") ? query.taskFilter as "all" | "completed" : "pending";
  const [teams, collaboration, applications, awardPage, activity] = await Promise.all([
    listTeams(user.id), getProjectCollaboration(user.id, projectId, { taskFilter: section === "tasks" ? taskFilter : "pending", taskPage: section === "tasks" ? Number(query.taskPage ?? 1) : 1 }), listPersonalApplications(user.id), listPersonalAwards(user.id, { projectId }), section === "activity" ? getProjectActivity(user.id, projectId) : Promise.resolve([]),
  ]);
  const participations = applications.filter((application) => application.projectId === projectId);
  const nextTasks = collaboration.tasks.filter((task) => !taskIsTerminal(task.status)).slice(0, 3);
  const href = (value: string) => `/app/personal/projects/${projectId}?section=${value}`;
  return <div className="min-w-0 space-y-6"><PageHeader title={project.name} description={project.summary} breadcrumbs={<Breadcrumbs items={[{ label: "Projetos", href: "/app/personal/projects" }, { label: project.name }]} />} action={project.canManage ? <div className="flex flex-wrap gap-2"><ParticipantRecordForm kind="project" record={project} teams={teams} />{project.canArchive ? <ArchiveParticipantRecord kind="projects" id={project.id} /> : null}</div> : undefined} /><div className="flex flex-wrap items-center gap-3"><StatusBadge label={projectStatusLabels[project.status]} tone={statusTone(project.status)} />{project.primaryTeamId && teams.some((team) => team.id === project.primaryTeamId) ? <Link href={`/app/personal/teams/${project.primaryTeamId}`} className="button-tertiary">{project.teamName}</Link> : <span className="text-sm text-slate">{project.teamName ?? "Projeto independente"}</span>}</div><nav className="flex flex-wrap gap-1 border-b border-line pb-3" aria-label="Áreas do projeto">{sections.map((item) => <Link className={section === item.id ? "button-secondary bg-paper" : "button-tertiary"} href={href(item.id)} aria-current={section === item.id ? "page" : undefined} key={item.id}>{item.label}</Link>)}</nav>
    {section === "overview" ? <><ProjectPublication project={project} />{project.thematicAreas.length ? <p className="text-sm text-slate">Áreas temáticas: {project.thematicAreas.join(" · ")}</p> : null}{project.description ? <Panel className="p-5"><h2 className="mb-3 font-semibold">Sobre o projeto</h2><p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate">{project.description}</p></Panel> : null}<Panel><PanelHeader title="Próximos passos" description="Tarefas e participações atuais, com seus próprios contextos." action={<Link className="button-tertiary" href={href("tasks")}>Ver tarefas<ArrowRight size={15} aria-hidden="true" /></Link>} />{nextTasks.length ? <ul className="divide-y divide-line">{nextTasks.map((task) => <li key={task.id} className="px-5 py-4"><Link href={href("tasks")} className="flex min-h-11 items-center gap-3 font-medium"><CheckSquare size={18} className="shrink-0 text-slate" aria-hidden="true" /><span className="min-w-0 break-words">{task.title}</span></Link><p className="text-xs leading-6 text-slate">{task.assigneeName ?? "Sem responsável"} · {task.dueAt ? formatMonitoringDate(task.dueAt) : "Sem prazo definido"}{task.overdue ? " · Em atraso" : ""}</p></li>)}</ul> : <ParticipantEmpty title="Nenhuma tarefa pendente" description="Organize o próximo passo do projeto com uma tarefa." />}</Panel>{awardPage.awards.length ? <AwardSummaryList awards={awardPage.awards.slice(0, 3)} personal title="Execução nos programas" description="Os apoios e suas obrigações ficam separados do trabalho interno do projeto." /> : null}<div className="flex flex-wrap gap-3"><Link className="button-secondary" href={href("programs")}>Participações e acompanhamento</Link><Link className="button-secondary" href={href("resources")}><Link2 size={16} aria-hidden="true" />Recursos privados</Link><Link className="button-secondary" href={href("people")}><Users size={16} aria-hidden="true" />Colaboradores</Link></div></> : null}
    {section === "tasks" ? <ProjectTasks projectId={projectId} workspace={collaboration} /> : null}
    {section === "resources" ? <ProjectResources projectId={projectId} workspace={collaboration} /> : null}
    {section === "people" ? <Panel><PanelHeader title="Pessoas no projeto" description="Os membros atuais da equipe principal também têm acesso conforme seu perfil. Vínculos diretos continuam mesmo após mudanças na equipe." /><ParticipantMembers kind="projects" record={project} userId={user.id} /><GrantProjectMember project={project} /></Panel> : null}
    {section === "programs" ? <><AwardSummaryList awards={awardPage.awards} personal title="Apoios e execução" description="Termos, entregas e análise institucional após a seleção." /><Panel><PanelHeader title="Candidaturas e acompanhamento" description="A candidatura preserva o que foi enviado. O acompanhamento observa a iniciativa ao longo do tempo." action={!project.archivedAt ? <Link className="button-secondary" href="/app/personal/opportunities">Explorar editais</Link> : undefined} />{participations.length ? <PersonalApplicationList applications={participations} /> : <ParticipantEmpty title="Este projeto ainda não tem candidaturas" description="Explore editais abertos e prepare uma candidatura. Cada envio preservará uma cópia das informações apresentadas." />}</Panel><Link href="/app/personal/programs" className="button-secondary">Abrir Meus programas</Link></> : null}
    {section === "activity" ? <Panel><PanelHeader title="Atividade do projeto" description="Registros recentes derivados das participações, entregas e vínculos preservados." /><ol className="divide-y divide-line">{activity.map((event) => <li key={event.id} className="flex items-start gap-3 px-5 py-4"><Activity size={16} className="mt-1 shrink-0 text-slate" aria-hidden="true" /><div className="min-w-0"><Link href={event.href} className="inline-flex min-h-11 items-center break-words text-sm font-medium">{event.title}</Link><p className="text-xs text-slate">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Fortaleza" }).format(new Date(event.occurredAt))}</p></div></li>)}</ol></Panel> : null}
  </div>;
}
