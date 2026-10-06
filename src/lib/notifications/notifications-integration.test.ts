import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { db } from "@/lib/db";
import { createProject } from "@/lib/participants/service";
import { createProjectTask, updateProjectTask } from "@/lib/project-collaboration/service";
import { createNotification, createNotifications, listNotifications, unreadNotificationCount, updateNotification } from "@/lib/notifications/service";

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
    await assert.rejects(() => db.$transaction((client) => createNotifications(client, Array.from({ length: 101 }, (_, i) => ({ ...base, kind: "APPLICATION_RESULT", dedupeKey: `fanout:${i}` })))), /NOTIFICATION_FANOUT_EXCEEDED/);
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
