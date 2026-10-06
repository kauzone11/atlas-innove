import { AuthorizationError } from "@/lib/auth/authorization";
import { projectAccessWhere, requireProjectAccess, requireTeamAccess, teamAccessWhere } from "@/lib/auth/participant-access";
import { db } from "@/lib/db";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import { getNetworkIdentity } from "@/lib/network/connections";
import { hasUserBlock, lockUserPair } from "@/lib/network/locking";
import { assertProjectContactAllowed, lockProjectContactUsers, lockProjectForContact, projectManagerIds } from "@/lib/network/requests";
import { inviteActionSchema, targetedInviteSchema } from "@/lib/network/schemas";
import { createNotification } from "@/lib/notifications/service";
import { acceptTeamInvite } from "@/lib/participants/service";
import { createOpaqueToken, hashToken } from "@/lib/security";

export type InviteOptions = { teams: Array<{ id: string; name: string; canInviteLead: boolean }>; projects: Array<{ id: string; name: string; canInviteLead: boolean }> };

export async function getInviteOptions(userId: string, targetUserId?: string): Promise<InviteOptions> {
  if (targetUserId && (targetUserId === userId || await hasUserBlock(db, userId, targetUserId))) return { teams: [], projects: [] };
  const [teams, projects] = await Promise.all([
    db.team.findMany({ where: { ...teamAccessWhere(userId), archivedAt: null, memberships: { some: { userId, leftAt: null, status: "ACTIVE", role: { in: ["OWNER", "LEAD"] } } }, ...(targetUserId ? { NOT: { memberships: { some: { userId: targetUserId, leftAt: null, status: "ACTIVE" } } } } : {}) }, select: { id: true, name: true, memberships: { where: { userId, leftAt: null, status: "ACTIVE" }, select: { role: true } } }, orderBy: [{ name: "asc" }, { id: "asc" }], take: 100 }),
    db.project.findMany({ where: { ...projectAccessWhere(userId), archivedAt: null, status: { not: "ARCHIVED" }, AND: [{ OR: [{ memberships: { some: { userId, leftAt: null, role: { in: ["OWNER", "LEAD"] } } } }, { primaryTeam: { archivedAt: null, memberships: { some: { userId, leftAt: null, status: "ACTIVE", role: { in: ["OWNER", "LEAD"] } } } } }] }], ...(targetUserId ? { NOT: { memberships: { some: { userId: targetUserId, leftAt: null } } } } : {}) }, select: { id: true, name: true, memberships: { where: { userId, leftAt: null }, select: { role: true } } }, orderBy: [{ name: "asc" }, { id: "asc" }], take: 100 }),
  ]);
  return { teams: teams.map((team) => ({ id: team.id, name: team.name, canInviteLead: team.memberships[0]?.role === "OWNER" })), projects: projects.map((project) => ({ id: project.id, name: project.name, canInviteLead: project.memberships[0]?.role === "OWNER" })) };
}

export async function inviteToProject(userId: string, projectId: string, value: unknown) {
  const input = targetedInviteSchema.parse(value);
  if (userId === input.invitedUserId) throw new DomainConflictError("NETWORK_SELF_ACTION");
  return db.$transaction(async (client) => {
    const managerIds = await projectManagerIds(client, projectId);
    await lockProjectContactUsers(client, [...managerIds, userId, input.invitedUserId]);
    const project = await requireProjectAccess(userId, projectId, true, client);
    if (input.role === "LEAD" && project.directRole !== "OWNER") throw new AuthorizationError("PARTICIPANT_ROLE_FORBIDDEN");
    await assertProjectContactAllowed(client, projectId, input.invitedUserId, managerIds);
    if (!await client.user.findUnique({ where: { id: input.invitedUserId }, select: { id: true } })) throw new ResourceNotFoundError("NETWORK_USER_NOT_FOUND");
    if (await client.projectMembership.findFirst({ where: { projectId, userId: input.invitedUserId, leftAt: null }, select: { id: true } })) throw new DomainConflictError("PROJECT_ALREADY_MEMBER");
    const now = new Date();
    await client.projectInvite.updateMany({ where: { projectId, invitedUserId: input.invitedUserId, acceptedAt: null, declinedAt: null, revokedAt: null, expiresAt: { lte: now } }, data: { revokedAt: now } });
    if (await client.projectInvite.findFirst({ where: { projectId, invitedUserId: input.invitedUserId, acceptedAt: null, declinedAt: null, revokedAt: null }, select: { id: true } })) throw new DomainConflictError("PROJECT_INVITE_PENDING");
    if (await client.projectInvite.count({ where: { invitedByUserId: userId, createdAt: { gte: new Date(Date.now() - 86400000) } } }) >= 30) throw new DomainConflictError("NETWORK_INVITE_LIMIT");
    const invite = await client.projectInvite.create({ data: { projectId, invitedUserId: input.invitedUserId, invitedByUserId: userId, role: input.role, expiresAt: new Date(Date.now() + 7 * 86400000) }, select: { id: true, expiresAt: true } });
    await createNotification(client, { recipientUserId: input.invitedUserId, actorUserId: userId, kind: "PROJECT_INVITE", entityType: "PROJECT_INVITE", entityId: invite.id, dedupeKey: `project-invite:${invite.id}`, title: "Convite para colaborar em projeto", body: project.name, href: "/app/personal/network/requests" });
    return { id: invite.id, expiresAt: invite.expiresAt.toISOString() };
  });
}

