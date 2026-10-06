import type { Prisma } from "@prisma/client";
import { projectAccessWhere } from "@/lib/auth/participant-access";
import { db } from "@/lib/db";
import { prioritizeActions, type ActionItem } from "@/lib/action-center/state";

function managedProjectWhere(userId: string): Prisma.ProjectWhereInput {
  return { archivedAt: null, status: { not: "ARCHIVED" }, OR: [
    { memberships: { some: { userId, leftAt: null, role: { in: ["OWNER", "LEAD"] } } } },
    { primaryTeam: { archivedAt: null, memberships: { some: { userId, leftAt: null, status: "ACTIVE", role: { in: ["OWNER", "LEAD"] } } } } },
  ] };
}

export async function getParticipantActions(userId: string): Promise<ActionItem[]> {
  const [applications, obligations, tasks] = await Promise.all([
    db.application.findMany({
      where: { status: "DRAFT", project: managedProjectWhere(userId), fundingCall: { status: "OPEN", applicationsEnabled: true, organization: { status: "ACTIVE" } } },
      select: { id: true, projectNameSnapshot: true, teamId: true, fundingCall: { select: { title: true, applicationEndsAt: true } } },
      orderBy: [{ fundingCall: { applicationEndsAt: { sort: "asc", nulls: "last" } } }, { id: "asc" }], take: 100,
    }),
    db.awardObligation.findMany({
      where: { waivedAt: null, award: { status: "ACTIVE", organization: { status: "ACTIVE" }, application: { project: managedProjectWhere(userId) } }, submissions: { none: { status: "SUBMITTED", reviewStatus: { in: ["APPROVED", "PENDING", "REJECTED"] } } } },
      select: { id: true, title: true, dueAt: true, awardId: true, award: { select: { application: { select: { projectNameSnapshot: true } } } }, submissions: { select: { status: true, reviewStatus: true }, orderBy: { version: "desc" }, take: 2 } },
      orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { id: "asc" }], take: 100,
    }),
    db.projectTask.findMany({
      where: { assigneeUserId: userId, status: { in: ["TODO", "IN_PROGRESS"] }, project: { ...projectAccessWhere(userId), archivedAt: null, status: { not: "ARCHIVED" } } },
      select: { id: true, title: true, dueAt: true, projectId: true, project: { select: { name: true } } },
      orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { id: "asc" }], take: 100,
    }),
  ]);
  const allowedTeams = new Set((await db.teamMembership.findMany({ where: { userId, leftAt: null, status: "ACTIVE", role: { in: ["OWNER", "LEAD"] }, team: { archivedAt: null } }, select: { teamId: true }, take: 1000 })).map((member) => member.teamId));
  const items: Array<Omit<ActionItem, "urgency"> & { changesRequested?: boolean }> = [
    ...applications.filter((application) => !application.teamId || allowedTeams.has(application.teamId)).map((application) => ({ id: `application-${application.id}`, kind: "APPLICATION" as const, title: "Conferir e enviar candidatura", context: `${application.projectNameSnapshot} · ${application.fundingCall.title}`, dueAt: application.fundingCall.applicationEndsAt?.toISOString().slice(0, 10) ?? null, href: `/app/personal/applications/${application.id}` })),
    ...obligations.map((obligation) => {
      const changesRequested = obligation.submissions.some((submission) => submission.reviewStatus === "CHANGES_REQUESTED");
      return { id: `obligation-${obligation.id}`, kind: changesRequested ? "REVISION" as const : "OBLIGATION" as const, title: changesRequested ? `Revisar: ${obligation.title}` : obligation.title, context: obligation.award.application.projectNameSnapshot, dueAt: obligation.dueAt?.toISOString().slice(0, 10) ?? null, changesRequested, href: `/app/personal/awards/${obligation.awardId}#obligation-${obligation.id}` };
    }),
    ...tasks.map((task) => ({ id: `task-${task.id}`, kind: "TASK" as const, title: task.title, context: task.project.name, dueAt: task.dueAt?.toISOString().slice(0, 10) ?? null, href: `/app/personal/projects/${task.projectId}?section=tasks` })),
  ];
  return prioritizeActions(items).slice(0, 40);
}
