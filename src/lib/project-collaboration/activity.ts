import { projectAccessWhere, requireProjectAccess } from "@/lib/auth/participant-access";
import { listPersonalAwards } from "@/lib/awards/service";
import { db } from "@/lib/db";
import { listPersonalApplications } from "@/lib/selection/service";

export type ProjectActivityDto = { id: string; title: string; occurredAt: string; href: string };

export async function getTeamProjectActivity(userId: string, projectIds: string[]): Promise<ProjectActivityDto[]> {
  if (!projectIds.length) return [];
  const projects = await db.project.findMany({ where: { id: { in: projectIds }, ...projectAccessWhere(userId) }, select: { id: true, name: true, createdAt: true } });
  const permitted = projects.map((project) => project.id);
  const [tasks, applications, awardPage] = await Promise.all([
    db.projectTask.findMany({ where: { projectId: { in: permitted }, status: "DONE" }, select: { id: true, title: true, projectId: true, completedAt: true }, orderBy: { completedAt: "desc" }, take: 12 }),
    listPersonalApplications(userId), listPersonalAwards(userId),
  ]);
  const awards = awardPage.awards.filter((award) => permitted.includes(award.application.projectId));
  const events: ProjectActivityDto[] = projects.map((project) => ({ id: `created-${project.id}`, title: `Projeto criado · ${project.name}`, occurredAt: project.createdAt.toISOString(), href: `/app/personal/projects/${project.id}` }));
  for (const task of tasks) if (task.completedAt) events.push({ id: `task-${task.id}`, title: `Tarefa concluída · ${task.title}`, occurredAt: task.completedAt.toISOString(), href: `/app/personal/projects/${task.projectId}?section=tasks` });
  for (const application of applications.filter((record) => permitted.includes(record.projectId))) if (application.submittedAt) events.push({ id: `application-${application.id}`, title: `Candidatura enviada · ${application.projectNameSnapshot}`, occurredAt: application.submittedAt, href: `/app/personal/applications/${application.id}` });
  for (const award of awards) {
    events.push({ id: `award-${award.id}`, title: `Apoio preparado · ${award.application.projectNameSnapshot}`, occurredAt: award.createdAt, href: `/app/personal/awards/${award.id}` });
    if (award.activatedAt) events.push({ id: `active-${award.id}`, title: `Execução ativada · ${award.application.projectNameSnapshot}`, occurredAt: award.activatedAt, href: `/app/personal/awards/${award.id}` });
  }
  return events.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || left.id.localeCompare(right.id)).slice(0, 12);
}

export async function getProjectActivity(userId: string, projectId: string): Promise<ProjectActivityDto[]> {
  const project = await requireProjectAccess(userId, projectId);
  const [memberships, tasks, personalApplications, awardPage] = await Promise.all([
    db.projectMembership.findMany({ where: { projectId }, select: { id: true, joinedAt: true, leftAt: true, user: { select: { email: true, profile: { select: { fullName: true } } } } }, orderBy: { joinedAt: "desc" }, take: 100 }),
    db.projectTask.findMany({ where: { projectId, status: "DONE" }, select: { id: true, title: true, completedAt: true }, orderBy: { completedAt: "desc" }, take: 30 }),
    listPersonalApplications(userId), listPersonalAwards(userId, { projectId }),
  ]);
  const awards = awardPage.awards;
  const applications = personalApplications.filter((application) => application.projectId === projectId);
  const awardScope = awards.map((award) => ({ organizationId: award.organizationId, awardId: award.id }));
  const [statusHistory, submissions, enrollments] = await Promise.all([
    awardScope.length ? db.awardStatusHistory.findMany({ where: { OR: awardScope }, select: { id: true, awardId: true, toStatus: true, changedAt: true }, orderBy: { changedAt: "desc" }, take: 30 }) : [],
    awardScope.length ? db.awardSubmission.findMany({ where: { OR: awardScope, status: "SUBMITTED" }, select: { id: true, awardId: true, submittedAt: true, reviewStatus: true, reviewedAt: true, obligation: { select: { title: true } } }, orderBy: { submittedAt: "desc" }, take: 30 }) : [],
    applications.length ? db.ventureEnrollment.findMany({ where: { OR: applications.map((application) => ({ organizationId: application.fundingCall.organization.id, applicationId: application.id })) }, select: { id: true, organizationId: true, ventureId: true, enrolledAt: true, cohort: { select: { name: true } } }, orderBy: { enrolledAt: "desc" }, take: 30 }) : [],
  ]);
  const milestones = enrollments.length ? await db.milestone.findMany({ where: { OR: enrollments.map((enrollment) => ({ organizationId: enrollment.organizationId, ventureId: enrollment.ventureId, occurredAt: { gte: enrollment.enrolledAt } })) }, select: { id: true, title: true, occurredAt: true }, orderBy: { occurredAt: "desc" }, take: 30 }) : [];
  const events: ProjectActivityDto[] = [];
  const projectHref = `/app/personal/projects/${projectId}`;
  const add = (id: string, title: string, at: Date | string | null, href = projectHref) => { if (at) events.push({ id, title, occurredAt: typeof at === "string" ? at : at.toISOString(), href }); };
  add(`created-${projectId}`, "Projeto criado", project.createdAt);
  for (const member of memberships) {
    const name = member.user.profile?.fullName ?? member.user.email;
    add(`join-${member.id}`, `Entrada no projeto · ${name}`, member.joinedAt);
    add(`left-${member.id}`, `Vínculo encerrado · ${name}`, member.leftAt);
  }
  for (const task of tasks) add(`task-${task.id}`, `Tarefa concluída · ${task.title}`, task.completedAt, `${projectHref}?section=tasks`);
  for (const application of applications) {
    const href = `/app/personal/applications/${application.id}`;
    add(`submitted-${application.id}`, `Candidatura enviada · ${application.fundingCall.title}`, application.submittedAt, href);
    if (application.decision) add(`result-${application.id}`, `Resultado publicado · ${application.fundingCall.title}`, application.fundingCall.resultsPublishedAt, href);
  }
  const lifecycleLabels: Record<string, string> = { PREPARING: "Apoio preparado", ACTIVE: "Execução ativada", SUSPENDED: "Execução suspensa", COMPLETED: "Execução concluída", TERMINATED: "Execução encerrada", CANCELLED: "Apoio cancelado" };
  for (const entry of statusHistory) add(`award-${entry.id}`, lifecycleLabels[entry.toStatus], entry.changedAt, `/app/personal/awards/${entry.awardId}`);
  for (const submission of submissions) {
    const href = `/app/personal/awards/${submission.awardId}`;
    add(`submission-${submission.id}`, `Entrega enviada · ${submission.obligation.title}`, submission.submittedAt, href);
    if (submission.reviewStatus === "APPROVED") add(`approved-${submission.id}`, `Entrega aprovada · ${submission.obligation.title}`, submission.reviewedAt, href);
  }
  for (const enrollment of enrollments) add(`enrollment-${enrollment.id}`, `Acompanhamento iniciado · ${enrollment.cohort.name}`, enrollment.enrolledAt, "/app/personal/programs");
  for (const milestone of milestones) add(`milestone-${milestone.id}`, milestone.title, milestone.occurredAt, "/app/personal?trajectory=milestones#trajectory-title");
  return events.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || left.id.localeCompare(right.id)).slice(0, 30);
}