export async function respondProjectInvite(userId: string, inviteId: string, value: unknown) {
  const { action } = inviteActionSchema.parse(value);
  return db.$transaction(async (client) => {
    const initial = await client.projectInvite.findUnique({ where: { id: inviteId }, select: { projectId: true, invitedUserId: true, invitedByUserId: true } });
    if (!initial) throw new ResourceNotFoundError("PROJECT_INVITE_NOT_FOUND");
    const managerIds = await projectManagerIds(client, initial.projectId);
    await lockProjectContactUsers(client, [...managerIds, initial.invitedByUserId, initial.invitedUserId, userId]);
    await lockProjectForContact(client, initial.projectId);
    await client.$queryRaw`SELECT "id" FROM "ProjectInvite" WHERE "id" = ${inviteId} FOR UPDATE`;
    const invite = await client.projectInvite.findUniqueOrThrow({ where: { id: inviteId } });
    if (action === "revoke") {
      const actor = await requireProjectAccess(userId, invite.projectId, true, client);
      if (actor.directRole !== "OWNER" && invite.invitedByUserId !== userId) throw new AuthorizationError("PARTICIPANT_ROLE_FORBIDDEN");
    } else if (invite.invitedUserId !== userId) throw new AuthorizationError("PROJECT_INVITE_RECIPIENT_MISMATCH");
    if (invite.acceptedAt || invite.declinedAt || invite.revokedAt) throw new DomainConflictError("PROJECT_INVITE_RESOLVED");
    if (action === "revoke") { await client.projectInvite.update({ where: { id: inviteId }, data: { revokedAt: new Date() } }); return { projectId: invite.projectId }; }
    if (invite.expiresAt <= new Date()) throw new DomainConflictError("PROJECT_INVITE_EXPIRED");
    if (action === "accept") {
      const inviter = await requireProjectAccess(invite.invitedByUserId, invite.projectId, true, client);
      if (invite.role === "OWNER" || (invite.role === "LEAD" && inviter.directRole !== "OWNER")) throw new DomainConflictError("PROJECT_INVITE_INVALID");
      await assertProjectContactAllowed(client, invite.projectId, userId, managerIds);
      if (await client.projectMembership.findFirst({ where: { projectId: invite.projectId, userId, leftAt: null }, select: { id: true } })) throw new DomainConflictError("PROJECT_ALREADY_MEMBER");
      await client.projectMembership.create({ data: { projectId: invite.projectId, userId, role: invite.role } });
      await createNotification(client, { recipientUserId: invite.invitedByUserId, actorUserId: userId, kind: "PROJECT_INVITE_ACCEPTED", entityType: "PROJECT", entityId: invite.projectId, dedupeKey: `project-invite-accepted:${inviteId}`, title: "Convite para projeto aceito", href: `/app/personal/projects/${invite.projectId}` });
    }
    await client.projectInvite.update({ where: { id: inviteId }, data: action === "accept" ? { acceptedAt: new Date() } : { declinedAt: new Date() } });
    return { projectId: invite.projectId };
  });
}

