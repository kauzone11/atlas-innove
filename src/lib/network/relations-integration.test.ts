import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { db } from "@/lib/db";
import { canonicalUserPair } from "@/lib/network/locking";
import { blockUser, listBlockedUsers, unblockUser } from "@/lib/network/blocks";
import { disconnectConnection, getPersonNetworkState, listConnections, respondConnectionRequest, sendConnectionRequest } from "@/lib/network/connections";
import { inviteKnownUserToTeam, inviteToProject, listTargetedInvites, respondProjectInvite, respondTargetedTeamInvite } from "@/lib/network/invites";
import { respondProjectRequest, sendProjectRequest } from "@/lib/network/requests";
import { acceptTeamInvite, createProject, createTeam, getProject, inviteToTeam, updateProjectMember, updateTeamMember } from "@/lib/participants/service";

function barrier() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

async function waitForBlockedQuery(holderPid: number, marker: string) {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    const waiting = await db.$queryRaw<Array<{ query: string }>>`SELECT a.query FROM pg_stat_activity a WHERE ${holderPid} = ANY(pg_blocking_pids(a.pid))`;
    if (waiting.some((row) => row.query.includes(marker))) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(`The contact transaction did not wait on ${marker}`);
}

test("network relationships enforce consent, roles, blocking, race safety and historical periods", async (context) => {
  if (!process.env.DATABASE_URL) { assert.notEqual(process.env.CI, "true"); context.skip("A disposable PostgreSQL database is required."); return; }
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12); const userIds: string[] = []; const projectIds: string[] = []; const teamIds: string[] = [];
  try {
    const users = [];
    for (const label of ["owner", "collaborator", "outsider", "lead"]) {
      const user = await db.user.create({ data: { email: `network-${label}-${suffix}@example.test`, passwordHash: "test-only", profile: { create: { fullName: `Network ${label}` } }, innovationProfile: { create: { handle: `${label}-${suffix}`, headline: `Research ${label}`, profileVisibility: "PLATFORM", directoryEnabled: true, collaborationStatus: "OPEN", skillsVisibility: "PRIVATE", topics: { create: { type: "SKILL", label: "Secret skill", normalizedKey: "secret skill", position: 0 } } } } } });
      users.push(user); userIds.push(user.id);
    }
    const [owner, collaborator, outsider, lead] = users;
    const project = await createProject(owner.id, { name: "Independent network project", summary: "Specialists can contribute without joining a team." }); projectIds.push(project.id);
    await db.project.update({ where: { id: project.id }, data: { visibility: "PLATFORM", directoryEnabled: true, collaborationOpen: true } });
    const team = await createTeam(owner.id, { name: "Network team" }); teamIds.push(team.id);

    await context.test("connection requests reject self, cross duplicates, wrong actors and preserve reconnect history", async () => {
      await assert.rejects(() => sendConnectionRequest(owner.id, { recipientUserId: owner.id }), /NETWORK_SELF_REQUEST/);
      const first = await sendConnectionRequest(owner.id, { recipientUserId: collaborator.id, message: "Research collaboration" });
      await assert.rejects(() => sendConnectionRequest(owner.id, { recipientUserId: collaborator.id }), /NETWORK_REQUEST_PENDING/);
      await assert.rejects(() => sendConnectionRequest(collaborator.id, { recipientUserId: owner.id }), /NETWORK_INCOMING_REQUEST/);
      assert.equal((await getPersonNetworkState(collaborator.id, owner.id)).state, "INCOMING");
      await assert.rejects(() => respondConnectionRequest(outsider.id, first.id, { action: "accept" }), /NETWORK_REQUEST_FORBIDDEN/);
      await assert.rejects(() => respondConnectionRequest(collaborator.id, first.id, { action: "cancel" }), /NETWORK_REQUEST_FORBIDDEN/);
      await respondConnectionRequest(collaborator.id, first.id, { action: "decline" });
      assert.equal((await db.connectionRequest.findUniqueOrThrow({ where: { id: first.id } })).status, "DECLINED");
      const cancelled = await sendConnectionRequest(owner.id, { recipientUserId: collaborator.id });
      await respondConnectionRequest(owner.id, cancelled.id, { action: "cancel" });
      const accepted = await sendConnectionRequest(owner.id, { recipientUserId: collaborator.id });
      await db.innovationProfile.update({ where: { userId: collaborator.id }, data: { directoryEnabled: false } });
      const race = await Promise.allSettled([respondConnectionRequest(collaborator.id, accepted.id, { action: "accept" }), respondConnectionRequest(collaborator.id, accepted.id, { action: "accept" })]);
      assert.equal(race.filter((result) => result.status === "fulfilled").length, 1);
      const connection = await db.networkConnection.findUniqueOrThrow({ where: { sourceRequestId: accepted.id } });
      await assert.rejects(() => sendConnectionRequest(owner.id, { recipientUserId: collaborator.id }), /NETWORK_PROFILE_UNAVAILABLE|NETWORK_ALREADY_CONNECTED/);
      assert.deepEqual((await listConnections(owner.id)).items[0].person.skills, []);
      await disconnectConnection(owner.id, connection.id); const historical = await db.networkConnection.findUniqueOrThrow({ where: { id: connection.id } }); assert.ok(historical.endedAt);
      await db.innovationProfile.update({ where: { userId: collaborator.id }, data: { directoryEnabled: true } });
      const reconnect = await sendConnectionRequest(owner.id, { recipientUserId: collaborator.id }); await respondConnectionRequest(collaborator.id, reconnect.id, { action: "accept" });
      assert.equal(await db.networkConnection.count({ where: { OR: [{ userAId: owner.id }, { userBId: owner.id }] } }), 2);
      assert.deepEqual(await db.networkConnection.findUnique({ where: { id: connection.id } }), historical);
    });

    await context.test("project request creates a separate member period and rejects closed projects, blocks and existing access", async () => {
      await db.project.update({ where: { id: project.id }, data: { collaborationOpen: false } });
      await assert.rejects(() => sendProjectRequest(collaborator.id, project.id, {}), /PROJECT_COLLABORATION_UNAVAILABLE/);
      await db.project.update({ where: { id: project.id }, data: { collaborationOpen: true } });
      await blockUser(owner.id, { blockedUserId: outsider.id });
      await assert.rejects(() => sendProjectRequest(outsider.id, project.id, {}), /NETWORK_CONTACT_UNAVAILABLE/);
      await unblockUser(owner.id, { blockedUserId: outsider.id });
      const cancelled = await sendProjectRequest(outsider.id, project.id, {}); await respondProjectRequest(outsider.id, project.id, cancelled.id, { action: "cancel" });
      const declined = await sendProjectRequest(outsider.id, project.id, {}); await respondProjectRequest(owner.id, project.id, declined.id, { action: "decline" });
      const request = await sendProjectRequest(collaborator.id, project.id, { message: "I can contribute" });
      await assert.rejects(() => sendProjectRequest(collaborator.id, project.id, {}), /PROJECT_REQUEST_PENDING/);
      await assert.rejects(() => respondProjectRequest(outsider.id, project.id, request.id, { action: "accept" }), /PROJECT_NOT_FOUND/);
      const race = await Promise.allSettled([respondProjectRequest(owner.id, project.id, request.id, { action: "accept" }), respondProjectRequest(owner.id, project.id, request.id, { action: "accept" })]);
      assert.equal(race.filter((result) => result.status === "fulfilled").length, 1);
      assert.equal((await getProject(collaborator.id, project.id))?.callerRole, "MEMBER");
      assert.equal(await db.teamMembership.count({ where: { userId: collaborator.id } }), 0);
      await assert.rejects(() => sendProjectRequest(collaborator.id, project.id, {}), /PROJECT_ALREADY_MEMBER/);
      const membership = await db.projectMembership.findFirstOrThrow({ where: { projectId: project.id, userId: collaborator.id, leftAt: null } });
      await updateProjectMember(collaborator.id, project.id, membership.id, { action: "leave" });
      const history = await db.projectMembership.findUniqueOrThrow({ where: { id: membership.id } });
      const rejoin = await sendProjectRequest(collaborator.id, project.id, {}); await respondProjectRequest(owner.id, project.id, rejoin.id, { action: "accept" });
      assert.equal(await db.projectMembership.count({ where: { projectId: project.id, userId: collaborator.id } }), 2);
      assert.deepEqual(await db.projectMembership.findUnique({ where: { id: membership.id } }), history);
    });

    await context.test("targeted project invites enforce roles, target, expiry, revocation and rejoin", async () => {
      await assert.rejects(() => inviteToProject(owner.id, project.id, { invitedUserId: lead.id, role: "OWNER" }));
      const invite = await inviteToProject(owner.id, project.id, { invitedUserId: lead.id, role: "LEAD" });
      await assert.rejects(() => inviteToProject(owner.id, project.id, { invitedUserId: lead.id }), /PROJECT_INVITE_PENDING/);
      await assert.rejects(() => respondProjectInvite(outsider.id, invite.id, { action: "accept" }), /PROJECT_INVITE_RECIPIENT_MISMATCH/);
      await respondProjectInvite(lead.id, invite.id, { action: "accept" });
      await assert.rejects(() => inviteToProject(lead.id, project.id, { invitedUserId: outsider.id, role: "LEAD" }), /PARTICIPANT_ROLE_FORBIDDEN/);
      const expired = await inviteToProject(lead.id, project.id, { invitedUserId: outsider.id }); await db.projectInvite.update({ where: { id: expired.id }, data: { expiresAt: new Date(0) } });
      await assert.rejects(() => respondProjectInvite(outsider.id, expired.id, { action: "accept" }), /PROJECT_INVITE_EXPIRED/);
      const revoked = await inviteToProject(lead.id, project.id, { invitedUserId: outsider.id }); await respondProjectInvite(lead.id, revoked.id, { action: "revoke" });
      await assert.rejects(() => respondProjectInvite(outsider.id, revoked.id, { action: "accept" }), /PROJECT_INVITE_RESOLVED/);
      const declined = await inviteToProject(owner.id, project.id, { invitedUserId: outsider.id }); await respondProjectInvite(outsider.id, declined.id, { action: "decline" });
      const accepted = await inviteToProject(lead.id, project.id, { invitedUserId: outsider.id }); await respondProjectInvite(outsider.id, accepted.id, { action: "accept" });
      await assert.rejects(() => inviteToProject(owner.id, project.id, { invitedUserId: outsider.id }), /PROJECT_ALREADY_MEMBER/);
      const first = await db.projectMembership.findFirstOrThrow({ where: { projectId: project.id, userId: outsider.id, leftAt: null } }); await updateProjectMember(outsider.id, project.id, first.id, { action: "leave" });
      const old = await db.projectMembership.findUniqueOrThrow({ where: { id: first.id } });
      const rejoin = await inviteToProject(owner.id, project.id, { invitedUserId: outsider.id }); await respondProjectInvite(outsider.id, rejoin.id, { action: "accept" });
      assert.equal(await db.projectMembership.count({ where: { projectId: project.id, userId: outsider.id } }), 2); assert.deepEqual(await db.projectMembership.findUnique({ where: { id: first.id } }), old);
      assert.equal(await db.teamMembership.count({ where: { userId: outsider.id } }), 0);
    });

    await context.test("targeted team invitations hide tokens and retain external token compatibility", async () => {
      const targeted = await inviteKnownUserToTeam(owner.id, team.id, { invitedUserId: collaborator.id });
      assert.equal(JSON.stringify(targeted).includes("token"), false);
      await assert.rejects(() => respondTargetedTeamInvite(outsider.id, targeted.id, { action: "accept" }), /TEAM_INVITE_RECIPIENT_MISMATCH/);
      const stored = await db.teamInvite.findUniqueOrThrow({ where: { id: targeted.id } }); assert.equal(stored.invitedUserId, collaborator.id);
      assert.equal(JSON.stringify(await listTargetedInvites(collaborator.id)).includes(stored.tokenHash), false);
      await respondTargetedTeamInvite(collaborator.id, targeted.id, { action: "accept" });
      const first = await db.teamMembership.findFirstOrThrow({ where: { teamId: team.id, userId: collaborator.id, leftAt: null } }); await updateTeamMember(collaborator.id, team.id, first.id, { action: "leave" });
      const rejoin = await inviteKnownUserToTeam(owner.id, team.id, { invitedUserId: collaborator.id }); await respondTargetedTeamInvite(collaborator.id, rejoin.id, { action: "accept" }); assert.equal(await db.teamMembership.count({ where: { teamId: team.id, userId: collaborator.id } }), 2);
      const external = await inviteToTeam(owner.id, team.id, { email: outsider.email }); const token = new URL(external.inviteUrl, "http://localhost").searchParams.get("token")!;
      await assert.rejects(() => acceptTeamInvite(lead.id, { token }), /TEAM_INVITE_EMAIL_MISMATCH/); await acceptTeamInvite(outsider.id, { token });
    });

    await context.test("blocking atomically ends contacts without removing operational memberships or restoring on unblock", async () => {
      const pending = await sendConnectionRequest(collaborator.id, { recipientUserId: lead.id });
      await assert.rejects(() => blockUser(collaborator.id, { blockedUserId: collaborator.id }), /NETWORK_SELF_BLOCK/);
      await blockUser(collaborator.id, { blockedUserId: lead.id }); assert.equal((await db.connectionRequest.findUniqueOrThrow({ where: { id: pending.id } })).status, "CANCELLED");
      await blockUser(owner.id, { blockedUserId: collaborator.id });
      await db.innovationProfile.update({ where: { userId: collaborator.id }, data: { profileVisibility: "PRIVATE" } });
      const { items: blocked } = await listBlockedUsers(owner.id);
      assert.equal(blocked.find((person) => person.userId === collaborator.id)?.fullName, "Network collaborator");
      assert.equal(JSON.stringify(blocked).includes("Secret skill"), false);
      await db.innovationProfile.update({ where: { userId: collaborator.id }, data: { profileVisibility: "PLATFORM" } });
      assert.equal((await getPersonNetworkState(owner.id, collaborator.id)).state, "UNAVAILABLE");
      await assert.rejects(() => sendConnectionRequest(collaborator.id, { recipientUserId: owner.id }), /NETWORK_CONTACT_UNAVAILABLE/);
      assert.ok(await db.projectMembership.findFirst({ where: { projectId: project.id, userId: collaborator.id, leftAt: null } })); assert.ok(await db.teamMembership.findFirst({ where: { teamId: team.id, userId: collaborator.id, leftAt: null } }));
      await unblockUser(owner.id, { blockedUserId: collaborator.id }); assert.equal((await getPersonNetworkState(owner.id, collaborator.id)).state, "AVAILABLE");
      assert.equal(await db.networkConnection.count({ where: { endedAt: null, OR: [{ userAId: owner.id }, { userBId: owner.id }] } }), 0);
      assert.equal(await db.notification.count({ where: { recipientUserId: collaborator.id, kind: "CONNECTION_REQUEST" } }) >= 1, true);
    });
    await context.test("database-backed daily connection request limits include historical outcomes", async () => {
      const pair = canonicalUserPair(outsider.id, lead.id);
      await db.connectionRequest.createMany({ data: Array.from({ length: 20 }, (_, index) => ({ id: `rate-${suffix}-${index}`, ...pair, requesterUserId: outsider.id, recipientUserId: lead.id, status: "DECLINED" as const, respondedAt: new Date() })) });
      await assert.rejects(() => sendConnectionRequest(outsider.id, { recipientUserId: lead.id }), /NETWORK_REQUEST_LIMIT/);
    });

    await context.test("connection request eligibility waits for concurrent profile privacy changes", async () => {
      const gate = barrier(); let announce!: (pid: number) => void;
      const ready = new Promise<number>((resolve) => { announce = resolve; });
      const privacySave = db.$transaction(async (client) => {
        const [{ pid }] = await client.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
        await client.innovationProfile.update({ where: { userId: owner.id }, data: { directoryEnabled: false } });
        announce(pid); await gate.promise;
      }, { timeout: 10000 });
      const pid = await ready;
      const request = sendConnectionRequest(lead.id, { recipientUserId: owner.id }).then((value) => ({ value, error: null }), (error: unknown) => ({ value: null, error }));
      try { await waitForBlockedQuery(pid, 'FROM "InnovationProfile"'); }
      finally { gate.release(); await privacySave; }
      const result = await request;
      assert.ok(result.error instanceof Error); assert.match(result.error.message, /NETWORK_PROFILE_UNAVAILABLE/);
      assert.equal(await db.connectionRequest.count({ where: { requesterUserId: lead.id, recipientUserId: owner.id } }), 0);
      await db.innovationProfile.update({ where: { userId: owner.id }, data: { directoryEnabled: true } });
    });

    await context.test("project contact flows fail closed when the primary team changes while awaiting locks", async (subcontext) => {
      const oldTeam = await createTeam(owner.id, { name: "Old collaboration context" }); teamIds.push(oldTeam.id);
      const newTeam = await createTeam(owner.id, { name: "New collaboration context" }); teamIds.push(newTeam.id);
      for (const kind of ["request", "request-accept", "invite-accept"] as const) {
        await subcontext.test(kind, async () => {
          const record = await createProject(owner.id, { name: `Concurrent ${kind}`, summary: "The contact context must stay stable during authorization.", primaryTeamId: oldTeam.id }); projectIds.push(record.id);
          await db.project.update({ where: { id: record.id }, data: { visibility: "PLATFORM", directoryEnabled: true, collaborationOpen: true } });
          const request = kind === "request-accept" ? await sendProjectRequest(outsider.id, record.id, {}) : null;
          const invite = kind === "invite-accept" ? await inviteToProject(owner.id, record.id, { invitedUserId: outsider.id }) : null;
          const gate = barrier(); let announce!: (pid: number) => void;
          const ready = new Promise<number>((resolve) => { announce = resolve; });
          const teamSwap = db.$transaction(async (client) => {
            const [{ pid }] = await client.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
            for (const teamId of [oldTeam.id, newTeam.id].sort()) await client.$queryRaw`SELECT "id" FROM "Team" WHERE "id" = ${teamId} FOR UPDATE`;
            await client.project.update({ where: { id: record.id }, data: { primaryTeamId: newTeam.id } });
            announce(pid); await gate.promise;
          }, { timeout: 10000 });
          const pid = await ready;
          const operation = kind === "request" ? sendProjectRequest(outsider.id, record.id, {}) : kind === "request-accept" ? respondProjectRequest(owner.id, record.id, request!.id, { action: "accept" }) : respondProjectInvite(outsider.id, invite!.id, { action: "accept" });
          const outcome = operation.then(() => null, (error: unknown) => error);
          try { await waitForBlockedQuery(pid, 'FROM "Team"'); }
          finally { gate.release(); await teamSwap; }
          const error = await outcome; assert.ok(error instanceof Error); assert.match(error.message, /PROJECT_CONCURRENT_CHANGE/);
          assert.equal(await db.projectMembership.count({ where: { projectId: record.id, userId: outsider.id } }), 0);
          if (request) assert.equal((await db.projectCollaborationRequest.findUniqueOrThrow({ where: { id: request.id } })).status, "PENDING");
          if (invite) assert.equal((await db.projectInvite.findUniqueOrThrow({ where: { id: invite.id } })).acceptedAt, null);
          if (kind === "request") assert.equal(await db.projectCollaborationRequest.count({ where: { projectId: record.id } }), 0);
        });
      }
    });
  } finally {
    await db.notification.deleteMany({ where: { OR: [{ recipientUserId: { in: userIds } }, { actorUserId: { in: userIds } }] } });
    await db.userBlock.deleteMany({ where: { OR: [{ blockerUserId: { in: userIds } }, { blockedUserId: { in: userIds } }] } });
    await db.networkConnection.deleteMany({ where: { OR: [{ userAId: { in: userIds } }, { userBId: { in: userIds } }] } });
    await db.connectionRequest.deleteMany({ where: { requesterUserId: { in: userIds } } });
    if (projectIds.length) await db.project.deleteMany({ where: { id: { in: projectIds } } });
    if (teamIds.length) await db.team.deleteMany({ where: { id: { in: teamIds } } });
    if (userIds.length) await db.user.deleteMany({ where: { id: { in: userIds } } });
  }
});
