import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { db } from "@/lib/db";
import { canonicalUserPair } from "@/lib/network/locking";
import { blockUser, unblockUser } from "@/lib/network/blocks";
import { createSafetyReport, listSafetyReports, reviewSafetyReport } from "@/lib/network/safety";
import { createProject, createTeam, updateProject, updateTeamMember } from "@/lib/participants/service";
import { getConversation, listConversations, markConversationRead, sendDirectMessage, startConversation } from "@/lib/communication/messages";
import { createProjectDiscussion, getProjectDiscussion, listProjectDiscussions, replyProjectDiscussion, updateDiscussionStatus, updateDiscussionSubscription } from "@/lib/communication/discussions";

const databaseAvailable = Boolean(process.env.DATABASE_URL);
if (process.env.REQUIRE_DOMAIN_DATABASE === "true" && !databaseAvailable) throw new Error("DATABASE_URL is required for domain integration tests in CI");

test("direct communication, project discussions and platform safety preserve access, history and abuse limits", async (context) => {
  if (!databaseAvailable) { context.skip("DATABASE_URL is not configured for the integration harness"); return; }
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12); const userIds: string[] = []; const projectIds: string[] = []; const teamIds: string[] = [];
  try {
    const users = [];
    for (const label of ["owner", "member", "outsider", "moderator"]) {
      const user = await db.user.create({ data: { email: `communication-${label}-${suffix}@example.test`, passwordHash: "test-only", platformRole: label === "moderator" ? "SUPER_ADMIN" : "USER", profile: { create: { fullName: `Communication ${label}`, phone: `secret-phone-${suffix}` } } } });
      userIds.push(user.id); users.push(user);
    }
    const [owner, member, outsider, moderator] = users;
    const pair = canonicalUserPair(owner.id, member.id);
    const activate = async () => {
      const request = await db.connectionRequest.create({ data: { ...pair, requesterUserId: owner.id, recipientUserId: member.id, status: "ACCEPTED", respondedAt: new Date() } });
      return db.networkConnection.create({ data: { ...pair, sourceRequestId: request.id } });
    };
    await assert.rejects(() => startConversation(owner.id, { otherUserId: member.id }), /ACTIVE_CONNECTION_REQUIRED/);
    await assert.rejects(() => startConversation(owner.id, { otherUserId: owner.id }), /CONVERSATION_SELF_FORBIDDEN/);
    let connection = await activate();
    const ids = await Promise.all([startConversation(owner.id, { otherUserId: member.id }), startConversation(member.id, { otherUserId: owner.id })]);
    assert.equal(ids[0], ids[1]); const conversationId = ids[0];

    await context.test("conversations enforce two distinct participants and reject outsiders", async () => {
      assert.equal(await db.conversationParticipant.count({ where: { conversationId } }), 2);
      await assert.rejects(() => getConversation(outsider.id, conversationId), /CONVERSATION_NOT_FOUND/);
      await assert.rejects(() => sendDirectMessage(outsider.id, conversationId, { body: "Forged sender" }), /CONVERSATION_NOT_FOUND/);
      await db.conversationParticipant.create({ data: { conversationId, userId: outsider.id } });
      await assert.rejects(() => getConversation(owner.id, conversationId), /CONVERSATION_PARTICIPANTS_INVALID/);
      await db.conversationParticipant.delete({ where: { conversationId_userId: { conversationId, userId: outsider.id } } });
    });

    const now = new Date();
    const first = await sendDirectMessage(member.id, conversationId, { body: "Podemos contribuir com a pesquisa." }, now);
    await context.test("messages derive unread state only from displayed messages and create private notifications", async () => {
      const own = await sendDirectMessage(owner.id, conversationId, { body: "Tenho interesse." }, now);
      assert.equal((await listConversations(owner.id)).conversations[0].unreadCount, 1);
      await markConversationRead(owner.id, conversationId, first.id);
      assert.equal((await listConversations(owner.id)).conversations[0].unreadCount, 0);
      const later = await sendDirectMessage(member.id, conversationId, { body: "Vamos conversar." }, now);
      assert.ok(new Date(later.createdAt) > new Date(first.createdAt));
      await markConversationRead(owner.id, conversationId, first.id);
      assert.equal((await listConversations(owner.id)).conversations[0].unreadCount, 1);
      await markConversationRead(owner.id, conversationId, later.id);
      assert.equal((await listConversations(owner.id)).conversations[0].unreadCount, 0);
      await assert.rejects(() => sendDirectMessage(member.id, conversationId, { body: "x".repeat(4001) }));
      assert.equal(await db.notification.count({ where: { recipientUserId: owner.id, kind: "DIRECT_MESSAGE" } }), 2);
      const serialized = JSON.stringify(await getConversation(owner.id, conversationId));
      assert.equal(serialized.includes("@example.test"), false); assert.equal(serialized.includes("secret-phone"), false);
      assert.equal("lastReadAt" in (await getConversation(owner.id, conversationId)), false);
      assert.ok(own.id);
    });

    await context.test("private profile sections remain hidden while basic identity identifies the conversation", async () => {
      const hiddenName = `Private name ${suffix}`; const hiddenHeadline = `Private headline ${suffix}`;
      await db.userProfile.update({ where: { userId: member.id }, data: { fullName: hiddenName } });
      await db.innovationProfile.create({ data: { userId: member.id, handle: `communication-${suffix}`, headline: hiddenHeadline, profileVisibility: "PRIVATE" } });
      for (const scope of ["PRIVATE", "TEAM"] as const) {
        await db.innovationProfile.update({ where: { userId: member.id }, data: { profileVisibility: scope } });
        const history = await getConversation(owner.id, conversationId);
        const inbox = await listConversations(owner.id);
        assert.equal(history.person.fullName, hiddenName); assert.equal(history.person.handle, null); assert.equal(history.person.headline, null);
        assert.equal(history.messages[0].body, "Podemos contribuir com a pesquisa.");
        for (const serialized of [JSON.stringify(history), JSON.stringify(inbox)]) { assert.equal(serialized.includes(hiddenName), true); assert.equal(serialized.includes(hiddenHeadline), false); }
      }
      await db.innovationProfile.update({ where: { userId: member.id }, data: { profileVisibility: "PLATFORM" } });
      assert.equal((await getConversation(owner.id, conversationId)).person.fullName, hiddenName);
      await db.innovationProfile.update({ where: { userId: member.id }, data: { profileVisibility: "PRIVATE" } });
    });

    await context.test("message cursor pages are deterministic and restricted to the conversation", async () => {
      await db.directMessage.createMany({ data: Array.from({ length: 55 }, (_, index) => ({ conversationId, senderUserId: owner.id, body: `Historic message ${index}`, createdAt: new Date(now.getTime() - 100_000 + index) })) });
      const recent = await getConversation(owner.id, conversationId); assert.equal(recent.messages.length, 50); assert.ok(recent.olderCursor);
      const older = await getConversation(owner.id, conversationId, recent.olderCursor!);
      assert.equal(older.messages.length, 8);
      assert.equal(new Set([...older.messages, ...recent.messages].map((entry) => entry.id)).size, 58);
      await assert.rejects(() => getConversation(owner.id, conversationId, "unknown-message"), /MESSAGE_NOT_FOUND/);
    });

    await context.test("disconnected and blocked pairs retain history while new contact fails closed", async () => {
      await db.networkConnection.update({ where: { id: connection.id }, data: { endedAt: new Date(), endedByUserId: owner.id } });
      assert.equal((await getConversation(owner.id, conversationId)).canSend, false);
      await assert.rejects(() => sendDirectMessage(owner.id, conversationId, { body: "Unavailable" }), /ACTIVE_CONNECTION_REQUIRED/);
      connection = await activate(); assert.equal(await startConversation(owner.id, { otherUserId: member.id }), conversationId);
      await blockUser(owner.id, { blockedUserId: member.id });
      await assert.rejects(() => sendDirectMessage(member.id, conversationId, { body: "Blocked" }), /NETWORK_CONTACT_UNAVAILABLE/);
      assert.equal((await getConversation(owner.id, conversationId)).messages.length, 50);
      await unblockUser(owner.id, { blockedUserId: member.id }); assert.equal((await getConversation(owner.id, conversationId)).canSend, false);
      connection = await activate();
    });

    await context.test("message cap is serialized across concurrent sends and notifications reflect only successful writes", async () => {
      const future = new Date(now.getTime() + 120_000);
      await db.directMessage.createMany({ data: Array.from({ length: 29 }, (_, index) => ({ conversationId, senderUserId: member.id, body: `Rate fixture ${index}`, createdAt: future })) });
      const before = await db.notification.count({ where: { recipientUserId: owner.id, kind: "DIRECT_MESSAGE" } });
      const outcomes = await Promise.allSettled([sendDirectMessage(member.id, conversationId, { body: "Limit A" }, future), sendDirectMessage(member.id, conversationId, { body: "Limit B" }, future)]);
      assert.equal(outcomes.filter((entry) => entry.status === "fulfilled").length, 1); assert.equal(outcomes.filter((entry) => entry.status === "rejected").length, 1);
      assert.equal(await db.notification.count({ where: { recipientUserId: owner.id, kind: "DIRECT_MESSAGE" } }), before + 1);
    });

    await context.test("reports require legitimate evidence and platform moderation excludes ordinary administrators", async () => {
      await assert.rejects(() => createSafetyReport(outsider.id, { reportedUserId: member.id, conversationId, messageId: first.id, reason: "SPAM" }), /SAFETY_CONTEXT_UNAVAILABLE/);
      await assert.rejects(() => createSafetyReport(owner.id, { reportedUserId: member.id, conversationId, messageId: "unknown-message", reason: "SPAM" }), /SAFETY_CONTEXT_UNAVAILABLE/);
      await assert.rejects(() => createSafetyReport(owner.id, { reportedUserId: outsider.id, reason: "SPAM" }), /SAFETY_CONTEXT_UNAVAILABLE/);
      const report = await createSafetyReport(owner.id, { reportedUserId: member.id, conversationId, messageId: first.id, reason: "SPAM", details: "Review the referenced message." });
      const organization = await db.organization.create({ data: { name: `Safety test ${suffix}`, slug: `safety-${suffix}`, memberships: { create: { userId: owner.id, role: "OWNER" } } } });
      try { await assert.rejects(() => listSafetyReports(owner.id), /PLATFORM_ROLE_FORBIDDEN/); await assert.rejects(() => reviewSafetyReport(owner.id, report.id, { status: "ACTIONED" }), /PLATFORM_ROLE_FORBIDDEN/); }
      finally { await db.organization.delete({ where: { id: organization.id } }); }
      const reports = await listSafetyReports(moderator.id); const current = reports.reports.find((record) => record.id === report.id)!;
      assert.equal(current.message?.body, "Podemos contribuir com a pesquisa."); assert.equal(JSON.stringify(current).includes("@example.test"), false);
      await reviewSafetyReport(moderator.id, report.id, { status: "REVIEWED" });
      assert.equal((await db.safetyReport.findUniqueOrThrow({ where: { id: report.id } })).reviewedByUserId, moderator.id);
    });

    const team = await createTeam(owner.id, { name: `Communication team ${suffix}` }); teamIds.push(team.id);
    await db.teamMembership.create({ data: { teamId: team.id, userId: member.id, role: "MEMBER", status: "ACTIVE" } });
    const project = await createProject(owner.id, { name: `Communication project ${suffix}`, summary: "A scoped project discussion fixture.", primaryTeamId: team.id }); projectIds.push(project.id);
    const discussion = await createProjectDiscussion(member.id, project.id, { title: "Próxima etapa", body: "Como organizamos a pesquisa?" });
    await context.test("project discussion membership, subscriptions and close state control every read and write", async () => {
      assert.equal((await listProjectDiscussions(owner.id, project.id)).total, 1);
      await assert.rejects(() => getProjectDiscussion(outsider.id, project.id, discussion.id), /PROJECT_NOT_FOUND/);
      await assert.rejects(() => replyProjectDiscussion(outsider.id, project.id, discussion.id, { body: "Outsider" }), /PROJECT_NOT_FOUND/);
      await replyProjectDiscussion(owner.id, project.id, discussion.id, { body: "Podemos começar pelo protocolo." });
      assert.equal(await db.notification.count({ where: { recipientUserId: member.id, kind: "PROJECT_DISCUSSION", entityId: discussion.id } }), 1);
      assert.equal((await getProjectDiscussion(owner.id, project.id, discussion.id)).subscribed, true);
      await updateDiscussionSubscription(member.id, project.id, discussion.id, { subscribed: false });
      await replyProjectDiscussion(owner.id, project.id, discussion.id, { body: "Outro alinhamento." });
      assert.equal(await db.notification.count({ where: { recipientUserId: member.id, kind: "PROJECT_DISCUSSION", entityId: discussion.id } }), 1);
      await assert.rejects(() => updateDiscussionStatus(member.id, project.id, discussion.id, { status: "CLOSED" }), /PARTICIPANT_ROLE_FORBIDDEN/);
      await updateDiscussionStatus(owner.id, project.id, discussion.id, { status: "CLOSED" });
      assert.equal((await getProjectDiscussion(member.id, project.id, discussion.id)).canReply, false);
      await assert.rejects(() => replyProjectDiscussion(member.id, project.id, discussion.id, { body: "Closed" }), /DISCUSSION_CLOSED/);
      await updateDiscussionStatus(owner.id, project.id, discussion.id, { status: "OPEN" });
      await updateDiscussionSubscription(member.id, project.id, discussion.id, { subscribed: true });
      const membership = await db.teamMembership.findFirstOrThrow({ where: { teamId: team.id, userId: member.id, leftAt: null } });
      await updateTeamMember(owner.id, team.id, membership.id, { action: "remove" });
      await assert.rejects(() => getProjectDiscussion(member.id, project.id, discussion.id), /PROJECT_NOT_FOUND/);
      await assert.rejects(() => replyProjectDiscussion(member.id, project.id, discussion.id, { body: "Former member" }), /PROJECT_NOT_FOUND/);
      await replyProjectDiscussion(owner.id, project.id, discussion.id, { body: "History remains." });
      assert.equal(await db.notification.count({ where: { recipientUserId: member.id, kind: "PROJECT_DISCUSSION", entityId: discussion.id } }), 1);
      assert.ok((await getProjectDiscussion(owner.id, project.id, discussion.id)).messages.some((message) => message.authorUserId === member.id));
      const serialized = JSON.stringify(await getProjectDiscussion(owner.id, project.id, discussion.id)); assert.equal(serialized.includes("@example.test"), false); assert.equal(serialized.includes("secret-phone"), false);
      await updateProject(owner.id, project.id, { status: "ARCHIVED" });
      await assert.rejects(() => replyProjectDiscussion(owner.id, project.id, discussion.id, { body: "Archived" }), /PROJECT_ARCHIVED/);
    });

    await context.test("concurrent discussion replies cannot bypass archive or the serialized per-user cap", async () => {
      const independent = await createProject(owner.id, { name: `Concurrent discussion ${suffix}`, summary: "An independent project for transaction races." }); projectIds.push(independent.id);
      const thread = await createProjectDiscussion(owner.id, independent.id, { title: "Acesso simultâneo", body: "Preserve the project boundary." });
      const future = new Date(Date.now() + 120_000);
      await db.projectDiscussionMessage.createMany({ data: Array.from({ length: 29 }, (_, index) => ({ discussionId: thread.id, authorUserId: owner.id, body: `Discussion rate fixture ${index}`, createdAt: future })) });
      const rate = await Promise.allSettled([replyProjectDiscussion(owner.id, independent.id, thread.id, { body: "Reply A" }, future), replyProjectDiscussion(owner.id, independent.id, thread.id, { body: "Reply B" }, future)]);
      assert.equal(rate.filter((entry) => entry.status === "fulfilled").length, 1); assert.equal(rate.filter((entry) => entry.status === "rejected").length, 1);
      const afterWindow = new Date(future.getTime() + 120_000);
      const archive = await Promise.allSettled([updateProject(owner.id, independent.id, { status: "ARCHIVED" }), replyProjectDiscussion(owner.id, independent.id, thread.id, { body: "Concurrent archive" }, afterWindow)]);
      assert.equal(archive[0].status, "fulfilled");
      if (archive[1].status === "rejected") assert.match(String(archive[1].reason), /PROJECT_ARCHIVED/);
      assert.equal((await getProjectDiscussion(owner.id, independent.id, thread.id)).canReply, false);
      await assert.rejects(() => replyProjectDiscussion(owner.id, independent.id, thread.id, { body: "After archive" }, afterWindow), /PROJECT_ARCHIVED/);
    });
  } finally {
    await db.safetyReport.deleteMany({ where: { reporterUserId: { in: userIds } } });
    await db.notification.deleteMany({ where: { recipientUserId: { in: userIds } } });
    await db.conversation.deleteMany({ where: { userAId: { in: userIds } } });
    await db.project.deleteMany({ where: { id: { in: projectIds } } });
    await db.team.deleteMany({ where: { id: { in: teamIds } } });
    await db.userBlock.deleteMany({ where: { blockerUserId: { in: userIds } } });
    await db.networkConnection.deleteMany({ where: { userAId: { in: userIds } } });
    await db.connectionRequest.deleteMany({ where: { requesterUserId: { in: userIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
  }
});
