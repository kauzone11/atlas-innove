import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { AuthorizationError } from "@/lib/auth/authorization";
import {
  projectAccessWhere, requireProjectAccess, requireTeamAccess, teamAccessWhere,
  type ParticipantRole,
} from "@/lib/auth/participant-access";
import { db } from "@/lib/db";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import {
  acceptTeamInviteSchema, createProjectSchema, createTeamSchema, teamInviteSchema,
  updateParticipantMemberSchema, updateProjectSchema, updateTeamSchema,
} from "@/lib/participants/schemas";
import { createOpaqueToken, hashToken, normalizeEmail } from "@/lib/security";

const userSelect = { email: true, profile: { select: { fullName: true } } } as const;
const teamSelect = {
  id: true, name: true, description: true, archivedAt: true, createdAt: true, updatedAt: true,
  memberships: { where: { status: "ACTIVE" as const, leftAt: null }, select: { userId: true, role: true } },
  _count: { select: { projects: true } },
} as const;
const projectSelect = {
  id: true, name: true, summary: true, description: true, status: true, primaryTeamId: true,
  archivedAt: true, createdAt: true, updatedAt: true,
  memberships: { where: { leftAt: null }, select: { userId: true, role: true } },
  primaryTeam: { select: { name: true, archivedAt: true, memberships: { where: { status: "ACTIVE" as const, leftAt: null }, select: { userId: true, role: true } } } },
} as const;

type TeamRecord = Prisma.TeamGetPayload<{ select: typeof teamSelect }>;
type ProjectRecord = Prisma.ProjectGetPayload<{ select: typeof projectSelect }>;
export type TeamDto = {
  id: string; name: string; description: string | null; archivedAt: string | null;
  createdAt: string; updatedAt: string; callerRole: ParticipantRole; canManage: boolean;
  memberCount: number; projectCount: number;
};
export type ProjectDto = {
  id: string; name: string; summary: string; description: string | null;
  status: "IDEA" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
  primaryTeamId: string | null; teamName: string | null; archivedAt: string | null;
  createdAt: string; updatedAt: string; callerRole: ParticipantRole; canManage: boolean; canChangeTeam: boolean; memberCount: number;
};
export type ParticipantMemberDto = {
  id: string; userId: string; role: ParticipantRole; joinedAt: string; leftAt: string | null;
  fullName: string; email: string;
};
export type TeamDetailsDto = TeamDto & {
  canArchive: boolean; members: Array<ParticipantMemberDto & { status: "ACTIVE" | "DISABLED" }>; projects: ProjectDto[];
};
export type ProjectDetailsDto = ProjectDto & {
  canArchive: boolean; canManageMembers: boolean; members: ParticipantMemberDto[];
  availableTeamMembers: Array<{ userId: string; fullName: string; email: string }>;
};

function highestRole(roles: Array<ParticipantRole | undefined>): ParticipantRole {
  if (roles.includes("OWNER")) return "OWNER";
  if (roles.includes("LEAD")) return "LEAD";
  return "MEMBER";
}

function serializeTeam(record: TeamRecord, userId: string): TeamDto {
  const callerRole = record.memberships.find((member) => member.userId === userId)?.role ?? "MEMBER";
  return {
    id: record.id, name: record.name, description: record.description,
    archivedAt: record.archivedAt?.toISOString() ?? null, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(),
    callerRole, canManage: !record.archivedAt && callerRole !== "MEMBER",
    memberCount: record.memberships.length, projectCount: record._count.projects,
  };
}

function serializeProject(record: ProjectRecord, userId: string): ProjectDto {
  const directRole = record.memberships.find((member) => member.userId === userId)?.role;
  const teamRole = !record.primaryTeam?.archivedAt ? record.primaryTeam?.memberships.find((member) => member.userId === userId)?.role : undefined;
  const callerRole = highestRole([directRole, teamRole]);
  return {
    id: record.id, name: record.name, summary: record.summary, description: record.description, status: record.status,
    primaryTeamId: record.primaryTeamId, teamName: record.primaryTeam?.name ?? null,
    archivedAt: record.archivedAt?.toISOString() ?? null, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(),
    callerRole, canManage: !record.archivedAt && record.status !== "ARCHIVED" && callerRole !== "MEMBER",
    canChangeTeam: !record.archivedAt && record.status !== "ARCHIVED" && directRole === "OWNER", memberCount: record.memberships.length,
  };
}

