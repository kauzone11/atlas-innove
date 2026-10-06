import { db } from "@/lib/db";
import { listPersonalApplications } from "@/lib/selection/service";

export async function getParticipantTrajectory(userId: string) {
  const [memberships, projects, applications] = await Promise.all([
    db.teamMembership.findMany({ where: { userId, status: "ACTIVE", leftAt: null }, select: { joinedAt: true, team: { select: { id: true, name: true } } } }),
    db.project.findMany({ where: { createdByUserId: userId, memberships: { some: { userId, leftAt: null } } }, select: { id: true, name: true, createdAt: true } }),
    listPersonalApplications(userId),
  ]);
  const events = [
    ...memberships.map((member) => ({ id: `team-${member.team.id}`, title: `Entrada na equipe ${member.team.name}`, occurredAt: member.joinedAt.toISOString(), href: `/app/personal/teams/${member.team.id}` })),
    ...projects.map((project) => ({ id: `project-${project.id}`, title: `Criação do projeto ${project.name}`, occurredAt: project.createdAt.toISOString(), href: `/app/personal/projects/${project.id}` })),
    ...applications.flatMap((application) => [
      ...(application.submittedAt ? [{ id: `submit-${application.id}`, title: `Candidatura enviada · ${application.fundingCall.title}`, occurredAt: application.submittedAt, href: `/app/personal/applications/${application.id}` }] : []),
      ...(application.decision === "SELECTED" && application.fundingCall.resultsPublishedAt ? [{ id: `selected-${application.id}`, title: `Projeto selecionado · ${application.fundingCall.title}`, occurredAt: application.fundingCall.resultsPublishedAt, href: `/app/personal/applications/${application.id}` }] : []),
    ]),
  ];
  return events.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || a.id.localeCompare(b.id)).slice(0, 12);
}
