import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { db } from "@/lib/db";
import { acceptTeamInvite, addProjectMember, createProject, createTeam, getProject, getTeam, inviteToTeam, updateProjectMember, updateTeamMember } from "@/lib/participants/service";

test("membership periods survive leaving and rejoining while current access and uniqueness remain enforced", async (context) => {
  if (!process.env.DATABASE_URL) { assert.notEqual(process.env.CI, "true"); context.skip("A disposable PostgreSQL database is required."); return; }
  const suffix = randomUUID();
  const users = await Promise.all(["owner", "member"].map((label) => db.user.create({ data: { email: `history-${label}-${suffix}@example.test`, passwordHash: "test-only" } })));
  const [owner, member] = users;
  let teamId: string | undefined; let projectId: string | undefined;
  const join = async (role: "LEAD" | "MEMBER") => {
    const invite = await inviteToTeam(owner.id, teamId!, { role });
    const token = new URL(invite.inviteUrl, "http://localhost").searchParams.get("token")!;
    return acceptTeamInvite(member.id, { token });
  };
  try {
    const team = await createTeam(owner.id, { name: "Historical collaborators" }); teamId = team.id;
    await join("LEAD");
    const firstTeam = await db.teamMembership.findFirstOrThrow({ where: { teamId, userId: member.id, status: "ACTIVE", leftAt: null } });
    await updateTeamMember(member.id, teamId, firstTeam.id, { action: "leave" });
    const endedTeam = await db.teamMembership.findUniqueOrThrow({ where: { id: firstTeam.id } });
    assert.equal(await getTeam(member.id, teamId), null);
    assert.ok(endedTeam.leftAt);
    await join("MEMBER");
    const teamPeriods = await db.teamMembership.findMany({ where: { teamId, userId: member.id }, orderBy: [{ joinedAt: "asc" }, { id: "asc" }] });
    assert.equal(teamPeriods.length, 2);
    assert.deepEqual(await db.teamMembership.findUnique({ where: { id: firstTeam.id } }), endedTeam);
    const currentTeam = teamPeriods.find((period) => period.leftAt === null)!;
    assert.notEqual(currentTeam.id, firstTeam.id); assert.equal(currentTeam.role, "MEMBER");
    assert.equal((await getTeam(owner.id, teamId))?.members.filter((period) => period.userId === member.id).length, 2);
    await assert.rejects(() => updateTeamMember(owner.id, teamId!, firstTeam.id, { role: "OWNER" }), /TEAM_MEMBERSHIP_NOT_FOUND/);
    await assert.rejects(() => db.teamMembership.create({ data: { teamId: teamId!, userId: member.id, role: "OWNER" } }), (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "P2002");
    const ownerTeam = await db.teamMembership.findFirstOrThrow({ where: { teamId, userId: owner.id, status: "ACTIVE", leftAt: null } });
    await assert.rejects(() => updateTeamMember(owner.id, teamId!, ownerTeam.id, { action: "leave" }), /PARTICIPANT_LAST_OWNER_REQUIRED/);

    const project = await createProject(owner.id, { name: "Historical project", summary: "One continuous project with many participation periods.", primaryTeamId: teamId }); projectId = project.id;
    await addProjectMember(owner.id, projectId, { userId: member.id, role: "LEAD" });
    const firstProject = await db.projectMembership.findFirstOrThrow({ where: { projectId, userId: member.id, leftAt: null } });
    await updateTeamMember(member.id, teamId, currentTeam.id, { action: "leave" });
    assert.ok(await getProject(member.id, projectId));
    await updateProjectMember(member.id, projectId, firstProject.id, { action: "leave" });
    const endedProject = await db.projectMembership.findUniqueOrThrow({ where: { id: firstProject.id } });
    assert.ok(endedProject.leftAt); assert.equal(await getProject(member.id, projectId), null);
    await join("MEMBER");
    await addProjectMember(owner.id, projectId, { userId: member.id, role: "MEMBER" });
    const projectPeriods = await db.projectMembership.findMany({ where: { projectId, userId: member.id } });
    assert.equal(projectPeriods.length, 2);
    assert.deepEqual(await db.projectMembership.findUnique({ where: { id: firstProject.id } }), endedProject);
    assert.equal(projectPeriods.find((period) => period.leftAt === null)?.role, "MEMBER");
    assert.equal((await getProject(owner.id, projectId))?.members.filter((period) => period.userId === member.id).length, 2);
    await assert.rejects(() => updateProjectMember(owner.id, projectId!, firstProject.id, { role: "OWNER" }), /PROJECT_MEMBERSHIP_NOT_FOUND/);
    await assert.rejects(() => addProjectMember(owner.id, projectId!, { userId: member.id }), /PROJECT_ALREADY_MEMBER/);
    await assert.rejects(() => db.projectMembership.create({ data: { projectId: projectId!, userId: member.id } }), (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "P2002");
    const ownerProject = await db.projectMembership.findFirstOrThrow({ where: { projectId, userId: owner.id, leftAt: null } });
    await assert.rejects(() => updateProjectMember(owner.id, projectId!, ownerProject.id, { action: "leave" }), /PARTICIPANT_LAST_OWNER_REQUIRED/);
  } finally {
    if (projectId) await db.project.delete({ where: { id: projectId } });
    if (teamId) await db.team.delete({ where: { id: teamId } });
    await db.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
  }
});
