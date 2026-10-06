import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs, PageHeader, Panel, PanelHeader, StatusBadge } from "@/components/ui";
import { ParticipantRecordForm, ArchiveParticipantRecord } from "@/components/personal/record-form";
import { ParticipantMembers, TeamInvitation } from "@/components/personal/members";
import { ParticipantRecordList, ParticipantEmpty } from "@/components/personal/record-list";
import { PersonalApplicationList } from "@/components/personal/applications";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { getTeam, listTeams } from "@/lib/participants/service";
import { listPersonalApplications } from "@/lib/selection/service";
import { getTeamProjectActivity } from "@/lib/project-collaboration/activity";

export default async function PersonalTeam({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params; const { user } = await requireAuthenticatedSession();
  const [team, teams, applications] = await Promise.all([getTeam(user.id, teamId), listTeams(user.id), listPersonalApplications(user.id)]);
  if (!team) notFound();
  const activity = await getTeamProjectActivity(user.id, team.projects.map((project) => project.id));
  const participations = applications.filter((application) => application.teamId === teamId);
  return <div className="min-w-0 space-y-6"><PageHeader title={team.name} description={team.description ?? "Uma equipe, diferentes caminhos de inovação."} breadcrumbs={<Breadcrumbs items={[{ label: "Equipes", href: "/app/personal/teams" }, { label: team.name }]} />} action={team.canManage ? <div className="flex flex-wrap gap-2"><ParticipantRecordForm kind="team" record={team} /><TeamInvitation teamId={team.id} canInviteLead={team.callerRole === "OWNER"} />{team.canArchive ? <ArchiveParticipantRecord kind="teams" id={team.id} /> : null}</div> : undefined} /><StatusBadge label={team.archivedAt ? "Equipe arquivada" : "Equipe ativa"} /><Panel><PanelHeader title="Membros" description="A participação e as mudanças de acesso preservam o histórico da equipe." /><ParticipantMembers kind="teams" record={team} userId={user.id} /></Panel><Panel><PanelHeader title="Projetos" action={team.canManage ? <ParticipantRecordForm kind="project" teams={teams} initialTeamId={team.id} /> : undefined} />{team.projects.length ? <ParticipantRecordList kind="projects" records={team.projects} /> : <ParticipantEmpty title="Nenhum projeto vinculado" description="Crie um projeto para organizar o trabalho desta equipe." />}</Panel><Panel><PanelHeader title="Participações" description="Candidaturas desta equipe às quais você tem acesso." />{participations.length ? <PersonalApplicationList applications={participations} /> : <ParticipantEmpty title="Nenhuma candidatura nesta equipe" description="Os projetos da equipe podem participar de editais de diferentes instituições." />}</Panel><Panel><PanelHeader title="Atividade dos projetos" description="Registros recentes dos projetos aos quais você tem acesso. Tarefas e recursos continuam em cada projeto." />{activity.length ? <ol className="divide-y divide-line">{activity.map((event) => <li key={event.id} className="px-5 py-4"><Link className="inline-flex min-h-11 items-center break-words text-sm font-medium" href={event.href}>{event.title}</Link><p className="text-xs text-slate">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Fortaleza" }).format(new Date(event.occurredAt))}</p></li>)}</ol> : <ParticipantEmpty title="Nenhuma atividade nos projetos" description="As candidaturas, apoios e tarefas concluídas aparecerão neste histórico." />}</Panel></div>;
}
