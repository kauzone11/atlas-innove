import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import { db } from "@/lib/db";
import { createProject, createTeam } from "@/lib/participants/service";
import { canViewProfileSection, deleteProfileRecord, getOwnProfile, getPublicProfile, getPublicProfilePreview, getVisibleProfile, hasCurrentProfileCollaboration, saveProfileRecord, updateProfile } from "@/lib/profiles/service";

after(async () => { await db.$disconnect(); });

test("profile owner controls publication and serialized section privacy", async (context) => {
  if (!process.env.DATABASE_URL) { assert.notEqual(process.env.CI, "true", "CI requires DATABASE_URL for profile privacy integration tests"); context.skip("DATABASE_URL is not configured"); return; }
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12); const userIds: string[] = []; const teamIds: string[] = []; const projectIds: string[] = []; let organizationId: string | null = null;
  try {
    const people = [];
    for (const label of ["owner", "collaborator", "visitor"]) {
      const user = await db.user.create({ data: { email: `${label}-profile-${suffix}@example.test`, passwordHash: "secret-password", profile: { create: { fullName: `Profile ${label}`, phone: "private-phone-marker" } } }, select: { id: true, email: true } });
      userIds.push(user.id); people.push(user);
    }
    const [owner, collaborator, visitor] = people; const handle = `profile-${suffix}`;
    const identity = { handle, headline: "Research and innovation", city: "Aracaju", state: "Sergipe", country: "Brasil" };
    const publicPrivacy = { profileVisibility: "PUBLIC", skillsVisibility: "PUBLIC", experienceVisibility: "PUBLIC", educationVisibility: "PUBLIC", linksVisibility: "PUBLIC", verifiedParticipationVisibility: "PUBLIC", projectsVisibility: "PUBLIC" };

    await context.test("defaults are private and publication needs complete identity plus consent", async () => {
      const initial = await getOwnProfile(owner.id); assert.equal(initial.profileVisibility, "PRIVATE"); assert.equal(initial.publishedAt, null); assert.equal(initial.skillsVisibility, "PRIVATE");
      await assert.rejects(() => updateProfile(owner.id, { section: "publish", confirmed: true }), /PROFILE_PUBLICATION_INCOMPLETE/);
      await assert.rejects(() => updateProfile(owner.id, { section: "publish", confirmed: false }));
      await updateProfile(owner.id, { section: "identity", data: identity });
      await updateProfile(owner.id, { section: "about", data: { bio: "Innovation across institutions" } });
      assert.equal(await getPublicProfile(handle), null); assert.equal(await getVisibleProfile(handle, visitor.id), null);
      assert.ok(await getPublicProfilePreview(owner.id));
      await updateProfile(owner.id, { section: "topics", data: { skills: ["Inteligência Artificial"], interests: ["Saúde"] } });
      await updateProfile(owner.id, { section: "publish", confirmed: true });
      const published = await getPublicProfile(handle); assert.ok(published); assert.equal(published.fullName, "Profile owner");
      assert.equal(Object.hasOwn(published, "skills"), false); assert.equal(Object.hasOwn(published, "experience"), false);
      const serialized = JSON.stringify(published); for (const secret of [owner.email, "private-phone-marker", "secret-password", "Inteligência Artificial", "Saúde"]) assert.equal(serialized.includes(secret), false, secret);
      await assert.rejects(() => updateProfile(owner.id, { section: "identity", data: { ...identity, headline: null } }), /PROFILE_PUBLISHED_IDENTITY_REQUIRED/);
    });

    await context.test("section and record scopes both apply and other owners cannot modify records", async () => {
      for (const visibility of ["PUBLIC", "PLATFORM", "TEAM", "PRIVATE"] as const) await saveProfileRecord(owner.id, "experience", { organizationName: `Organization ${visibility}`, title: `Role ${visibility}`, startsAt: "2025-01-01", endsAt: null, current: true, description: `description-${visibility}`, visibility });
      await saveProfileRecord(owner.id, "education", { institution: "Public University", course: "Innovation", degree: null, startsAt: "2020-02-29", endsAt: "2024-03-01", description: null, visibility: "PUBLIC" });
      await saveProfileRecord(owner.id, "links", { label: "Public portfolio", url: "https://example.test/public", type: "PORTFOLIO", visibility: "PUBLIC" });
      await saveProfileRecord(owner.id, "links", { label: "Private portfolio marker", url: "https://example.test/private-marker", type: "PORTFOLIO", visibility: "PRIVATE" });
      await updateProfile(owner.id, { section: "privacy", data: publicPrivacy });
      const anonymous = await getPublicProfile(handle); assert.ok(anonymous); assert.deepEqual(anonymous.experience?.map((record) => record.title), ["Role PUBLIC"]); assert.equal(anonymous.education?.[0].startsAt, "2020-02-29"); assert.equal(anonymous.links?.length, 1);
      for (const secret of ["Role PLATFORM", "Role TEAM", "Role PRIVATE", "Private portfolio marker", "private-marker"]) assert.equal(JSON.stringify(anonymous).includes(secret), false, secret);
      const platform = await getVisibleProfile(handle, visitor.id); assert.deepEqual(platform?.experience?.map((record) => record.title).sort(), ["Role PLATFORM", "Role PUBLIC"]);
      const ownVisible = await getVisibleProfile(handle, owner.id); assert.equal(ownVisible?.experience?.length, 4); assert.equal(ownVisible?.links?.length, 2);
      const own = await getOwnProfile(owner.id); const record = own.experience[0];
      await assert.rejects(() => saveProfileRecord(visitor.id, "experience", { organizationName: record.organizationName, title: "Intrusion", startsAt: record.startsAt, endsAt: record.endsAt, current: record.current, description: record.description, visibility: record.visibility }, record.id), /PROFILE_RECORD_NOT_FOUND/);
      await assert.rejects(() => deleteProfileRecord(visitor.id, "experience", record.id), /PROFILE_RECORD_NOT_FOUND/);
      assert.equal((await getOwnProfile(owner.id)).experience.length, 4);
      await updateProfile(owner.id, { section: "privacy", data: { ...publicPrivacy, experienceVisibility: "PRIVATE" } });
      assert.equal(Object.hasOwn((await getPublicProfile(handle))!, "experience"), false);
      await updateProfile(owner.id, { section: "privacy", data: publicPrivacy });
    });

    await context.test("collaboration visibility follows current membership instead of historical co-membership", async () => {
      const team = await createTeam(owner.id, { name: "Profile collaboration" }); teamIds.push(team.id);
      const membership = await db.teamMembership.create({ data: { teamId: team.id, userId: collaborator.id, role: "MEMBER" } });
      assert.equal(await hasCurrentProfileCollaboration(owner.id, collaborator.id), true);
      assert.equal(await canViewProfileSection({ profileUserId: owner.id, viewerUserId: collaborator.id, scope: "TEAM" }), true);
      assert.equal((await getVisibleProfile(handle, collaborator.id))?.experience?.length, 3);
      await db.teamMembership.update({ where: { id: membership.id }, data: { status: "DISABLED", leftAt: new Date() } });
      assert.equal(await hasCurrentProfileCollaboration(owner.id, collaborator.id), false);
      assert.equal((await getVisibleProfile(handle, collaborator.id))?.experience?.length, 2);
      const project = await createProject(owner.id, { name: "Public identity project", summary: "An innovation identity fixture for privacy tests." }); projectIds.push(project.id);
      const projectMember = await db.projectMembership.create({ data: { projectId: project.id, userId: collaborator.id } });
      assert.equal(await hasCurrentProfileCollaboration(owner.id, collaborator.id), true);
      await db.projectMembership.update({ where: { id: projectMember.id }, data: { leftAt: new Date() } });
      assert.equal(await hasCurrentProfileCollaboration(owner.id, collaborator.id), false);
      await updateProfile(owner.id, { section: "privacy", data: { ...publicPrivacy, profileVisibility: "TEAM" } });
      assert.equal(await getPublicProfile(handle), null); assert.equal(await getVisibleProfile(handle, collaborator.id), null); assert.ok(await getVisibleProfile(handle, owner.id));
      await updateProfile(owner.id, { section: "privacy", data: { ...publicPrivacy, profileVisibility: "PLATFORM" } });
      assert.equal(await getVisibleProfile(handle), null); assert.ok(await getVisibleProfile(handle, visitor.id));
      await updateProfile(owner.id, { section: "publish", confirmed: true });
    });

    await context.test("public verification redacts failed/private applications and private projects", async () => {
      const org = await db.organization.create({ data: { name: "Profile institution", slug: `profile-org-${suffix}` } }); organizationId = org.id;
      const program = await db.fundingProgram.create({ data: { organizationId: org.id, name: "Public program", slug: "public-program", createdByUserId: owner.id } });
      const call = await db.fundingCall.create({ data: { organizationId: org.id, fundingProgramId: program.id, title: "Public verified call", callNumber: "1", publicListingEnabled: true, status: "CLOSED", resultsPublishedAt: new Date() } });
      const privateCall = await db.fundingCall.create({ data: { organizationId: org.id, fundingProgramId: program.id, title: "Private call marker", callNumber: "2", publicListingEnabled: false, resultsPublishedAt: new Date() } });
      const projectId = projectIds[0];
      for (const [fundingCallId, decision, projectNameSnapshot] of [[call.id, "SELECTED", "private-project-marker"], [privateCall.id, "SELECTED", "private-call-project-marker"], [call.id, "NOT_SELECTED", "failed-project-marker"]] as const) {
        const failedProject = decision === "NOT_SELECTED" ? await createProject(owner.id, { name: "Failed project marker", summary: "A failed application fixture that must remain private." }) : null;
        if (failedProject) projectIds.push(failedProject.id);
        await db.application.create({ data: { organizationId: org.id, fundingCallId, projectId: failedProject?.id ?? projectId, submittedByUserId: owner.id, status: "DECIDED", submittedAt: new Date(), decision, projectNameSnapshot, projectSummarySnapshot: "private-summary-marker", decisionNote: "private-decision-note-marker" } });
      }
      let visible = await getPublicProfile(handle); assert.equal(visible?.verifiedParticipations?.length, 1); assert.equal(visible?.verifiedParticipations?.[0].projectName, null);
      for (const secret of ["Private call marker", "private-project-marker", "private-call-project-marker", "failed-project-marker", "private-summary-marker", "private-decision-note-marker", "NOT_SELECTED", owner.email, "private-phone-marker"]) assert.equal(JSON.stringify(visible).includes(secret), false, secret);
      await db.project.update({ where: { id: projectId }, data: { visibility: "PUBLIC", publishedAt: new Date(), publicSlug: `public-project-${suffix}` } });
      visible = await getPublicProfile(handle); assert.equal(visible?.publicProjects?.length, 1); assert.equal(visible?.verifiedParticipations?.[0].projectUrl, `/projects/public-project-${suffix}`);
      await updateProfile(owner.id, { section: "privacy", data: { ...publicPrivacy, verifiedParticipationVisibility: "PRIVATE", projectsVisibility: "PRIVATE" } });
      visible = await getPublicProfile(handle); assert.equal(Object.hasOwn(visible!, "verifiedParticipations"), false); assert.equal(Object.hasOwn(visible!, "publicProjects"), false);
    });

    await context.test("unpublish preserves data and handles remain unique", async () => {
      const before = await getOwnProfile(owner.id);
      await updateProfile(owner.id, { section: "unpublish" }); assert.equal(await getPublicProfile(handle), null);
      const after = await getOwnProfile(owner.id); assert.equal(after.bio, before.bio); assert.deepEqual(after.experience, before.experience); assert.equal(after.publishedAt, null);
      await assert.rejects(() => updateProfile(visitor.id, { section: "identity", data: identity }), /PROFILE_HANDLE_UNAVAILABLE/);
      assert.equal((await getOwnProfile(visitor.id)).handle, null);
      await updateProfile(owner.id, { section: "publish", confirmed: true }); assert.ok(await getPublicProfile(handle));
      await updateProfile(owner.id, { section: "identity", data: { ...identity, handle: `${handle}-new` } }); assert.equal(await getPublicProfile(handle), null); assert.ok(await getPublicProfile(`${handle}-new`));
    });
  } finally {
    if (organizationId) await db.organization.delete({ where: { id: organizationId } });
    if (projectIds.length) await db.project.deleteMany({ where: { id: { in: projectIds } } });
    if (teamIds.length) await db.team.deleteMany({ where: { id: { in: teamIds } } });
    if (userIds.length) await db.user.deleteMany({ where: { id: { in: userIds } } });
  }
});