export async function listTeams(userId: string): Promise<TeamDto[]> {
  const records = await db.team.findMany({ where: teamAccessWhere(userId), select: teamSelect, orderBy: [{ archivedAt: "asc" }, { name: "asc" }] });
  return records.map((record) => serializeTeam(record, userId));
}

export async function getTeam(userId: string, teamId: string): Promise<TeamDetailsDto | null> {
  const record = await db.team.findFirst({
    where: { id: teamId, ...teamAccessWhere(userId) },
    select: {
      ...teamSelect,
      memberships: { select: { id: true, userId: true, role: true, status: true, joinedAt: true, leftAt: true, user: { select: userSelect } }, orderBy: { joinedAt: "asc" } },
      projects: { where: projectAccessWhere(userId), select: projectSelect, orderBy: { name: "asc" } },
    },
  });
  if (!record) return null;
  const currentMembers = record.memberships.filter((member) => member.status === "ACTIVE" && !member.leftAt);
  const team = serializeTeam({ ...record, memberships: currentMembers }, userId);
  return {
    ...team, canArchive: team.canManage && team.callerRole === "OWNER",
    members: record.memberships.map((member) => ({
      id: member.id, userId: member.userId, role: member.role, status: member.status,
      joinedAt: member.joinedAt.toISOString(), leftAt: member.leftAt?.toISOString() ?? null,
      fullName: member.user.profile?.fullName ?? member.user.email, email: member.user.email,
    })),
    projects: record.projects.map((project) => serializeProject(project, userId)),
  };
}

export async function listProjects(userId: string): Promise<ProjectDto[]> {
  const records = await db.project.findMany({ where: projectAccessWhere(userId), select: projectSelect, orderBy: [{ archivedAt: "asc" }, { name: "asc" }] });
  return records.map((record) => serializeProject(record, userId));
}

export async function getProject(userId: string, projectId: string): Promise<ProjectDetailsDto | null> {
  const record = await db.project.findFirst({
    where: { id: projectId, ...projectAccessWhere(userId) },
    select: {
      ...projectSelect,
      memberships: { select: { id: true, userId: true, role: true, joinedAt: true, leftAt: true, user: { select: userSelect } }, orderBy: { joinedAt: "asc" } },
      primaryTeam: { select: { ...projectSelect.primaryTeam.select, memberships: {
        where: { status: "ACTIVE", leftAt: null }, select: { userId: true, role: true, user: { select: userSelect } },
      } } },
    },
  });
  if (!record) return null;
  const currentMembers = record.memberships.filter((member) => !member.leftAt);
  const project = serializeProject({ ...record, memberships: currentMembers }, userId);
  const canManageMembers = project.canManage && currentMembers.some((member) => member.userId === userId && member.role === "OWNER");
  return {
    ...project, canArchive: canManageMembers, canManageMembers,
    availableTeamMembers: canManageMembers && !record.primaryTeam?.archivedAt ? (record.primaryTeam?.memberships ?? [])
      .filter((member) => !currentMembers.some((direct) => direct.userId === member.userId))
      .map((member) => ({ userId: member.userId, fullName: member.user.profile?.fullName ?? member.user.email, email: member.user.email })) : [],
    members: record.memberships.map((member) => ({
      id: member.id, userId: member.userId, role: member.role, joinedAt: member.joinedAt.toISOString(), leftAt: member.leftAt?.toISOString() ?? null,
      fullName: member.user.profile?.fullName ?? member.user.email, email: member.user.email,
    })),
  };
}

async function lockTeam(transaction: Prisma.TransactionClient, teamId: string) {
  await transaction.$queryRaw`SELECT "id" FROM "Team" WHERE "id" = ${teamId} FOR UPDATE`;
}

