import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";

test("interaction read models retain safe identity, paginate all contacts and batch database reads", async (context) => {
  if (!process.env.DATABASE_URL) { assert.notEqual(process.env.CI, "true"); context.skip("A disposable PostgreSQL database is required."); return; }
  const client = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
  (globalThis as unknown as { prisma: PrismaClient }).prisma = client;
  const { listConnectionRequests, listConnections } = await import("@/lib/network/connections");
  const { listProjectRequests } = await import("@/lib/network/requests");
  const { listTargetedInvites } = await import("@/lib/network/invites");
  const { listBlockedUsers } = await import("@/lib/network/blocks");
  const { listConversations } = await import("@/lib/communication/messages");
  const suffix = randomUUID(); const viewer = `viewer-${suffix}`; const stranger = `stranger-${suffix}`;
  const targets = Array.from({ length: 105 }, (_, index) => `person-${String(index).padStart(3, "0")}-${suffix}`);
  const allUsers = [viewer, stranger, ...targets]; const projectId = `project-${suffix}`; const teamId = `team-${suffix}`;
  let queries = 0;
  client.$on("query", () => { queries++; });
  const measured = async <T,>(read: () => Promise<T>) => { queries = 0; const result = await read(); return { result, queries }; };
  const identity = (person: { fullName: string; handle: string | null; headline: string | null; skills?: string[] }) => {
    assert.match(person.fullName, /^Known person /);
    assert.equal(person.handle, null); assert.equal(person.headline, null);
    if (person.skills) assert.deepEqual(person.skills, []);
    assert.equal(JSON.stringify(person).includes("private-marker"), false);
  };
  try {
    await client.user.createMany({ data: allUsers.map((id) => ({ id, email: `${id}@example.test`, passwordHash: "private-marker" })) });
    await client.userProfile.createMany({ data: allUsers.map((userId) => ({ userId, fullName: `Known person ${userId}`, phone: "private-marker" })) });
    await client.innovationProfile.createMany({ data: allUsers.map((userId) => ({ userId, bio: "private-marker", headline: "private-marker", profileVisibility: "PRIVATE", directoryEnabled: false })) });
    await client.project.create({ data: { id: projectId, name: "Private managed project", summary: "Explicit interaction fixture", createdByUserId: viewer, memberships: { create: { userId: viewer, role: "OWNER" } } } });
    await client.team.create({ data: { id: teamId, name: "Private managed team", createdByUserId: viewer, memberships: { create: { userId: viewer, role: "OWNER", status: "ACTIVE" } } } });
    const pair = (target: string) => ({ userAId: [viewer, target].sort()[0], userBId: [viewer, target].sort()[1] });
    await client.connectionRequest.createMany({ data: targets.map((target) => ({ id: `pending-${target}`, ...pair(target), requesterUserId: target, recipientUserId: viewer })) });
    await client.projectCollaborationRequest.createMany({ data: targets.map((requesterUserId) => ({ projectId, requesterUserId })) });
    const expiresAt = new Date(Date.now() + 86400000);
    await client.projectInvite.createMany({ data: targets.map((invitedByUserId) => ({ projectId, invitedUserId: viewer, invitedByUserId, expiresAt, revokedAt: new Date() })) });
    // Distinct targets keep the real pending-invitation uniqueness constraint intact.
    await client.projectInvite.createMany({ data: targets.map((invitedUserId) => ({ projectId, invitedUserId, invitedByUserId: viewer, expiresAt })) });
    await client.teamInvite.createMany({ data: targets.map((invitedUserId) => ({ teamId, invitedUserId, invitedByUserId: viewer, expiresAt, tokenHash: `private-marker-${invitedUserId}` })) });

    await context.test("a private initiator remains identifiable only inside the authorized interaction", async () => {
      const requests = await listConnectionRequests(viewer);
      identity(requests.items[0].person);
      identity((await listProjectRequests(viewer, projectId)).items[0].person);
      const invites = await listTargetedInvites(targets[0]);
      identity(invites.teams[0].person); identity(invites.projects[0].person);
      assert.deepEqual((await listConnectionRequests(stranger)).items, []);
      assert.deepEqual((await listProjectRequests(stranger)).items, []);
      assert.deepEqual((await listTargetedInvites(stranger)).teams, []);
      await assert.rejects(() => listProjectRequests(stranger, projectId), /PROJECT_NOT_FOUND/);
    });
    await context.test("every pending request and invite is reachable after the hundredth record", async () => {
      const connections = new Set<string>(); const projects = new Set<string>(); const teamInvites = new Set<string>(); const projectInvites = new Set<string>();
      for (let page = 1; page <= 6; page++) {
        const requestPage = await listConnectionRequests(viewer, page);
        const projectPage = await listProjectRequests(viewer, projectId, page);
        const invites = await listTargetedInvites(viewer, { teamPage: page, projectPage: page });
        requestPage.items.forEach((row) => connections.add(row.id)); projectPage.items.forEach((row) => projects.add(row.id));
        invites.teams.forEach((row) => teamInvites.add(row.id)); invites.projects.forEach((row) => projectInvites.add(row.id));
        assert.equal(requestPage.hasNext, page < 6); assert.equal(projectPage.hasNext, page < 6);
        assert.equal(invites.teamsHasNext, page < 6); assert.equal(invites.projectsHasNext, page < 6);
      }
      assert.deepEqual([connections.size, projects.size, teamInvites.size, projectInvites.size], [105, 105, 105, 105]);
      const first = await measured(() => listConnectionRequests(viewer)); const last = await measured(() => listConnectionRequests(viewer, 6));
      assert.equal(first.queries, last.queries); assert.ok(first.queries <= 8, `request page issued ${first.queries} queries`);
      const managed = await measured(() => listProjectRequests(viewer, projectId)); assert.ok(managed.queries <= 12, `project request page issued ${managed.queries} queries`);
      const invitePage = await measured(() => listTargetedInvites(viewer)); assert.ok(invitePage.queries <= 12, `invites issued ${invitePage.queries} queries`);
    });
    await context.test("connections and unread conversation counts do not issue one query per person", async (connectionContext) => {
      await client.connectionRequest.createMany({ data: targets.slice(0, 20).map((target) => ({ id: `accepted-${target}`, ...pair(target), requesterUserId: target, recipientUserId: viewer, status: "ACCEPTED", respondedAt: new Date() })) });
      await client.networkConnection.createMany({ data: targets.slice(0, 20).map((target) => ({ ...pair(target), sourceRequestId: `accepted-${target}` })) });
      for (const [index, target] of targets.slice(0, 20).entries()) {
        const id = `conversation-${target}`; const readAt = new Date("2026-01-01T12:00:00Z");
        await client.conversation.create({ data: { id, ...pair(target), participants: { create: [{ userId: viewer, lastReadAt: index % 2 ? readAt : null }, { userId: target }] } } });
        await client.directMessage.createMany({ data: [{ conversationId: id, senderUserId: target, body: "Before", createdAt: new Date("2026-01-01T11:00:00Z") }, { conversationId: id, senderUserId: target, body: "After", createdAt: new Date("2026-01-01T13:00:00Z") }, { conversationId: id, senderUserId: viewer, body: "Own message", createdAt: new Date("2026-01-01T14:00:00Z") }] });
      }
      const connections = await measured(() => listConnections(viewer)); assert.equal(connections.result.items.length, 20);
      const conversations = await measured(() => listConversations(viewer));
      await connectionContext.test("bounded connection query count", () => assert.ok(connections.queries <= 8, `connections issued ${connections.queries} queries`));
      await connectionContext.test("bounded unread query count", () => assert.ok(conversations.queries <= 9, `conversations issued ${conversations.queries} queries`));
      identity(connections.result.items[0].person);
      for (const [index, target] of targets.slice(0, 20).entries()) {
        const conversation = conversations.result.conversations.find((row) => row.id === `conversation-${target}`)!;
        identity(conversation.person); assert.equal(conversation.unreadCount, index % 2 ? 1 : 2);
      }
    });
    await context.test("blocked contacts retain basic identity and bounded accessible pagination", async () => {
      await client.userBlock.createMany({ data: targets.map((blockedUserId) => ({ blockerUserId: viewer, blockedUserId })) });
      const first = await measured(() => listBlockedUsers(viewer)); const last = await listBlockedUsers(viewer, 6);
      assert.equal(first.result.items.length, 20); assert.equal(first.result.hasNext, true); assert.equal(last.items.length, 5); assert.equal(last.hasNext, false);
      assert.match(first.result.items[0].fullName, /^Known person /); assert.ok(first.queries <= 4);
      assert.deepEqual((await listBlockedUsers(stranger)).items, []);
    });
  } finally {
    await client.conversation.deleteMany({ where: { OR: [{ userAId: viewer }, { userBId: viewer }] } });
    await client.networkConnection.deleteMany({ where: { OR: [{ userAId: viewer }, { userBId: viewer }] } });
    await client.connectionRequest.deleteMany({ where: { OR: [{ requesterUserId: viewer }, { recipientUserId: viewer }] } });
    await client.userBlock.deleteMany({ where: { blockerUserId: viewer } });
    await client.project.deleteMany({ where: { id: projectId } }); await client.team.deleteMany({ where: { id: teamId } });
    await client.user.deleteMany({ where: { id: { in: allUsers } } }); await client.$disconnect();
  }
});
