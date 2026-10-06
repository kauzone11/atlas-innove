import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import { db } from "@/lib/db";
import { createProject, updateProjectPublication } from "@/lib/participants/service";
import { getOwnProfile, getPublicProfile, getVisibleProfile, saveProfileRecord, updateProfile } from "@/lib/profiles/service";
import { getDiscoverablePerson, listDiscoverablePeople } from "@/lib/network/people";
import { getDiscoverableProject, listDiscoverableProjects } from "@/lib/network/projects";

after(async () => { await db.$disconnect(); });

test("opt-in discovery enforces section privacy, owner consent, blocks and bounded relevance", async (context) => {
  if (!process.env.DATABASE_URL) { assert.notEqual(process.env.CI, "true", "CI requires DATABASE_URL for discovery tests"); context.skip("DATABASE_URL is not configured"); return; }
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const users: Array<{ id: string; email: string }> = []; const projects: string[] = [];
  const privacy = { profileVisibility: "PLATFORM", skillsVisibility: "PRIVATE", experienceVisibility: "PRIVATE", educationVisibility: "PRIVATE", linksVisibility: "PRIVATE", verifiedParticipationVisibility: "PRIVATE", projectsVisibility: "PRIVATE" };
  try {
    for (const label of ["owner", "viewer", "second", "third"]) {
      const user = await db.user.create({ data: { email: `${label}-network-${suffix}@example.test`, passwordHash: "private-password-marker", profile: { create: { fullName: `${label} ${suffix}`, phone: "private-phone-marker" } } }, select: { id: true, email: true } });
      users.push(user);
    }
    const [owner, viewer, second, third] = users; const handle = `network-${suffix}`;
    const identity = { handle, headline: "Research collaboration", city: "Fortaleza", state: "Ceará", country: "Brasil" };
    await context.test("visibility and public links do not grant directory consent", async () => {
      const initial = await getOwnProfile(owner.id);
      assert.equal(initial.directoryEnabled, false); assert.equal(initial.collaborationStatus, "NOT_AVAILABLE");
      await assert.rejects(() => updateProfile(owner.id, { section: "discovery", data: { directoryEnabled: true, collaborationStatus: "OPEN", collaborationNote: null } }), /PROFILE_DISCOVERY_INCOMPLETE/);
      await updateProfile(owner.id, { section: "identity", data: identity });
      await assert.rejects(() => updateProfile(owner.id, { section: "discovery", data: { directoryEnabled: true, collaborationStatus: "OPEN", collaborationNote: null } }), /PROFILE_DISCOVERY_VISIBILITY_REQUIRED/);
      await updateProfile(owner.id, { section: "publish", confirmed: true });
      assert.ok(await getPublicProfile(handle));
      assert.equal((await listDiscoverablePeople(viewer.id, { q: suffix })).people.some((person) => person.userId === owner.id), false);
      await updateProfile(owner.id, { section: "privacy", data: privacy });
      await updateProfile(owner.id, { section: "discovery", data: { directoryEnabled: true, collaborationStatus: "OPEN", collaborationNote: "Interested in applied research" } });
      assert.equal(await getPublicProfile(handle), null);
      assert.ok(await getDiscoverablePerson(viewer.id, handle));
      await assert.rejects(() => updateProfile(owner.id, { section: "identity", data: { ...identity, headline: null } }), /PROFILE_DIRECTORY_IDENTITY_REQUIRED/);
    });
    await context.test("hidden topics cannot affect search or relevance and contacts never serialize", async () => {
      await updateProfile(owner.id, { section: "topics", data: { skills: [`Private topic ${suffix}`], interests: ["Inteligência artificial"] } });
      await saveProfileRecord(owner.id, "experience", { organizationName: "private-experience-marker", title: "private-role-marker", startsAt: "2025-01-01", endsAt: null, current: true, description: null, visibility: "PRIVATE" });
      let page = await listDiscoverablePeople(viewer.id, { q: suffix });
      const person = page.people.find((row) => row.userId === owner.id)!; assert.ok(person);
      assert.deepEqual(person.skills, []); assert.deepEqual(person.interests, []); assert.deepEqual(person.relevance.reasons, []);
      assert.equal((await listDiscoverablePeople(viewer.id, { topic: `Private topic ${suffix}` })).people.some((row) => row.userId === owner.id), false);
      assert.equal((await listDiscoverablePeople(viewer.id, { q: `Private topic ${suffix}` })).people.some((row) => row.userId === owner.id), false);
      const detail = await getDiscoverablePerson(viewer.id, handle); assert.ok(detail);
      for (const secret of [owner.email, "private-phone-marker", "private-password-marker", "private-experience-marker", "private-role-marker", `Private topic ${suffix}`]) assert.equal(JSON.stringify({ page, detail }).includes(secret), false, secret);
      await updateProfile(owner.id, { section: "privacy", data: { ...privacy, skillsVisibility: "PLATFORM" } });
      page = await listDiscoverablePeople(viewer.id, { topic: `private TOPIC ${suffix}` });
      assert.equal(page.people.some((row) => row.userId === owner.id), true);
      await updateProfile(owner.id, { section: "privacy", data: privacy });
      await updateProfile(owner.id, { section: "privacy", data: { ...privacy, profileVisibility: "PUBLIC" } });
      assert.equal(await getPublicProfile(handle), null); assert.ok(await getVisibleProfile(handle, viewer.id));
      await updateProfile(owner.id, { section: "privacy", data: { ...privacy, profileVisibility: "TEAM" } });
      assert.equal((await getOwnProfile(owner.id)).directoryEnabled, false); assert.equal(await getDiscoverablePerson(viewer.id, handle), null);
      await updateProfile(owner.id, { section: "privacy", data: privacy });
      await updateProfile(owner.id, { section: "discovery", data: { directoryEnabled: true, collaborationStatus: "OPEN", collaborationNote: null } });
    });
    await context.test("pagination is bounded and project context requires existing access", async () => {
      for (const [user, index] of [[second, 2], [third, 3]] as const) {
        await updateProfile(user.id, { section: "identity", data: { ...identity, handle: `network-${suffix}-${index}` } });
        await updateProfile(user.id, { section: "privacy", data: privacy });
        await updateProfile(user.id, { section: "discovery", data: { directoryEnabled: true, collaborationStatus: "SELECTIVE", collaborationNote: null } });
      }
      const first = await listDiscoverablePeople(viewer.id, { q: suffix, pageSize: 1 }); const next = await listDiscoverablePeople(viewer.id, { q: suffix, pageSize: 1, page: 2 });
      assert.equal(first.people.length, 1); assert.equal(first.hasNext, true); assert.notEqual(first.people[0].userId, next.people[0].userId);
      await assert.rejects(() => listDiscoverablePeople(viewer.id, { pageSize: 41 }));
      const project = await createProject(owner.id, { name: `Discovery ${suffix}`, summary: "A safe innovation discovery fixture.", thematicAreas: ["Inteligência Artificial", "Saúde digital"] }); projects.push(project.id);
      assert.equal(project.directoryEnabled, false); assert.equal(project.collaborationOpen, false);
      await assert.rejects(() => listDiscoverablePeople(viewer.id, { projectId: project.id }), /PROJECT_NOT_FOUND/);
      await listDiscoverablePeople(owner.id, { projectId: project.id });
    });
    await context.test("project disclosure is opt-in, owner-controlled and contains no workspace content", async () => {
      const projectId = projects[0];
      await db.projectTask.create({ data: { projectId, title: "private-task-marker", createdByUserId: owner.id } });
      await db.projectResource.create({ data: { projectId, type: "OTHER", label: "private-resource-marker", url: "https://example.test/private-resource-marker", createdByUserId: owner.id } });
      assert.equal(await getDiscoverableProject(viewer.id, projectId), null);
      await assert.rejects(() => updateProjectPublication(viewer.id, projectId, { visibility: "PLATFORM", directoryEnabled: true }), /PROJECT_NOT_FOUND/);
      await assert.rejects(() => updateProjectPublication(owner.id, projectId, { visibility: "PRIVATE", directoryEnabled: true }), /PROJECT_DISCOVERY_VISIBILITY_REQUIRED/);
      await assert.rejects(() => updateProjectPublication(owner.id, projectId, { visibility: "PLATFORM", directoryEnabled: false, collaborationOpen: true }), /PROJECT_COLLABORATION_REQUIRES_DIRECTORY/);
      await updateProjectPublication(owner.id, projectId, { visibility: "PLATFORM", directoryEnabled: true, collaborationOpen: true, collaborationNote: "Looking for researchers" });
      const page = await listDiscoverableProjects(viewer.id, { topic: "inteligencia artificial" }); assert.ok(page.projects.some((project) => project.id === projectId));
      assert.ok((await listDiscoverableProjects(viewer.id, { q: "saude digital" })).projects.some((project) => project.id === projectId));
      const detail = await getDiscoverableProject(viewer.id, projectId); assert.ok(detail); assert.equal(detail.collaborationOpen, true);
      for (const key of ["tasks", "resources", "applications", "awards", "memberships", "primaryTeam", "createdBy", "email"]) assert.equal(Object.hasOwn(detail, key), false, key);
      for (const secret of ["private-task-marker", "private-resource-marker", owner.email]) assert.equal(JSON.stringify({ page, detail }).includes(secret), false, secret);
      await updateProjectPublication(owner.id, projectId, { visibility: "PRIVATE" });
      assert.equal(await getDiscoverableProject(viewer.id, projectId), null);
      const settings = await db.project.findUniqueOrThrow({ where: { id: projectId }, select: { directoryEnabled: true, collaborationOpen: true } });
      assert.deepEqual(settings, { directoryEnabled: false, collaborationOpen: false });
      await updateProjectPublication(owner.id, projectId, { visibility: "PLATFORM", directoryEnabled: true, collaborationOpen: true });
    });
    await context.test("both block directions hide people and creator projects inside discovery", async () => {
      const projectId = projects[0];
      for (const [blockerUserId, blockedUserId] of [[owner.id, viewer.id], [viewer.id, owner.id]]) {
        await db.userBlock.create({ data: { blockerUserId, blockedUserId } });
        assert.equal(await getDiscoverablePerson(viewer.id, handle), null);
        assert.equal(await getDiscoverableProject(viewer.id, projectId), null);
        assert.equal((await listDiscoverablePeople(viewer.id, { q: suffix })).people.some((person) => person.userId === owner.id), false);
        assert.equal((await listDiscoverableProjects(viewer.id, { q: suffix })).projects.some((project) => project.id === projectId), false);
        await db.userBlock.delete({ where: { blockerUserId_blockedUserId: { blockerUserId, blockedUserId } } });
      }
    });
  } finally {
    if (users.length) await db.userBlock.deleteMany({ where: { OR: [{ blockerUserId: { in: users.map((user) => user.id) } }, { blockedUserId: { in: users.map((user) => user.id) } }] } });
    if (projects.length) await db.project.deleteMany({ where: { id: { in: projects } } });
    if (users.length) await db.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
  }
});