async function lockProject(transaction: Prisma.TransactionClient, projectId: string) {
  await transaction.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${projectId} FOR UPDATE`;
}

export async function createTeam(userId: string, value: unknown): Promise<TeamDetailsDto> {
  const input = createTeamSchema.parse(value);
  const record = await db.team.create({ data: { ...input, createdByUserId: userId, memberships: { create: { userId, role: "OWNER", status: "ACTIVE" } } }, select: { id: true } });
  const team = await getTeam(userId, record.id);
  if (!team) throw new ResourceNotFoundError("TEAM_NOT_FOUND");
  return team;
}

export async function updateTeam(userId: string, teamId: string, value: unknown): Promise<TeamDetailsDto> {
  const input = updateTeamSchema.parse(value);
  await db.$transaction(async (transaction) => {
    await lockTeam(transaction, teamId);
    const current = await requireTeamAccess(userId, teamId, true, transaction);
    if (input.archived && current.callerRole !== "OWNER") throw new AuthorizationError("PARTICIPANT_ROLE_FORBIDDEN");
    await transaction.team.update({ where: { id: teamId }, data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.archived ? { archivedAt: new Date() } : {}),
    } });
    if (input.archived) await transaction.teamInvite.updateMany({ where: { teamId, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  });
  const team = await getTeam(userId, teamId);
  if (!team) throw new ResourceNotFoundError("TEAM_NOT_FOUND");
  return team;
}

export async function inviteToTeam(userId: string, teamId: string, value: unknown): Promise<{ inviteUrl: string; expiresAt: string }> {
  const input = teamInviteSchema.parse(value);
  const rawToken = createOpaqueToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.$transaction(async (transaction) => {
    await lockTeam(transaction, teamId);
    const team = await requireTeamAccess(userId, teamId, true, transaction);
    if (team.callerRole === "LEAD" && input.role !== "MEMBER") throw new AuthorizationError("PARTICIPANT_ROLE_FORBIDDEN");
    await transaction.teamInvite.create({ data: { teamId, invitedByUserId: userId, email: input.email ?? null, role: input.role, tokenHash: hashToken(rawToken), expiresAt } });
  });
  return { inviteUrl: `/app/personal/invites?token=${rawToken}`, expiresAt: expiresAt.toISOString() };
}

export async function revokeTeamInvite(userId: string, teamId: string, inviteId: string): Promise<void> {
  await db.$transaction(async (transaction) => {
    await lockTeam(transaction, teamId);
    const team = await requireTeamAccess(userId, teamId, true, transaction);
    const invite = await transaction.teamInvite.findFirst({ where: { id: inviteId, teamId }, select: { invitedByUserId: true, acceptedAt: true } });
    if (!invite) throw new ResourceNotFoundError("TEAM_INVITE_NOT_FOUND");
    if (team.callerRole !== "OWNER" && invite.invitedByUserId !== userId) throw new AuthorizationError("PARTICIPANT_ROLE_FORBIDDEN");
    if (invite.acceptedAt) throw new DomainConflictError("TEAM_INVITE_USED");
    await transaction.teamInvite.update({ where: { id: inviteId }, data: { revokedAt: new Date() } });
  });
}

export async function acceptTeamInvite(userId: string, value: unknown): Promise<TeamDetailsDto> {
  const input = acceptTeamInviteSchema.parse(value);
  const tokenHash = hashToken(input.token);
  const teamId = await db.$transaction(async (transaction) => {
    const initial = await transaction.teamInvite.findUnique({ where: { tokenHash }, select: { teamId: true } });
    if (!initial) throw new DomainConflictError("TEAM_INVITE_INVALID");
    await lockTeam(transaction, initial.teamId);
    await transaction.$queryRaw`SELECT "id" FROM "TeamInvite" WHERE "tokenHash" = ${tokenHash} FOR UPDATE`;
    const invite = await transaction.teamInvite.findUnique({ where: { tokenHash } });
    if (!invite || invite.revokedAt) throw new DomainConflictError("TEAM_INVITE_INVALID");
    if (invite.acceptedAt) throw new DomainConflictError("TEAM_INVITE_USED");
    if (invite.expiresAt <= new Date()) throw new DomainConflictError("TEAM_INVITE_EXPIRED");
    const team = await requireTeamAccess(invite.invitedByUserId, invite.teamId, true, transaction);
    if (invite.role === "OWNER" || (team.callerRole === "LEAD" && invite.role !== "MEMBER")) throw new DomainConflictError("TEAM_INVITE_INVALID");
    const user = await transaction.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) throw new AuthorizationError("AUTHENTICATION_REQUIRED");
    if (invite.email && normalizeEmail(user.email) !== normalizeEmail(invite.email)) throw new AuthorizationError("TEAM_INVITE_EMAIL_MISMATCH");
    const existing = await transaction.teamMembership.findUnique({ where: { teamId_userId: { teamId: invite.teamId, userId } } });
    if (existing?.status === "ACTIVE" && !existing.leftAt) throw new DomainConflictError("TEAM_ALREADY_MEMBER");
    if (existing) {
      await transaction.teamMembership.update({ where: { id: existing.id }, data: { role: invite.role, status: "ACTIVE", leftAt: null, joinedAt: new Date() } });
    } else {
      await transaction.teamMembership.create({ data: { teamId: invite.teamId, userId, role: invite.role, status: "ACTIVE" } });
    }
    await transaction.teamInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date(), acceptedByUserId: userId } });
    return invite.teamId;
  });
  const team = await getTeam(userId, teamId);
  if (!team) throw new ResourceNotFoundError("TEAM_NOT_FOUND");
  return team;
}

function assertMembershipChange(actorRole: ParticipantRole, currentRole: ParticipantRole, nextRole: ParticipantRole, self: boolean, leave: boolean) {
  if (leave && self) return;
  if (actorRole === "OWNER") return;
  if (actorRole !== "LEAD" || currentRole !== "MEMBER" || nextRole !== "MEMBER") throw new AuthorizationError("PARTICIPANT_ROLE_FORBIDDEN");
}

export async function updateTeamMember(userId: string, teamId: string, membershipId: string, value: unknown): Promise<void> {
  const input = updateParticipantMemberSchema.parse(value);
  await db.$transaction(async (transaction) => {
    await lockTeam(transaction, teamId);
    const team = await requireTeamAccess(userId, teamId, false, transaction);
    if (team.archivedAt) throw new DomainConflictError("TEAM_ARCHIVED");
    const current = await transaction.teamMembership.findFirst({ where: { id: membershipId, teamId, status: "ACTIVE", leftAt: null } });
    if (!current) throw new ResourceNotFoundError("TEAM_MEMBERSHIP_NOT_FOUND");
    const action = "action" in input ? input.action : null;
    const nextRole = "role" in input ? input.role : current.role;
    if (action === "leave" && current.userId !== userId) throw new AuthorizationError("PARTICIPANT_ROLE_FORBIDDEN");
    assertMembershipChange(team.callerRole, current.role, nextRole, current.userId === userId, action === "leave");
    if (current.role === "OWNER" && (action || nextRole !== "OWNER")) {
      const owners = await transaction.teamMembership.count({ where: { teamId, role: "OWNER", status: "ACTIVE", leftAt: null } });
      if (owners <= 1) throw new DomainConflictError("PARTICIPANT_LAST_OWNER_REQUIRED");
    }
    await transaction.teamMembership.update({ where: { id: current.id }, data: action ? { status: "DISABLED", leftAt: new Date() } : { role: nextRole } });
    if (action || nextRole === "MEMBER") await transaction.teamInvite.updateMany({ where: { teamId, invitedByUserId: current.userId, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  });
}

export async function createProject(userId: string, value: unknown): Promise<ProjectDetailsDto> {
  const input = createProjectSchema.parse(value);
  if (input.status === "ARCHIVED") throw new DomainConflictError("PROJECT_STATUS_TRANSITION_INVALID");
  const projectId = await db.$transaction(async (transaction) => {
    if (input.primaryTeamId) {
      await lockTeam(transaction, input.primaryTeamId);
      await requireTeamAccess(userId, input.primaryTeamId, true, transaction);
    }
    const record = await transaction.project.create({ data: { ...input, primaryTeamId: input.primaryTeamId ?? null, createdByUserId: userId, memberships: { create: { userId, role: "OWNER" } } }, select: { id: true } });
    return record.id;
  });
  const project = await getProject(userId, projectId);
  if (!project) throw new ResourceNotFoundError("PROJECT_NOT_FOUND");
  return project;
}

export async function updateProject(userId: string, projectId: string, value: unknown): Promise<ProjectDetailsDto> {
  const input = updateProjectSchema.parse(value);
  await db.$transaction(async (transaction) => {
    const initial = await transaction.project.findUnique({ where: { id: projectId }, select: { primaryTeamId: true } });
    const teamIds = [...new Set([initial?.primaryTeamId, input.primaryTeamId].filter((id): id is string => Boolean(id)))].sort();
    for (const teamId of teamIds) await lockTeam(transaction, teamId);
    await lockProject(transaction, projectId);
    const current = await requireProjectAccess(userId, projectId, true, transaction);
    if (current.primaryTeamId && !teamIds.includes(current.primaryTeamId)) throw new DomainConflictError("PROJECT_CONCURRENT_CHANGE");
    if ((input.status === "ARCHIVED" || input.primaryTeamId !== undefined) && current.directRole !== "OWNER") throw new AuthorizationError("PARTICIPANT_ROLE_FORBIDDEN");
    if (input.primaryTeamId) await requireTeamAccess(userId, input.primaryTeamId, true, transaction);
    await transaction.project.update({ where: { id: projectId }, data: { ...input, ...(input.status === "ARCHIVED" ? { archivedAt: new Date() } : {}) } });
  });
  const project = await getProject(userId, projectId);
  if (!project) throw new ResourceNotFoundError("PROJECT_NOT_FOUND");
  return project;
}

const addProjectMemberSchema = z.object({ userId: z.string().min(1).max(128), role: z.enum(["LEAD", "MEMBER"]).default("MEMBER") }).strict();

export async function addProjectMember(userId: string, projectId: string, value: unknown): Promise<void> {
  const input = addProjectMemberSchema.parse(value);
  await db.$transaction(async (transaction) => {
    const initial = await transaction.project.findUnique({ where: { id: projectId }, select: { primaryTeamId: true } });
    if (initial?.primaryTeamId) await lockTeam(transaction, initial.primaryTeamId);
    await lockProject(transaction, projectId);
    const project = await requireProjectAccess(userId, projectId, true, transaction);
    if (project.primaryTeamId !== initial?.primaryTeamId) throw new DomainConflictError("PROJECT_CONCURRENT_CHANGE");
    if (project.directRole !== "OWNER") throw new AuthorizationError("PARTICIPANT_ROLE_FORBIDDEN");
    if (!project.primaryTeamId) throw new DomainConflictError("PROJECT_TEAM_REQUIRED");
    const team = await requireTeamAccess(input.userId, project.primaryTeamId, false, transaction);
    if (team.archivedAt) throw new DomainConflictError("TEAM_ARCHIVED");
    const existing = await transaction.projectMembership.findUnique({ where: { projectId_userId: { projectId, userId: input.userId } } });
    if (existing && !existing.leftAt) throw new DomainConflictError("PROJECT_ALREADY_MEMBER");
    await transaction.projectMembership.upsert({
      where: { projectId_userId: { projectId, userId: input.userId } },
      create: { projectId, userId: input.userId, role: input.role },
      update: { role: input.role, leftAt: null, joinedAt: new Date() },
    });
  });
}

export async function updateProjectMember(userId: string, projectId: string, membershipId: string, value: unknown): Promise<void> {
  const input = updateParticipantMemberSchema.parse(value);
  await db.$transaction(async (transaction) => {
    await lockProject(transaction, projectId);
    const project = await requireProjectAccess(userId, projectId, false, transaction);
    if (project.archivedAt || project.status === "ARCHIVED") throw new DomainConflictError("PROJECT_ARCHIVED");
    const current = await transaction.projectMembership.findFirst({ where: { id: membershipId, projectId, leftAt: null } });
    if (!current) throw new ResourceNotFoundError("PROJECT_MEMBERSHIP_NOT_FOUND");
    const action = "action" in input ? input.action : null;
    const nextRole = "role" in input ? input.role : current.role;
    if (action === "leave" && current.userId !== userId) throw new AuthorizationError("PARTICIPANT_ROLE_FORBIDDEN");
    if (action !== "leave" && project.directRole !== "OWNER") throw new AuthorizationError("PARTICIPANT_ROLE_FORBIDDEN");
    assertMembershipChange(project.callerRole, current.role, nextRole, current.userId === userId, action === "leave");
    if (current.role === "OWNER" && (action || nextRole !== "OWNER")) {
      const owners = await transaction.projectMembership.count({ where: { projectId, role: "OWNER", leftAt: null } });
      if (owners <= 1) throw new DomainConflictError("PARTICIPANT_LAST_OWNER_REQUIRED");
    }
    await transaction.projectMembership.update({ where: { id: current.id }, data: action ? { leftAt: new Date() } : { role: nextRole } });
  });
}
