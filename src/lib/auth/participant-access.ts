import { Prisma } from "@prisma/client";
import { submittedApplicationParticipantsSql } from "@/lib/auth/application-history";

import { AuthorizationError } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";

export type ParticipantRole = "OWNER" | "LEAD" | "MEMBER";

export function teamAccessWhere(userId: string): Prisma.TeamWhereInput {
  return { memberships: { some: { userId, status: "ACTIVE", leftAt: null } } };
}

export function projectAccessWhere(userId: string): Prisma.ProjectWhereInput {
  return {
    OR: [
      { memberships: { some: { userId, leftAt: null } } },
      { primaryTeam: { memberships: { some: { userId, status: "ACTIVE", leftAt: null } } } },
    ],
  };
}

export async function participantApplicationAccessWhere(userId: string, client: Prisma.TransactionClient = db): Promise<Prisma.ApplicationWhereInput> {
  const historical = await historicalParticipantApplicationIds(userId, client);
  return { OR: [{ id: { in: historical } }, { project: projectAccessWhere(userId) }] };
}

export async function historicalParticipantApplicationIds(userId: string, client: Prisma.TransactionClient = db): Promise<string[]> {
  // Submission time and the frozen team govern history; an ended period's current status cannot revoke that evidence.
  const records = await client.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT a."id" FROM "Application" a
    WHERE a."submittedAt" IS NOT NULL AND EXISTS (
      SELECT 1 FROM (${submittedApplicationParticipantsSql()}) participant WHERE participant."userId" = ${userId}
    )`);
  return records.map((record) => record.id);
}

export function canManageParticipantRole(role: ParticipantRole): boolean {
  return role === "OWNER" || role === "LEAD";
}

export async function requireTeamAccess(
  userId: string,
  teamId: string,
  manage = false,
  transaction?: Prisma.TransactionClient,
) {
  const client = transaction ?? db;
  if (manage && transaction && transaction !== db) {
    await transaction.$queryRaw`SELECT "id" FROM "Team" WHERE "id" = ${teamId} FOR UPDATE`;
  }
  const team = await client.team.findFirst({
    where: { id: teamId, ...teamAccessWhere(userId) },
    include: { memberships: { where: { userId, status: "ACTIVE", leftAt: null }, select: { role: true } } },
  });
  if (!team) throw new ResourceNotFoundError("TEAM_NOT_FOUND");
  const callerRole = team.memberships[0].role;
  const canManage = canManageParticipantRole(callerRole) && !team.archivedAt;
  if (manage && team.archivedAt) throw new DomainConflictError("TEAM_ARCHIVED");
  if (manage && !canManage) throw new AuthorizationError("PARTICIPANT_ROLE_FORBIDDEN");
  return { id: team.id, name: team.name, description: team.description, createdByUserId: team.createdByUserId, archivedAt: team.archivedAt, createdAt: team.createdAt, updatedAt: team.updatedAt, callerRole, canManage };
}

export async function requireTeamMembership(userId: string, teamId: string, transaction?: Prisma.TransactionClient) {
  return requireTeamAccess(userId, teamId, false, transaction);
}

export async function requireTeamRole(userId: string, teamId: string, minimumRole: "OWNER" | "LEAD", transaction?: Prisma.TransactionClient) {
  const team = await requireTeamAccess(userId, teamId, true, transaction);
  if (minimumRole === "OWNER" && team.callerRole !== "OWNER") throw new AuthorizationError("PARTICIPANT_ROLE_FORBIDDEN");
  return team;
}

export async function requireProjectAccess(
  userId: string,
  projectId: string,
  manage = false,
  transaction?: Prisma.TransactionClient,
) {
  const client = transaction ?? db;
  let lockedTeamId: string | null | undefined;
  if (manage && transaction && transaction !== db) {
    const initial = await transaction.project.findUnique({ where: { id: projectId }, select: { primaryTeamId: true } });
    lockedTeamId = initial?.primaryTeamId;
    if (lockedTeamId) await transaction.$queryRaw`SELECT "id" FROM "Team" WHERE "id" = ${lockedTeamId} FOR UPDATE`;
    await transaction.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${projectId} FOR UPDATE`;
  }
  const project = await client.project.findFirst({
    where: { id: projectId, ...projectAccessWhere(userId) },
    include: {
      memberships: { where: { userId, leftAt: null }, select: { role: true } },
      primaryTeam: {
        select: {
          archivedAt: true,
          memberships: { where: { userId, status: "ACTIVE", leftAt: null }, select: { role: true } },
        },
      },
    },
  });
  if (!project) throw new ResourceNotFoundError("PROJECT_NOT_FOUND");
  if (manage && transaction && transaction !== db && project.primaryTeamId !== lockedTeamId) {
    throw new DomainConflictError("PROJECT_CONCURRENT_CHANGE");
  }
  const directRole = project.memberships[0]?.role;
  const teamRole = project.primaryTeam?.memberships[0]?.role;
  const availableTeamRole = !project.primaryTeam?.archivedAt ? teamRole : undefined;
  const callerRole: ParticipantRole = [directRole, availableTeamRole].includes("OWNER") ? "OWNER"
    : [directRole, availableTeamRole].includes("LEAD") ? "LEAD" : "MEMBER";
  const canManage = !project.archivedAt && project.status !== "ARCHIVED"
    && canManageParticipantRole(callerRole);
  if (manage && (project.archivedAt || project.status === "ARCHIVED")) throw new DomainConflictError("PROJECT_ARCHIVED");
  if (manage && !canManage) throw new AuthorizationError("PARTICIPANT_ROLE_FORBIDDEN");
  return { id: project.id, name: project.name, summary: project.summary, description: project.description, status: project.status, createdByUserId: project.createdByUserId, primaryTeamId: project.primaryTeamId, archivedAt: project.archivedAt, createdAt: project.createdAt, updatedAt: project.updatedAt, visibility: project.visibility, publicSlug: project.publicSlug, publishedAt: project.publishedAt, thematicAreas: project.thematicAreas, websiteUrl: project.websiteUrl, repositoryUrl: project.repositoryUrl, demoUrl: project.demoUrl, callerRole, canManage, directRole: directRole ?? null };
}

export async function requireProjectRole(userId: string, projectId: string, minimumRole: "OWNER" | "LEAD", transaction?: Prisma.TransactionClient) {
  const project = await requireProjectAccess(userId, projectId, true, transaction);
  if (minimumRole === "OWNER" && project.directRole !== "OWNER") throw new AuthorizationError("PARTICIPANT_ROLE_FORBIDDEN");
  return project;
}
