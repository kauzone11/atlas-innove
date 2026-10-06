import { historicalParticipantApplicationIds } from "@/lib/auth/participant-access";
import { db } from "@/lib/db";

export type TrajectoryEventType = "TEAM_JOINED" | "TEAM_LEFT" | "PROJECT_CREATED" | "PROJECT_JOINED" | "PROJECT_LEFT" | "APPLICATION_SUBMITTED" | "APPLICATION_WITHDRAWN" | "APPLICATION_SELECTED" | "COHORT_JOINED" | "VENTURE_MILESTONE";
export type TrajectoryEvent = { id: string; type: TrajectoryEventType; category: "teams" | "projects" | "programs" | "milestones"; title: string; occurredAt: string; href: string };
export type VerifiedParticipation = { id: string; institution: string; program: string; call: string; projectName: string | null; projectUrl: string | null; date: string };

export async function getVerifiedParticipations(userId: string, { publicOnly = false }: { publicOnly?: boolean } = {}): Promise<VerifiedParticipation[]> {
  const applicationIds = await historicalParticipantApplicationIds(userId);
  if (!applicationIds.length) return [];
  const applications = await db.application.findMany({
    where: { id: { in: applicationIds }, submittedAt: { not: null }, decision: "SELECTED", fundingCall: { resultsPublishedAt: { not: null }, ...(publicOnly ? { publicListingEnabled: true, organization: { status: "ACTIVE" } } : {}) } },
    select: {
      id: true, projectId: true,
      fundingCall: { select: { title: true, resultsPublishedAt: true, organization: { select: { name: true } }, fundingProgram: { select: { name: true } } } },
    }, orderBy: [{ submittedAt: "desc" }, { id: "asc" }],
  });
  const [publicProjects, snapshots] = await Promise.all([
    db.project.findMany({ where: { id: { in: applications.map((application) => application.projectId) }, visibility: "PUBLIC", publishedAt: { not: null }, publicSlug: { not: null }, archivedAt: null, status: { not: "ARCHIVED" } }, select: { id: true, name: true, publicSlug: true } }),
    publicOnly ? Promise.resolve([]) : db.application.findMany({ where: { id: { in: applications.map((application) => application.id) } }, select: { id: true, projectNameSnapshot: true } }),
  ]);
  const publicById = new Map(publicProjects.map((project) => [project.id, project]));
  const namesById = new Map(snapshots.map((application) => [application.id, application.projectNameSnapshot]));
  return applications.map((application) => {
    const publicProject = publicById.get(application.projectId);
    return {
      id: application.id, institution: application.fundingCall.organization.name, program: application.fundingCall.fundingProgram.name,
      call: application.fundingCall.title, date: application.fundingCall.resultsPublishedAt!.toISOString(),
      projectName: publicOnly ? publicProject?.name ?? null : namesById.get(application.id) ?? null,
      projectUrl: publicProject ? `/projects/${publicProject.publicSlug}` : null,
    };
  });
}

