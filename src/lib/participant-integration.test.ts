import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { requireProjectAccess, requireTeamAccess } from "@/lib/auth/participant-access";
import { db } from "@/lib/db";
import {
  acceptTeamInvite, addProjectMember, createProject, createTeam, getProject, getTeam,
  inviteToTeam, listProjects, listTeams, revokeTeamInvite, updateProject, updateProjectMember,
  updateTeam, updateTeamMember,
} from "@/lib/participants/service";
import { hashToken } from "@/lib/security";

function tokenFromInvite(invite: { inviteUrl: string }): string {
  const token = new URL(invite.inviteUrl, "http://localhost").searchParams.get("token");
  assert.ok(token);
  return token;
}

test("participant services preserve private identities, secure invitations and durable access", async (context) => {
  if (!process.env.DATABASE_URL) {
    assert.notEqual(process.env.CI, "true", "CI requires a disposable DATABASE_URL for participant integration tests");
    context.skip("DATABASE_URL is not configured for the integration harness");
    return;
  }
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const userIds: string[] = [];
  const teamIds: string[] = [];
  const projectIds: string[] = [];
  try {
    const people = [];
    for (const label of ["owner", "lead", "member", "outsider", "race-a", "race-b"]) {
      const user = await db.user.create({ data: {
        email: `participant-${label}-${suffix}@example.test`, passwordHash: "test-only",
        profile: { create: { fullName: `Participant ${label}` } },
      }, select: { id: true, email: true } });
      people.push(user);
      userIds.push(user.id);
    }
    const [owner, lead, member, outsider, raceA, raceB] = people;
    const team = await createTeam(owner.id, { name: `Private team ${suffix}`, description: "Research team" });
    teamIds.push(team.id);
    const unrelated = await createTeam(outsider.id, { name: "Other participant team" });
    teamIds.push(unrelated.id);

    await context.test("team membership is private and does not require an organization", async () => {
      assert.equal(await db.organizationMembership.count({ where: { userId: owner.id } }), 0);
      assert.equal(team.callerRole, "OWNER");
      assert.equal(team.canManage, true);
      assert.equal(await getTeam(outsider.id, team.id), null);
      assert.deepEqual((await listTeams(outsider.id)).map((record) => record.id), [unrelated.id]);
      await assert.rejects(() => updateTeam(outsider.id, team.id, { name: "Intrusion" }), /TEAM_NOT_FOUND/);
      await assert.rejects(() => requireTeamAccess(outsider.id, team.id), /TEAM_NOT_FOUND/);
      assert.equal(JSON.stringify(team).includes("passwordHash"), false);
      assert.equal(JSON.stringify(team).includes("tokenHash"), false);
    });

    await context.test("invitations store hashes, enforce email, expiry and revocation, and are single-use", async () => {
      const invite = await inviteToTeam(owner.id, team.id, { email: lead.email, role: "LEAD" });
      const token = tokenFromInvite(invite);
      const stored = await db.teamInvite.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } });
      assert.notEqual(stored.tokenHash, token);
      assert.equal(stored.email, lead.email);
      await assert.rejects(() => acceptTeamInvite(outsider.id, { token }), /TEAM_INVITE_EMAIL_MISMATCH/);
      assert.equal((await acceptTeamInvite(lead.id, { token })).callerRole, "LEAD");
      await assert.rejects(() => acceptTeamInvite(lead.id, { token }), /TEAM_INVITE_USED/);
      await assert.rejects(() => inviteToTeam(lead.id, team.id, { role: "LEAD" }), /PARTICIPANT_ROLE_FORBIDDEN/);
      const memberInvite = await inviteToTeam(lead.id, team.id, { role: "MEMBER" });
      assert.equal((await acceptTeamInvite(member.id, { token: tokenFromInvite(memberInvite) })).callerRole, "MEMBER");
      const expired = tokenFromInvite(await inviteToTeam(owner.id, team.id, {}));
      await db.teamInvite.update({ where: { tokenHash: hashToken(expired) }, data: { expiresAt: new Date(0) } });
      await assert.rejects(() => acceptTeamInvite(outsider.id, { token: expired }), /TEAM_INVITE_EXPIRED/);
      const revoked = tokenFromInvite(await inviteToTeam(owner.id, team.id, {}));
      const revokedRecord = await db.teamInvite.findUniqueOrThrow({ where: { tokenHash: hashToken(revoked) } });
      await revokeTeamInvite(owner.id, team.id, revokedRecord.id);
      await assert.rejects(() => acceptTeamInvite(outsider.id, { token: revoked }), /TEAM_INVITE_INVALID/);
      const race = tokenFromInvite(await inviteToTeam(owner.id, team.id, {}));
      const results = await Promise.allSettled([acceptTeamInvite(raceA.id, { token: race }), acceptTeamInvite(raceB.id, { token: race })]);
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      assert.equal(results.filter((result) => result.status === "rejected").length, 1);
      const accepted = await db.teamInvite.findUniqueOrThrow({ where: { tokenHash: hashToken(race) } });
      assert.ok([raceA.id, raceB.id].includes(accepted.acceptedByUserId ?? ""));
    });

    const project = await createProject(owner.id, { name: "Durable project", summary: "A participant initiative preserved across calls.", primaryTeamId: team.id });
    projectIds.push(project.id);
    await context.test("project access derives from current team membership and explicit grants persist deliberately", async () => {
      assert.equal(await getProject(outsider.id, project.id), null);
      assert.deepEqual(await listProjects(outsider.id), []);
      await assert.rejects(() => updateProject(outsider.id, project.id, { name: "Intrusion" }), /PROJECT_NOT_FOUND/);
      assert.equal((await getProject(member.id, project.id))?.canManage, false);
      await assert.rejects(() => updateProject(member.id, project.id, { name: "Intrusion" }), /PARTICIPANT_ROLE_FORBIDDEN/);
      await updateProject(lead.id, project.id, { summary: "A new live summary leaves identity intact." });
      assert.equal(await db.projectMembership.count({ where: { projectId: project.id, userId: lead.id } }), 0);
      await assert.rejects(() => updateProject(lead.id, project.id, { primaryTeamId: null }), /PARTICIPANT_ROLE_FORBIDDEN/);
      await addProjectMember(owner.id, project.id, { userId: member.id, role: "LEAD" });
      const leadMembership = await db.teamMembership.findFirstOrThrow({ where: { teamId: team.id, userId: lead.id, status: "ACTIVE", leftAt: null } });
      await updateTeamMember(owner.id, team.id, leadMembership.id, { action: "remove" });
      assert.equal(await getProject(lead.id, project.id), null);
      await assert.rejects(() => requireProjectAccess(lead.id, project.id, true), /PROJECT_NOT_FOUND/);
      const memberMembership = await db.teamMembership.findFirstOrThrow({ where: { teamId: team.id, userId: member.id, status: "ACTIVE", leftAt: null } });
      await updateTeamMember(owner.id, team.id, memberMembership.id, { action: "remove" });
      assert.equal((await getProject(member.id, project.id))?.canManage, true);
      await updateProject(member.id, project.id, { name: "Explicit participant project" });
      const history = await db.teamMembership.findUniqueOrThrow({ where: { id: memberMembership.id } });
      assert.equal(history.status, "DISABLED");
      assert.ok(history.leftAt);
      assert.equal(JSON.stringify(await getProject(owner.id, project.id)).includes("passwordHash"), false);
    });

    await context.test("owner hierarchy and concurrent removals retain one active project owner", async () => {
      const ownerMembership = await db.projectMembership.findFirstOrThrow({ where: { projectId: project.id, userId: owner.id, leftAt: null } });
      const memberMembership = await db.projectMembership.findFirstOrThrow({ where: { projectId: project.id, userId: member.id, leftAt: null } });
      await assert.rejects(() => updateProjectMember(owner.id, project.id, ownerMembership.id, { action: "leave" }), /PARTICIPANT_LAST_OWNER_REQUIRED/);
      await assert.rejects(() => updateProjectMember(member.id, project.id, memberMembership.id, { role: "OWNER" }), /PARTICIPANT_ROLE_FORBIDDEN/);
      await updateProjectMember(owner.id, project.id, memberMembership.id, { role: "OWNER" });
      const results = await Promise.allSettled([
        updateProjectMember(owner.id, project.id, ownerMembership.id, { action: "leave" }),
        updateProjectMember(member.id, project.id, memberMembership.id, { action: "leave" }),
      ]);
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      assert.equal(await db.projectMembership.count({ where: { projectId: project.id, role: "OWNER", leftAt: null } }), 1);
    });

    await context.test("owner hierarchy and concurrent demotions retain one active team owner", async () => {
      const ownerMembership = await db.teamMembership.findFirstOrThrow({ where: { teamId: team.id, userId: owner.id, status: "ACTIVE", leftAt: null } });
      await assert.rejects(() => updateTeamMember(owner.id, team.id, ownerMembership.id, { action: "leave" }), /PARTICIPANT_LAST_OWNER_REQUIRED/);
      const candidate = await db.teamMembership.findFirstOrThrow({ where: { teamId: team.id, userId: { in: [raceA.id, raceB.id] }, status: "ACTIVE" } });
      await assert.rejects(() => updateTeamMember(candidate.userId, team.id, candidate.id, { role: "OWNER" }), /PARTICIPANT_ROLE_FORBIDDEN/);
      await updateTeamMember(owner.id, team.id, candidate.id, { role: "OWNER" });
      const results = await Promise.allSettled([
        updateTeamMember(owner.id, team.id, ownerMembership.id, { role: "MEMBER" }),
        updateTeamMember(candidate.userId, team.id, candidate.id, { role: "MEMBER" }),
      ]);
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      assert.equal(await db.teamMembership.count({ where: { teamId: team.id, role: "OWNER", status: "ACTIVE", leftAt: null } }), 1);
    });

    await context.test("archiving is restricted to owners and retains historical reads", async () => {
      const projectOwner = await db.projectMembership.findFirstOrThrow({ where: { projectId: project.id, role: "OWNER", leftAt: null } });
      await updateProject(projectOwner.userId, project.id, { status: "ARCHIVED" });
      assert.ok((await getProject(projectOwner.userId, project.id))?.archivedAt);
      await assert.rejects(() => updateProject(projectOwner.userId, project.id, { status: "ACTIVE" }), /PROJECT_ARCHIVED/);
      await assert.rejects(() => updateProject(projectOwner.userId, project.id, { name: "Changed history" }), /PROJECT_ARCHIVED/);
      const teamOwner = await db.teamMembership.findFirstOrThrow({ where: { teamId: team.id, role: "OWNER", status: "ACTIVE", leftAt: null } });
      await updateTeam(teamOwner.userId, team.id, { archived: true });
      assert.ok((await getTeam(teamOwner.userId, team.id))?.archivedAt);
      await assert.rejects(() => inviteToTeam(teamOwner.userId, team.id, {}), /TEAM_ARCHIVED/);
      await assert.rejects(() => createProject(teamOwner.userId, { name: "Archived team project", summary: "This project must not be created.", primaryTeamId: team.id }), /TEAM_ARCHIVED/);
    });
  } finally {
    if (projectIds.length) await db.project.deleteMany({ where: { id: { in: projectIds } } });
    if (teamIds.length) await db.team.deleteMany({ where: { id: { in: teamIds } } });
    if (userIds.length) await db.user.deleteMany({ where: { id: { in: userIds } } });
  }
});
