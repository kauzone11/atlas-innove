import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { db } from "@/lib/db";
import { createProject, createTeam, updateProject, updateProjectPublication, updateTeamMember } from "@/lib/participants/service";
import { getPublicProject } from "@/lib/participants/public-project";
import { createProjectResource, createProjectTask, getProjectCollaboration, removeProjectResource, updateProjectResource, updateProjectTask } from "@/lib/project-collaboration/service";
import { awardSummarySelect } from "@/lib/awards/read-model";
import { getProjectActivity, getTeamProjectActivity } from "@/lib/project-collaboration/activity";

test("project collaboration enforces current access, role boundaries, revisions and private resources", async (context) => {
  if (!process.env.DATABASE_URL) {
    assert.notEqual(process.env.CI, "true", "CI requires PostgreSQL for project collaboration tests");
    assert.notEqual(process.env.REQUIRE_DOMAIN_DATABASE, "true", "Domain checks require PostgreSQL");
    context.skip("DATABASE_URL is not configured"); return;
  }
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12); const userIds: string[] = []; let projectId: string | undefined; let otherProjectId: string | undefined; let teamId: string | undefined;
  try {
    const users = [];
    for (const label of ["owner", "lead", "member", "outsider"]) {
      const user = await db.user.create({ data: { email: `collaboration-${label}-${suffix}@example.test`, passwordHash: "test-only", profile: { create: { fullName: `Collaborator ${label}` } } } });
      userIds.push(user.id); users.push(user);
    }
    const [owner, lead, member, outsider] = users;
    const team = await createTeam(owner.id, { name: `Collaboration team ${suffix}` }); teamId = team.id;
    for (const person of [lead, member]) await db.teamMembership.create({ data: { teamId, userId: person.id, role: person.id === lead.id ? "LEAD" : "MEMBER", status: "ACTIVE" } });
    const project = await createProject(owner.id, { name: `Collaboration project ${suffix}`, summary: "A stable research initiative for collaboration tests.", primaryTeamId: teamId }); projectId = project.id;
    const other = await createProject(outsider.id, { name: `Other project ${suffix}`, summary: "An unrelated project outside the collaborator boundary." }); otherProjectId = other.id;
    const task = await createProjectTask(lead.id, projectId, { title: "Prepare prototype", priority: "HIGH", assigneeUserId: member.id, dueAt: "2020-01-01" });
    assert.equal(task.status, "TODO"); assert.equal(task.overdue, true); assert.equal(task.assigneeHasCurrentAccess, true);
    const resource = await createProjectResource(owner.id, projectId, { label: "Private protocol", type: "RESEARCH", url: "https://example.test/private-protocol" });

    await context.test("outsiders and members cannot manage fields or resources", async () => {
      await assert.rejects(() => getProjectCollaboration(outsider.id, projectId!), /PROJECT_NOT_FOUND/);
      await assert.rejects(() => createProjectTask(member.id, projectId!, { title: "Unauthorized task" }), /PARTICIPANT_ROLE_FORBIDDEN/);
      await assert.rejects(() => updateProjectTask(member.id, projectId!, task.id, { title: "Unauthorized edit", expectedRevision: task.revision }), /PARTICIPANT_ROLE_FORBIDDEN/);
      await assert.rejects(() => createProjectTask(owner.id, projectId!, { title: "Invalid assignment", assigneeUserId: outsider.id }), /PROJECT_TASK_ASSIGNEE_ACCESS_REQUIRED/);
      await assert.rejects(() => updateProjectTask(outsider.id, otherProjectId!, task.id, { status: "DONE", expectedRevision: task.revision }), /PROJECT_TASK_NOT_FOUND/);
      await assert.rejects(() => createProjectResource(member.id, projectId!, { label: "Private link", url: "https://example.test" }), /PARTICIPANT_ROLE_FORBIDDEN/);
      await assert.rejects(() => updateProjectResource(outsider.id, otherProjectId!, resource.id, { label: "Cross-project edit", expectedRevision: resource.revision }), /PROJECT_RESOURCE_NOT_FOUND/);
    });
    await context.test("assigned members change status and concurrent updates retain one authoritative revision", async () => {
      const outcomes = await Promise.allSettled([
        updateProjectTask(member.id, projectId!, task.id, { status: "IN_PROGRESS", expectedRevision: task.revision }),
        updateProjectTask(owner.id, projectId!, task.id, { title: "Prototype work", expectedRevision: task.revision }),
      ]);
      assert.equal(outcomes.filter((result) => result.status === "fulfilled").length, 1);
      assert.equal(outcomes.filter((result) => result.status === "rejected").length, 1);
      const current = (await getProjectCollaboration(member.id, projectId!)).tasks.find((record) => record.id === task.id)!;
      const done = await updateProjectTask(member.id, projectId!, task.id, { status: "DONE", expectedRevision: current.revision });
      assert.ok(done.completedAt); assert.equal(done.overdue, false);
      await assert.rejects(() => updateProjectTask(owner.id, projectId!, task.id, { status: "TODO", expectedRevision: done.revision }), /PROJECT_TASK_TERMINAL/);
      await assert.rejects(() => db.projectTask.update({ where: { id: task.id }, data: { status: "TODO", completedAt: null } }));
    });
    await context.test("ended memberships lose workspace access while historic assignments remain", async () => {
      const assigned = await createProjectTask(owner.id, projectId!, { title: "Retain former assignment", assigneeUserId: member.id });
      const membership = await db.teamMembership.findFirstOrThrow({ where: { teamId: teamId!, userId: member.id, leftAt: null } });
      await updateTeamMember(owner.id, teamId!, membership.id, { action: "remove" });
      await assert.rejects(() => getProjectCollaboration(member.id, projectId!), /PROJECT_NOT_FOUND/);
      await assert.rejects(() => updateProjectTask(member.id, projectId!, assigned.id, { status: "DONE", expectedRevision: assigned.revision }), /PROJECT_NOT_FOUND/);
      const retained = (await getProjectCollaboration(owner.id, projectId!)).tasks.find((record) => record.id === assigned.id)!;
      assert.equal(retained.assigneeUserId, member.id); assert.equal(retained.assigneeHasCurrentAccess, false);
      await updateProjectTask(owner.id, projectId!, retained.id, { title: "Historic assignee retained", expectedRevision: retained.revision });
      assert.equal((await db.projectTask.findUniqueOrThrow({ where: { id: retained.id } })).assigneeUserId, member.id);
      await assert.rejects(() => createProjectTask(owner.id, projectId!, { title: "Cannot reassign former member", assigneeUserId: member.id }), /PROJECT_TASK_ASSIGNEE_ACCESS_REQUIRED/);
    });
    await context.test("safe resources remain private, versioned and bounded", async () => {
      for (const url of ["javascript:alert(1)", "data:text/plain,secret", "file:///secret", "http://example.test"]) await assert.rejects(() => createProjectResource(owner.id, projectId!, { label: "Unsafe", url }));
      await assert.rejects(() => db.projectResource.create({ data: { projectId: projectId!, label: "Unsafe direct write", type: "OTHER", url: "javascript:alert(1)", createdByUserId: owner.id } }));
      const edited = await updateProjectResource(lead.id, projectId!, resource.id, { label: "Research protocol", expectedRevision: resource.revision });
      await assert.rejects(() => removeProjectResource(owner.id, projectId!, resource.id, { expectedRevision: resource.revision }), /PROJECT_RESOURCE_REVISION_CONFLICT/);
      await updateProjectPublication(owner.id, projectId!, { visibility: "PUBLIC", publicSlug: `collaboration-${suffix}`, confirmed: true });
      const publicProject = await getPublicProject(`collaboration-${suffix}`);
      assert.ok(publicProject); assert.equal(JSON.stringify(publicProject).includes("private-protocol"), false); assert.equal("resources" in publicProject, false); assert.equal("tasks" in publicProject, false);
      assert.equal(JSON.stringify(awardSummarySelect).includes("projectResources"), false); assert.equal(JSON.stringify(awardSummarySelect).includes("tasks"), false);
      await removeProjectResource(owner.id, projectId!, resource.id, { expectedRevision: edited.revision });
      await db.projectResource.createMany({ data: Array.from({ length: 99 }, (_, index) => ({ projectId: projectId!, label: `Resource ${index}`, type: "DOCUMENT" as const, url: `https://example.test/${index}`, createdByUserId: owner.id })) });
      const outcomes = await Promise.allSettled([createProjectResource(owner.id, projectId!, { label: "Last resource A", url: "https://example.test/a" }), createProjectResource(owner.id, projectId!, { label: "Last resource B", url: "https://example.test/b" })]);
      assert.equal(outcomes.filter((result) => result.status === "fulfilled").length, 1); assert.equal(await db.projectResource.count({ where: { projectId: projectId! } }), 100);
    });
    await context.test("task history is paginated and project activity stays access-scoped", async () => {
      await db.projectTask.createMany({ data: Array.from({ length: 101 }, (_, index) => ({ projectId: projectId!, title: `Historic task ${index}`, status: "DONE" as const, priority: "LOW" as const, completedAt: new Date("2025-01-01T12:00:00Z"), createdByUserId: owner.id })) });
      const first = await getProjectCollaboration(owner.id, projectId!, { taskFilter: "completed", taskPage: 1 });
      const second = await getProjectCollaboration(owner.id, projectId!, { taskFilter: "completed", taskPage: 2 });
      assert.equal(first.tasks.length, 100); assert.equal(first.taskTotal, 102); assert.equal(second.tasks.length, 2);
      assert.equal(new Set([...first.tasks, ...second.tasks].map((record) => record.id)).size, 102);
      assert.equal((await getProjectCollaboration(owner.id, projectId!, { taskFilter: "pending" })).taskTotal, 1);
      const activity = await getProjectActivity(owner.id, projectId!);
      assert.ok(activity.some((event) => event.id === `task-${task.id}`));
      assert.equal(JSON.stringify(activity).includes("private-protocol"), false);
      await assert.rejects(() => getProjectActivity(outsider.id, projectId!), /PROJECT_NOT_FOUND/);
      assert.deepEqual(await getTeamProjectActivity(outsider.id, [projectId!]), []);
    });
    await context.test("archived project retains reads and refuses new operational changes", async () => {
      await updateProject(owner.id, projectId!, { status: "ARCHIVED" });
      assert.equal((await getProjectCollaboration(owner.id, projectId!)).canManage, false);
      await assert.rejects(() => createProjectTask(owner.id, projectId!, { title: "Archived work" }), /PROJECT_ARCHIVED/);
    });
  } finally {
    await db.project.deleteMany({ where: { id: { in: [projectId, otherProjectId].filter((value): value is string => Boolean(value)) } } });
    if (teamId) await db.team.delete({ where: { id: teamId } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
  }
});
