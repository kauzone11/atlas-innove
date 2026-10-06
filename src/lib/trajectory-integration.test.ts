import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { db } from "@/lib/db";
import { createProject, createTeam, updateProject, updateProjectPublication } from "@/lib/participants/service";
import { getPublicProject } from "@/lib/participants/public-project";
import { getParticipantTrajectory, getVerifiedParticipations } from "@/lib/participants/trajectory";
import { getPersonalApplication, createPersonalApplication } from "@/lib/selection/service";

test("verified participation uses historical submission relationships and public project DTOs contain only published evidence", async (context) => {
  if (!process.env.DATABASE_URL) { assert.notEqual(process.env.CI, "true"); context.skip("A disposable PostgreSQL database is required."); return; }
  const suffix = randomUUID().replaceAll("-", "");
  const users = await Promise.all(["owner", "historical", "late", "former", "outsider"].map((label) => db.user.create({ data: { email: `trajectory-${label}-${suffix}@example.test`, passwordHash: "test-only", profile: { create: { fullName: `PRIVATE-PERSON-${label}`, phone: "PRIVATE-PHONE" } } } })));
  const [owner, historical, late, former, outsider] = users;
  const teams: string[] = []; const projects: string[] = []; const organizations: string[] = [];
  const submittedAt = new Date("2026-01-15T12:00:00Z");
  try {
    const team = await createTeam(owner.id, { name: "PRIVATE-TEAM" }); teams.push(team.id);
    const newTeam = await createTeam(owner.id, { name: "PRIVATE-NEW-TEAM" }); teams.push(newTeam.id);
    await db.teamMembership.createMany({ data: [
      { teamId: team.id, userId: historical.id, joinedAt: new Date("2026-01-01T00:00:00Z"), leftAt: new Date("2026-02-01T00:00:00Z"), status: "DISABLED" },
      { teamId: team.id, userId: former.id, joinedAt: new Date("2026-01-01T00:00:00Z"), leftAt: new Date("2026-01-10T00:00:00Z"), status: "DISABLED" },
      { teamId: newTeam.id, userId: late.id, joinedAt: new Date("2026-02-01T00:00:00Z"), role: "LEAD" },
    ] });
    const project = await createProject(owner.id, { name: "PRIVATE-PROJECT", summary: "Public summary of a research initiative.", primaryTeamId: team.id, thematicAreas: ["Saúde"], websiteUrl: "https://example.test/project" }); projects.push(project.id);
    await db.projectMembership.create({ data: { projectId: project.id, userId: late.id, role: "LEAD", joinedAt: new Date("2026-02-01T00:00:00Z") } });
    const organization = await db.organization.create({ data: { name: "Research institution", slug: `trajectory-${suffix}` } }); organizations.push(organization.id);
    const program = await db.fundingProgram.create({ data: { organizationId: organization.id, name: "Research program", slug: `program-${suffix}`, createdByUserId: owner.id, status: "ACTIVE" } });
    const calls = await Promise.all(["selected", "unpublished", "private", "failed"].map((label) => db.fundingCall.create({ data: { organizationId: organization.id, fundingProgramId: program.id, title: `Call ${label}`, callNumber: label, status: label === "unpublished" ? "IN_REVIEW" : "RESULT_PUBLISHED", publicListingEnabled: label !== "private", resultsPublishedAt: label === "unpublished" ? null : new Date("2026-01-20T12:00:00Z") } })));
    const applications = await Promise.all(calls.map((call, index) => db.application.create({ data: { organizationId: organization.id, fundingCallId: call.id, projectId: project.id, teamId: team.id, submittedByUserId: owner.id, submittedAt, status: "DECIDED", decision: index === 3 ? "NOT_SELECTED" : "SELECTED", projectNameSnapshot: "PRIVATE-SNAPSHOT", projectSummarySnapshot: "PRIVATE-SUMMARY", projectDescriptionSnapshot: "PRIVATE-DESCRIPTION", teamNameSnapshot: "PRIVATE-TEAM-SNAPSHOT", decisionNote: "PRIVATE-DECISION-NOTE" } })));
    await updateProject(owner.id, project.id, { primaryTeamId: newTeam.id });
    const [selected] = applications;
    const cohort = await db.cohort.create({ data: { organizationId: organization.id, fundingProgramId: program.id, fundingCallId: calls[0].id, name: "Research cohort", status: "ACTIVE" } });
    const venture = await db.venture.create({ data: { organizationId: organization.id, name: "PRIVATE-VENTURE", kind: "PROJECT", sourceProjectId: project.id } });
    const enrolledAt = new Date("2026-01-25T12:00:00Z");
    await db.ventureEnrollment.create({ data: { organizationId: organization.id, cohortId: cohort.id, ventureId: venture.id, applicationId: selected.id, enrolledAt } });
    const milestone = await db.milestone.create({ data: { organizationId: organization.id, ventureId: venture.id, type: "MVP_LAUNCHED", title: "MVP lançado", description: "PRIVATE-MILESTONE-NOTE", occurredAt: new Date("2026-01-30T12:00:00Z") } });

    await context.test("late joins and ended-before-submission periods do not confer historical verification", async () => {
      assert.equal((await getVerifiedParticipations(historical.id)).length, 2);
      assert.deepEqual(await getVerifiedParticipations(late.id), []);
      assert.deepEqual(await getVerifiedParticipations(former.id), []);
      assert.equal((await getVerifiedParticipations(owner.id)).length, 2);
      assert.deepEqual(await getVerifiedParticipations(outsider.id), []);
      assert.equal((await getPersonalApplication(historical.id, selected.id))?.canManage, false);
      assert.equal(await getPersonalApplication(outsider.id, selected.id), null);
      const visible = await getVerifiedParticipations(historical.id, { publicOnly: true });
      assert.equal(visible.length, 1); assert.equal(visible[0].projectName, null); assert.equal(visible[0].projectUrl, null);
      assert.equal(JSON.stringify(visible).includes("PRIVATE"), false);
    });
    await context.test("trajectory contains historical membership periods, selection, cohort and tenant-bound milestones", async () => {
      const events = await getParticipantTrajectory(historical.id);
      for (const type of ["TEAM_JOINED", "TEAM_LEFT", "APPLICATION_SUBMITTED", "APPLICATION_SELECTED", "COHORT_JOINED", "VENTURE_MILESTONE"]) assert.ok(events.some((event) => event.type === type), type);
      assert.equal(events.filter((event) => event.id === `milestone-${milestone.id}`).length, 1);
      assert.equal(events.some((event) => event.title.includes("PRIVATE-MILESTONE-NOTE")), false);
      assert.equal((await getParticipantTrajectory(late.id)).some((event) => event.type === "APPLICATION_SELECTED"), false);
      assert.deepEqual(events, [...events].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || a.id.localeCompare(b.id)));
    });
    await context.test("only direct owners can publish; publication keeps stable identity and excludes failed/private evidence", async () => {
      const slug = `project-${suffix}`;
      assert.equal(await getPublicProject(slug), null);
      await assert.rejects(() => updateProject(owner.id, project.id, { websiteUrl: "javascript:alert(1)" }), /HTTPS/);
      await assert.rejects(() => updateProject(owner.id, project.id, { websiteUrl: "invalid address" }), /endereço/);
      await assert.rejects(() => updateProjectPublication(late.id, project.id, { visibility: "PUBLIC", publicSlug: slug, confirmed: true }), /PARTICIPANT_ROLE_FORBIDDEN/);
      await assert.rejects(() => updateProjectPublication(owner.id, project.id, { visibility: "PUBLIC", publicSlug: slug }), /Confirme/);
      await updateProjectPublication(owner.id, project.id, { visibility: "PUBLIC", publicSlug: slug, confirmed: true });
      const publicProject = await getPublicProject(slug); assert.ok(publicProject);
      assert.equal(publicProject.participations.length, 1);
      assert.equal(JSON.stringify(publicProject).includes("PRIVATE-TEAM"), false);
      assert.equal(JSON.stringify(publicProject).includes("PRIVATE-SNAPSHOT"), false);
      assert.equal(JSON.stringify(publicProject).includes("PRIVATE-DECISION"), false);
      assert.equal(JSON.stringify(publicProject).includes("PRIVATE-PHONE"), false);
      assert.equal(JSON.stringify(publicProject).includes(owner.email), false);
      await updateProject(late.id, project.id, { name: "Renamed initiative" });
      assert.equal((await getPublicProject(slug))?.name, "Renamed initiative");
      assert.equal((await getVerifiedParticipations(historical.id, { publicOnly: true }))[0].projectUrl, `/projects/${slug}`);
      await updateProjectPublication(owner.id, project.id, { visibility: "PRIVATE" });
      assert.equal(await getPublicProject(slug), null);
      assert.equal((await db.project.findUniqueOrThrow({ where: { id: project.id } })).publicSlug, slug);
      assert.equal(await db.application.count({ where: { projectId: project.id } }), 4);
    });
    await context.test("private calls reject arbitrary-id application creation", async () => {
      const other = await createProject(outsider.id, { name: "Independent initiative", summary: "Another legitimate private project." }); projects.push(other.id);
      const privateCall = await db.fundingCall.create({ data: { organizationId: organization.id, fundingProgramId: program.id, title: "Private invitation", callNumber: "invite-only", status: "OPEN", applicationsEnabled: true } });
      await assert.rejects(() => createPersonalApplication(outsider.id, { projectId: other.id, fundingCallId: privateCall.id }), /FUNDING_CALL_NOT_FOUND/);
    });
  } finally {
    if (organizations.length) await db.organization.deleteMany({ where: { id: { in: organizations } } });
    if (projects.length) await db.project.deleteMany({ where: { id: { in: projects } } });
    if (teams.length) await db.team.deleteMany({ where: { id: { in: teams } } });
    await db.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
  }
});