export async function inviteKnownUserToTeam(userId: string, teamId: string, value: unknown) {
  const input = targetedInviteSchema.parse(value);
  if (userId === input.invitedUserId) throw new DomainConflictError("NETWORK_SELF_ACTION");
  return db.$transaction(async (client) => {
    await lockUserPair(client, userId, input.invitedUserId);
    const team = await requireTeamAccess(userId, teamId, true, client);
    if (team.callerRole === "LEAD" && input.role !== "MEMBER") throw new AuthorizationError("PARTICIPANT_ROLE_FORBIDDEN");
    if (await hasUserBlock(client, userId, input.invitedUserId)) throw new DomainConflictError("NETWORK_CONTACT_UNAVAILABLE");
    if (!await client.user.findUnique({ where: { id: input.invitedUserId }, select: { id: true } })) throw new ResourceNotFoundError("NETWORK_USER_NOT_FOUND");
    if (await client.teamMembership.findFirst({ where: { teamId, userId: input.invitedUserId, status: "ACTIVE", leftAt: null }, select: { id: true } })) throw new DomainConflictError("TEAM_ALREADY_MEMBER");
    const now = new Date();
    await client.teamInvite.updateMany({ where: { teamId, invitedUserId: input.invitedUserId, acceptedAt: null, declinedAt: null, revokedAt: null, expiresAt: { lte: now } }, data: { revokedAt: now } });
    if (await client.teamInvite.findFirst({ where: { teamId, invitedUserId: input.invitedUserId, acceptedAt: null, declinedAt: null, revokedAt: null }, select: { id: true } })) throw new DomainConflictError("TEAM_INVITE_PENDING");
    if (await client.teamInvite.count({ where: { invitedByUserId: userId, createdAt: { gte: new Date(Date.now() - 86400000) } } }) >= 30) throw new DomainConflictError("NETWORK_INVITE_LIMIT");
    const invite = await client.teamInvite.create({ data: { teamId, invitedByUserId: userId, invitedUserId: input.invitedUserId, role: input.role, tokenHash: hashToken(createOpaqueToken()), expiresAt: new Date(Date.now() + 7 * 86400000) }, select: { id: true, expiresAt: true } });
    await createNotification(client, { recipientUserId: input.invitedUserId, actorUserId: userId, kind: "TEAM_INVITE", entityType: "TEAM_INVITE", entityId: invite.id, dedupeKey: `team-invite:${invite.id}`, title: "Convite para entrar em equipe", body: team.name, href: "/app/personal/network/requests" });
    return { id: invite.id, expiresAt: invite.expiresAt.toISOString() };
  });
}

export async function respondTargetedTeamInvite(userId: string, inviteId: string, value: unknown) {
  const { action } = inviteActionSchema.parse(value);
  if (action === "accept") return { teamId: (await acceptTeamInvite(userId, { inviteId })).id };
  return db.$transaction(async (client) => {
    const initial = await client.teamInvite.findUnique({ where: { id: inviteId }, select: { invitedByUserId: true, invitedUserId: true, teamId: true } });
    if (!initial?.invitedUserId) throw new ResourceNotFoundError("TEAM_INVITE_NOT_FOUND");
    await lockUserPair(client, initial.invitedByUserId, initial.invitedUserId);
    await client.$queryRaw`SELECT "id" FROM "Team" WHERE "id" = ${initial.teamId} FOR UPDATE`;
    await client.$queryRaw`SELECT "id" FROM "TeamInvite" WHERE "id" = ${inviteId} FOR UPDATE`;
    const invite = await client.teamInvite.findUniqueOrThrow({ where: { id: inviteId } });
    if (action === "decline" && invite.invitedUserId !== userId) throw new AuthorizationError("TEAM_INVITE_RECIPIENT_MISMATCH");
    if (action === "revoke") {
      const actor = await requireTeamAccess(userId, invite.teamId, true, client);
      if (actor.callerRole !== "OWNER" && invite.invitedByUserId !== userId) throw new AuthorizationError("PARTICIPANT_ROLE_FORBIDDEN");
    }
    if (invite.acceptedAt || invite.declinedAt || invite.revokedAt) throw new DomainConflictError("TEAM_INVITE_INVALID");
    await client.teamInvite.update({ where: { id: inviteId }, data: action === "decline" ? { declinedAt: new Date() } : { revokedAt: new Date() } });
    return { teamId: invite.teamId };
  });
}

export async function listTargetedInvites(userId: string) {
  const where = { acceptedAt: null, declinedAt: null, revokedAt: null, expiresAt: { gt: new Date() }, OR: [{ invitedUserId: userId }, { invitedByUserId: userId }] };
  const [teams, projects] = await Promise.all([
    db.teamInvite.findMany({ where: { ...where, invitedUserId: { not: null } }, select: { id: true, teamId: true, invitedUserId: true, invitedByUserId: true, role: true, expiresAt: true, team: { select: { name: true, description: true, archivedAt: true } } }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 100 }),
    db.projectInvite.findMany({ where, select: { id: true, projectId: true, invitedUserId: true, invitedByUserId: true, role: true, expiresAt: true, project: { select: { name: true, summary: true, archivedAt: true, status: true } } }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 100 }),
  ]);
  return { teams: await Promise.all(teams.map(async (invite) => ({ id: invite.id, teamId: invite.teamId, name: invite.team.name, summary: invite.team.description, role: invite.role, incoming: invite.invitedUserId === userId, expiresAt: invite.expiresAt.toISOString(), actionable: !invite.team.archivedAt, person: await getNetworkIdentity(userId, invite.invitedUserId === userId ? invite.invitedByUserId : invite.invitedUserId!) }))), projects: await Promise.all(projects.map(async (invite) => ({ id: invite.id, projectId: invite.projectId, name: invite.project.name, summary: invite.project.summary, role: invite.role, incoming: invite.invitedUserId === userId, expiresAt: invite.expiresAt.toISOString(), actionable: !invite.project.archivedAt && invite.project.status !== "ARCHIVED", person: await getNetworkIdentity(userId, invite.invitedUserId === userId ? invite.invitedByUserId : invite.invitedUserId) }))) };
}
