import { notFound } from "next/navigation";
import { Breadcrumbs, PageHeader, Panel, PanelHeader, StatusBadge } from "@/components/ui";
import { ParticipantRecordForm, ArchiveParticipantRecord } from "@/components/personal/record-form";
import { ParticipantMembers, TeamInvitation } from "@/components/personal/members";
import { ParticipantRecordList, ParticipantEmpty } from "@/components/personal/record-list";
import { PersonalApplicationList } from "@/components/personal/applications";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { getTeam, listTeams } from "@/lib/participants/service";
import { listPersonalApplications } from "@/lib/selection/service";

export default async function PersonalTeam({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params; const { user } = await requireAuthenticatedSession();
  const [team, teams, applications] = await Promise.all([getTeam(user.id, teamId), listTeams(user.id), listPersonalApplications(user.id)]);
  if (!team) notFound();
  const participations = applications.filter((application) => application.teamId === teamId);
  return <div className="min-w-0 space-y-6"><PageHeader title={team.name} description={team.description ?? "Uma equipe, diferentes caminhos de inovação."} breadcrumbs={<Breadcrumbs items={[{ label: "Equipes", href: "/app/personal/teams" }, { label: team.name }]} />} action={team.canManage ? <div className="flex flex-wrap gap-2"><ParticipantRecordForm kind="team" record={team} /><TeamInvitation teamId={team.id} canInviteLead={team.callerRole === "OWNER"} />{team.canArchive ? <ArchiveParticipantRecord kind="teams" id={team.id} /> : null}</div> : undefined} /><StatusBadge label={team.archivedAt ? "Equipe arquivada" : "Equipe ativa"} /><Panel><PanelHeader title="Membros" description="A participação e as mudanças de acesso preservam o histórico da equipe." /><ParticipantMembers kind="teams" record={team} userId={user.id} /></Panel><Panel><PanelHeader title="Projetos" action={team.canManage ? <ParticipantRecordForm kind="project" teams={teams} initialTeamId={team.id} /> : undefined} />{team.projects.length ? <ParticipantRecordList kind="projects" records={team.projects} /> : <ParticipantEmpty title="Nenhum projeto vinculado" description="Crie um projeto para organizar o trabalho desta equipe." />}</Panel><Panel><PanelHeader title="Participações" description="Candidaturas desta equipe às quais você tem acesso." />{participations.length ? <PersonalApplicationList applications={participations} /> : <ParticipantEmpty title="Nenhuma candidatura nesta equipe" description="Os projetos da equipe podem participar de editais de diferentes instituições." />}</Panel></div>;
}
