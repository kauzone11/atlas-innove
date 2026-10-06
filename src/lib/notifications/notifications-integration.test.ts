import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { db } from "@/lib/db";
import { createProject } from "@/lib/participants/service";
import { createProjectTask, updateProjectTask } from "@/lib/project-collaboration/service";
import { createNotification, createNotifications, listNotifications, unreadNotificationCount, updateNotification } from "@/lib/notifications/service";
import { publishCallResults } from "@/lib/selection/service";
import { projectManagerIds } from "@/lib/notifications/events";

test("real notifications isolate recipients, preserve deduplication state and follow task assignment transactions", async (context) => {
  if (!process.env.DATABASE_URL) { assert.notEqual(process.env.REQUIRE_DOMAIN_DATABASE, "true"); context.skip("Disposable PostgreSQL required"); return; }
  const suffix = randomUUID();
  const users = await Promise.all(["owner", "member", "outsider"].map((name) => db.user.create({ data: { email: `notification-${name}-${suffix}@example.test`, passwordHash: "test-only" } })));
  const [owner, member, outsider] = users; const ids = users.map((user) => user.id);
  let projectId: string | undefined;
  try {
    const project = await createProject(owner.id, { name: "Notification project", summary: "A real collaboration context for notification testing." }); projectId = project.id;
    await db.projectMembership.create({ data: { projectId, userId: member.id } });
    const task = await createProjectTask(owner.id, projectId, { title: "Assigned task", assigneeUserId: member.id });
    const list = await listNotifications(member.id);
    assert.equal(list.notifications.length, 1); assert.equal(list.notifications[0].kind, "PROJECT_TASK_ASSIGNED");
    assert.equal(await unreadNotificationCount(member.id), 1); assert.equal(await unreadNotificationCount(outsider.id), 0);
    await assert.rejects(() => updateNotification(outsider.id, list.notifications[0].id, { action: "read" }), /NOTIFICATION_NOT_FOUND/);
    await updateNotification(member.id, list.notifications[0].id, { action: "read" });
    assert.equal(await unreadNotificationCount(member.id), 0);
    await db.$transaction((client) => createNotification(client, { recipientUserId: member.id, actorUserId: owner.id, kind: "PROJECT_TASK_ASSIGNED", title: "Duplicate", href: `/app/personal/projects/${projectId}`, dedupeKey: `task-assigned:${task.id}:0` }));
    assert.equal((await listNotifications(member.id)).notifications.length, 1); assert.equal(await unreadNotificationCount(member.id), 0);
    await updateProjectTask(owner.id, projectId, task.id, { expectedRevision: task.revision, title: "Renamed task" });
    assert.equal((await listNotifications(member.id)).notifications.length, 1);
    await updateNotification(member.id, list.notifications[0].id, { action: "archive" });
    assert.equal((await listNotifications(member.id)).notifications.length, 0); assert.equal(await db.notification.count({ where: { recipientUserId: member.id } }), 1);
    await db.userBlock.create({ data: { blockerUserId: member.id, blockedUserId: owner.id } });
    const base = { recipientUserId: member.id, actorUserId: owner.id, title: "Contact", href: "/app/personal/network/requests" };
    await db.$transaction((client) => createNotification(client, { ...base, kind: "CONNECTION_REQUEST", dedupeKey: "blocked-contact" }));
    assert.equal(await db.notification.count({ where: { recipientUserId: member.id, dedupeKey: "blocked-contact" } }), 0);
    await db.$transaction((client) => createNotification(client, { ...base, kind: "APPLICATION_RESULT", dedupeKey: "institution-result" }));
    assert.equal(await unreadNotificationCount(member.id), 1);
    await db.$transaction((client) => createNotifications(client, Array.from({ length: 101 }, (_, i) => ({ ...base, kind: "APPLICATION_RESULT", dedupeKey: `fanout:${i}` }))));
    assert.equal(await db.notification.count({ where: { recipientUserId: member.id, dedupeKey: { startsWith: "fanout:" } } }), 101);
    await updateNotification(member.id, null, { action: "readAll" }); assert.equal(await unreadNotificationCount(member.id), 0);
    assert.equal(JSON.stringify(await listNotifications(member.id)).includes("@example.test"), false);
  } finally {
    await db.notification.deleteMany({ where: { OR: [{ recipientUserId: { in: ids } }, { actorUserId: { in: ids } }] } });
    await db.userBlock.deleteMany({ where: { blockerUserId: { in: ids } } });
    if (projectId) await db.project.delete({ where: { id: projectId } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
});

test("institutional result notifications reach all submission-time participants without truncation", async (context) => {
  if (!process.env.DATABASE_URL) { assert.notEqual(process.env.REQUIRE_DOMAIN_DATABASE, "true"); context.skip("Disposable PostgreSQL required"); return; }
  const suffix = randomUUID(); const actor = `actor-${suffix}`; const former = `former-${suffix}`; const formerTeamMember = `team-member-${suffix}`; const late = `late-${suffix}`; const boundary = `boundary-${suffix}`;
  const submitters = Array.from({ length: 105 }, (_, index) => `submitter-${index}-${suffix}`);
  const userIds = [actor, former, formerTeamMember, late, boundary, ...submitters]; const projectIds = submitters.map((id) => `project-${id}`);
  const org = `org-${suffix}`; const program = `program-${suffix}`; const call = `call-${suffix}`; const secondCall = `second-call-${suffix}`; const team = `team-${suffix}`;
  const submittedAt = new Date("2026-02-01T12:00:00Z"); const joinedAt = new Date("2026-01-01T12:00:00Z"); const leftAt = new Date("2026-03-01T12:00:00Z");
  try {
    await db.user.createMany({ data: userIds.map((id) => ({ id, email: `${id}@example.test`, passwordHash: "test-only" })) });
    await db.organization.create({ data: { id: org, name: "Institutional notification fixture", slug: org, memberships: { create: { userId: actor, role: "MANAGER" } } } });
    await db.fundingProgram.create({ data: { id: program, organizationId: org, createdByUserId: actor, name: "Program", slug: "program" } });
    await db.fundingCall.createMany({ data: [call, secondCall].map((id) => ({ id, organizationId: org, fundingProgramId: program, title: id, callNumber: id, status: "IN_REVIEW" })) });
    await db.project.createMany({ data: projectIds.map((id) => ({ id, name: id, summary: "Frozen application fixture", createdByUserId: actor })) });
    await db.team.create({ data: { id: team, name: "Submission-time team", createdByUserId: actor, archivedAt: leftAt, memberships: { create: { userId: formerTeamMember, role: "MEMBER", status: "DISABLED", joinedAt, leftAt } } } });
    await db.projectMembership.createMany({ data: [...submitters.map((userId) => ({ projectId: projectIds[0], userId, role: "LEAD" as const, joinedAt })), { projectId: projectIds[0], userId: former, role: "MEMBER", joinedAt, leftAt }, { projectId: projectIds[0], userId: late, role: "MEMBER", joinedAt: leftAt }, { projectId: projectIds[0], userId: boundary, role: "MEMBER", joinedAt, leftAt: submittedAt }] });
    const firstApplication = await db.application.create({ data: { organizationId: org, fundingCallId: call, projectId: projectIds[0], teamId: team, submittedByUserId: submitters[0], projectNameSnapshot: "Historical project", projectSummarySnapshot: "Historical scope", status: "DECIDED", decision: "SELECTED", submittedAt, decidedAt: leftAt, decidedByUserId: actor } });
    await db.application.createMany({ data: submitters.map((submittedByUserId, index) => ({ organizationId: org, fundingCallId: secondCall, projectId: projectIds[index], submittedByUserId, projectNameSnapshot: "Submitted project", projectSummarySnapshot: "Submitted scope", status: "DECIDED", decision: "NOT_SELECTED", submittedAt, decidedAt: leftAt, decidedByUserId: actor })) });
    await context.test("all current managers are retained beyond one chunk", async () => {
      assert.deepEqual(new Set(await projectManagerIds(db, projectIds[0])), new Set(submitters));
    });
    await context.test("historical direct and frozen-team members receive the result while later members do not", async () => {
      await publishCallResults(org, program, call, actor);
      const events = await db.notification.findMany({ where: { entityId: firstApplication.id, kind: "APPLICATION_RESULT" }, select: { recipientUserId: true, href: true } });
      assert.deepEqual(new Set(events.map((event) => event.recipientUserId)), new Set([...submitters, former, formerTeamMember]));
      assert.ok(events.every((event) => event.href === `/app/personal/applications/${firstApplication.id}`));
      await publishCallResults(org, program, call, actor);
      assert.equal(await db.notification.count({ where: { entityId: firstApplication.id, kind: "APPLICATION_RESULT" } }), 107);
    });
    await context.test("more than a hundred distinct submitters receive the second call result atomically", async () => {
      await publishCallResults(org, program, secondCall, actor);
      const applications = await db.application.findMany({ where: { organizationId: org, fundingCallId: secondCall }, select: { id: true, submittedByUserId: true } });
      const events = await db.notification.findMany({ where: { entityId: { in: applications.map((application) => application.id) }, kind: "APPLICATION_RESULT" }, select: { recipientUserId: true, entityId: true } });
      for (const application of applications) assert.ok(events.some((event) => event.recipientUserId === application.submittedByUserId && event.entityId === application.id), application.submittedByUserId);
      assert.equal(events.some((event) => event.recipientUserId === late || event.recipientUserId === boundary), false);
    });
  } finally {
    await db.notification.deleteMany({ where: { recipientUserId: { in: userIds } } });
    await db.organization.deleteMany({ where: { id: org } });
    await db.project.deleteMany({ where: { id: { in: projectIds } } });
    await db.team.deleteMany({ where: { id: team } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  }
});