export async function getParticipantTrajectory(userId: string): Promise<TrajectoryEvent[]> {
  const [teams, memberships, projects, applicationIds] = await Promise.all([
    db.teamMembership.findMany({ where: { userId }, select: { id: true, joinedAt: true, leftAt: true, status: true, team: { select: { id: true, name: true } } } }),
    db.projectMembership.findMany({ where: { userId }, select: { id: true, joinedAt: true, leftAt: true, project: { select: { id: true, name: true, createdByUserId: true } } } }),
    db.project.findMany({ where: { createdByUserId: userId }, select: { id: true, name: true, createdAt: true } }),
    historicalParticipantApplicationIds(userId),
  ]);
  const applications = await db.application.findMany({
    where: { OR: [{ id: { in: applicationIds } }, { submittedByUserId: userId, submittedAt: null, withdrawnAt: { not: null } }] },
    select: {
      id: true, submittedAt: true, withdrawnAt: true, decision: true,
      fundingCall: { select: { title: true, resultsPublishedAt: true } },
      enrollments: { select: { id: true, organizationId: true, ventureId: true, enrolledAt: true, cohort: { select: { name: true } } } },
    },
  });
  const enrollments = applications.filter((application) => application.decision === "SELECTED" && application.fundingCall.resultsPublishedAt).flatMap((application) => application.enrollments.map((enrollment) => ({ ...enrollment, applicationId: application.id })));
  const milestones = enrollments.length ? await db.milestone.findMany({
    where: { OR: enrollments.map((enrollment) => ({ organizationId: enrollment.organizationId, ventureId: enrollment.ventureId, occurredAt: { gte: enrollment.enrolledAt } })) },
    select: { id: true, organizationId: true, ventureId: true, title: true, type: true, occurredAt: true },
  }) : [];
  const events: TrajectoryEvent[] = [];
  const add = (id: string, type: TrajectoryEventType, category: TrajectoryEvent["category"], title: string, at: Date, href: string) => events.push({ id, type, category, title, occurredAt: at.toISOString(), href });
  for (const member of teams) {
    const href = member.status === "ACTIVE" && !member.leftAt ? `/app/personal/teams/${member.team.id}` : "/app/personal/teams";
    add(`team-join-${member.id}`, "TEAM_JOINED", "teams", `Entrada na equipe ${member.team.name}`, member.joinedAt, href);
    if (member.leftAt) add(`team-left-${member.id}`, "TEAM_LEFT", "teams", `Participação encerrada · ${member.team.name}`, member.leftAt, href);
  }
  for (const project of projects) add(`project-create-${project.id}`, "PROJECT_CREATED", "projects", `Criação do projeto ${project.name}`, project.createdAt, "/app/personal/projects");
  for (const member of memberships) {
    const href = member.leftAt ? "/app/personal/projects" : `/app/personal/projects/${member.project.id}`;
    if (member.project.createdByUserId !== userId || projects.every((project) => project.id !== member.project.id || project.createdAt.getTime() !== member.joinedAt.getTime())) add(`project-join-${member.id}`, "PROJECT_JOINED", "projects", `Entrada no projeto ${member.project.name}`, member.joinedAt, href);
    if (member.leftAt) add(`project-left-${member.id}`, "PROJECT_LEFT", "projects", `Participação encerrada · ${member.project.name}`, member.leftAt, href);
  }
  for (const application of applications) {
    const href = `/app/personal/applications/${application.id}`;
    if (application.submittedAt) add(`submitted-${application.id}`, "APPLICATION_SUBMITTED", "programs", `Candidatura enviada · ${application.fundingCall.title}`, application.submittedAt, href);
    if (application.withdrawnAt) add(`withdrawn-${application.id}`, "APPLICATION_WITHDRAWN", "programs", `Candidatura retirada · ${application.fundingCall.title}`, application.withdrawnAt, href);
    if (application.decision === "SELECTED" && application.fundingCall.resultsPublishedAt) add(`selected-${application.id}`, "APPLICATION_SELECTED", "programs", `Projeto selecionado · ${application.fundingCall.title}`, application.fundingCall.resultsPublishedAt, href);
  }
  for (const enrollment of enrollments) add(`cohort-${enrollment.id}`, "COHORT_JOINED", "programs", `Ingresso na coorte ${enrollment.cohort.name}`, enrollment.enrolledAt, `/app/personal/applications/${enrollment.applicationId}`);
  for (const milestone of milestones) {
    const enrollment = enrollments.find((entry) => entry.organizationId === milestone.organizationId && entry.ventureId === milestone.ventureId && entry.enrolledAt <= milestone.occurredAt)!;
    add(`milestone-${milestone.id}`, "VENTURE_MILESTONE", "milestones", milestone.title, milestone.occurredAt, `/app/personal/applications/${enrollment.applicationId}`);
  }
  return events.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || a.id.localeCompare(b.id));
}
