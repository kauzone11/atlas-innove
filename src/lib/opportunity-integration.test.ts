import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { db } from "@/lib/db";
import { createProject } from "@/lib/participants/service";
import { createPersonalApplication } from "@/lib/selection/service";
import { getPersonalOpportunity, getPublicOpportunity, listPersonalOpportunities, listPublicOpportunities, listSavedOpportunities, setSavedOpportunity, updateFundingCallDiscovery, saveExternalOpportunity, updateCallDocumentVisibility } from "@/lib/opportunities/service";

test("opportunity publication, private bookmarks and live relevance preserve privacy and tenant boundaries", async (context) => {
  if (!process.env.DATABASE_URL) { assert.notEqual(process.env.CI, "true", "CI requires PostgreSQL proof"); context.skip("DATABASE_URL is required"); return; }
  const suffix = randomUUID().replaceAll("-", "").slice(0, 10); const users: string[] = []; const organizations: string[] = []; const projects: string[] = [];
  const metadata = { publicListingEnabled: true, publicationConfirmed: true, supportType: "SUBVENTION" as const, territoryScope: "STATE" as const, territoryLabel: "Sergipe", eligibleStates: ["SE"], audienceTags: ["startup"], thematicAreas: ["Saúde"] };
  try {
    const participant = await db.user.create({ data: { email: `opportunity-${suffix}@example.test`, passwordHash: "test", profile: { create: { fullName: "Private participant", phone: "hidden-phone" } } } }); users.push(participant.id);
    const outsider = await db.user.create({ data: { email: `outsider-${suffix}@example.test`, passwordHash: "test" } }); users.push(outsider.id);
    const manager = await db.user.create({ data: { email: `manager-${suffix}@example.test`, passwordHash: "test" } }); users.push(manager.id);
    const analyst = await db.user.create({ data: { email: `analyst-${suffix}@example.test`, passwordHash: "test" } }); users.push(analyst.id);
    const organization = await db.organization.create({ data: { name: `Opportunity institution ${suffix}`, slug: `opportunity-${suffix}` } }); organizations.push(organization.id);
    const foreign = await db.organization.create({ data: { name: "Other institution", slug: `opportunity-other-${suffix}` } }); organizations.push(foreign.id);
    await db.organizationMembership.createMany({ data: [{ organizationId: organization.id, userId: manager.id, role: "MANAGER" }, { organizationId: organization.id, userId: analyst.id, role: "ANALYST" }] });
    const program = await db.fundingProgram.create({ data: { organizationId: organization.id, createdByUserId: manager.id, name: "Opportunity program", slug: `opportunity-${suffix}`, status: "ACTIVE" } });
    const call = await db.fundingCall.create({ data: { organizationId: organization.id, fundingProgramId: program.id, title: `Public call ${suffix}`, callNumber: "one", objective: "Public objective", status: "OPEN", applicationsEnabled: true } });
    const privateCall = await db.fundingCall.create({ data: { organizationId: organization.id, fundingProgramId: program.id, title: "hidden-private-call", callNumber: "private", status: "OPEN", applicationsEnabled: true } });
    const draft = await db.fundingCall.create({ data: { organizationId: organization.id, fundingProgramId: program.id, title: "hidden-draft-call", callNumber: "draft" } });
    const query = { q: suffix, status: "ALL" };
    assert.equal((await listPublicOpportunities(query)).length, 0);
    assert.equal(await getPersonalOpportunity(participant.id, privateCall.id), null);
    const project = await createProject(participant.id, { name: "Applicant project", summary: "A real applicant project for privacy testing" }); projects.push(project.id);
    await assert.rejects(() => createPersonalApplication(participant.id, { projectId: project.id, fundingCallId: privateCall.id }), /FUNDING_CALL_NOT_FOUND/);
    await assert.rejects(() => updateFundingCallDiscovery(analyst.id, organization.id, program.id, call.id, metadata), /ROLE_FORBIDDEN/);
    await assert.rejects(() => updateFundingCallDiscovery(manager.id, foreign.id, program.id, call.id, metadata), /ORGANIZATION_ACCESS_DENIED/);
    await assert.rejects(() => updateFundingCallDiscovery(manager.id, organization.id, program.id, draft.id, metadata), /FUNDING_CALL_PUBLICATION_REQUIRES_VISIBLE_STATUS/);
    await updateFundingCallDiscovery(manager.id, organization.id, program.id, call.id, metadata);
    const privateDocument = await db.fundingCallDocument.create({ data: { organizationId: organization.id, fundingCallId: call.id, type: "ANNEX", title: "hidden-private-document", externalUrl: "https://example.test/private-document", publishedAt: new Date() } });
    await db.fundingCallDocument.createMany({ data: [
      { organizationId: organization.id, fundingCallId: call.id, type: "NOTICE", title: "Public notice", externalUrl: "https://example.test/notice", publicListingEnabled: true, publishedAt: new Date("2020-01-01") },
      { organizationId: organization.id, fundingCallId: call.id, type: "ANNEX", title: "hidden-unpublished-document", externalUrl: "https://example.test/unpublished", publicListingEnabled: true },
      { organizationId: organization.id, fundingCallId: call.id, type: "ANNEX", title: "hidden-future-document", externalUrl: "https://example.test/future", publicListingEnabled: true, publishedAt: new Date("2099-01-01") },
    ] });
    const publicCall = await getPublicOpportunity(call.id); assert.ok(publicCall); assert.equal(publicCall.documents.length, 1);
    const serialized = JSON.stringify(publicCall); for (const secret of ["hidden-", '"applications":', '"evaluations":', "decisionNote", "passwordHash", "hidden-phone", participant.email]) assert.ok(!serialized.includes(secret), secret);
    await assert.rejects(() => updateCallDocumentVisibility(analyst.id, organization.id, program.id, call.id, privateDocument.id, true), /ROLE_FORBIDDEN/);
    await updateCallDocumentVisibility(manager.id, organization.id, program.id, call.id, privateDocument.id, true);
    assert.equal((await getPublicOpportunity(call.id))?.documents.length, 2);
    await updateCallDocumentVisibility(manager.id, organization.id, program.id, call.id, privateDocument.id, false);
    const application = await createPersonalApplication(participant.id, { projectId: project.id, fundingCallId: call.id });
    await setSavedOpportunity(participant.id, "INTERNAL", call.id, true); await setSavedOpportunity(participant.id, "INTERNAL", call.id, true);
    assert.equal(await db.savedFundingCall.count({ where: { userId: participant.id, fundingCallId: call.id } }), 1);
    assert.equal((await listSavedOpportunities(outsider.id)).length, 0);
    await db.innovationProfile.create({ data: { userId: participant.id, state: "SE", topics: { create: { type: "INTEREST", label: "Saúde", normalizedKey: "saude" } } } });
    assert.equal((await listPersonalOpportunities(participant.id, { q: suffix }))[0]?.relevance?.level, "HIGH");
    await db.innovationProfile.update({ where: { userId: participant.id }, data: { state: "SP", topics: { deleteMany: {} } } });
    assert.equal((await listPersonalOpportunities(participant.id, { q: suffix }))[0]?.relevance?.level, "INSUFFICIENT");
    await db.project.update({ where: { id: project.id }, data: { thematicAreas: ["saude"] } });
    assert.equal((await listPersonalOpportunities(participant.id, { q: suffix, projectId: project.id }))[0]?.relevance?.level, "COMPATIBLE");
    await assert.rejects(() => listPersonalOpportunities(outsider.id, { projectId: project.id }), /PROJECT_NOT_FOUND/);
    await db.fundingCall.update({ where: { id: call.id }, data: { status: "CLOSED" } });
    assert.equal((await listSavedOpportunities(participant.id))[0]?.opportunity?.status, "CLOSED");
    assert.equal((await listPublicOpportunities({ q: suffix })).length, 0);
    await updateFundingCallDiscovery(manager.id, organization.id, program.id, call.id, { ...metadata, publicListingEnabled: false });
    assert.equal(await getPublicOpportunity(call.id), null);
    assert.equal((await listSavedOpportunities(participant.id))[0]?.opportunity, null);
    assert.ok(await getPersonalOpportunity(participant.id, call.id));
    assert.equal(await getPersonalOpportunity(outsider.id, call.id), null);
    assert.equal((await listPersonalOpportunities(participant.id, query)).length, 0);
    await setSavedOpportunity(participant.id, "INTERNAL", call.id, false); await setSavedOpportunity(participant.id, "INTERNAL", call.id, false);
    assert.equal((await listSavedOpportunities(participant.id)).length, 0);
    const externalInput = { ...metadata, institution: `External ${suffix}`, title: `External call ${suffix}`, callNumber: "external", objective: "Original objective", territory: "Original territory", audience: "Original audience", status: "OPEN" as const, sourceUrl: "https://example.test/official", sourceCheckedAt: new Date() };
    const external = await saveExternalOpportunity(manager.id, organization.id, null, externalInput);
    await saveExternalOpportunity(manager.id, organization.id, null, { ...externalInput, publicListingEnabled: false, callNumber: "hidden-external", title: "hidden-external" });
    assert.equal((await listPublicOpportunities(query)).length, 1);
    await setSavedOpportunity(participant.id, "EXTERNAL", external.id, true); await setSavedOpportunity(participant.id, "EXTERNAL", external.id, true);
    assert.equal(await db.savedExternalOpportunity.count({ where: { userId: participant.id } }), 1);
    await saveExternalOpportunity(manager.id, organization.id, external.id, { ...externalInput, status: "CLOSED" });
    assert.equal((await listSavedOpportunities(participant.id))[0]?.opportunity?.status, "CLOSED");
    await saveExternalOpportunity(manager.id, organization.id, external.id, { ...externalInput, publicListingEnabled: false });
    assert.equal((await listSavedOpportunities(participant.id))[0]?.opportunity, null);
    await setSavedOpportunity(participant.id, "EXTERNAL", external.id, false);
    await assert.rejects(() => setSavedOpportunity(participant.id, "EXTERNAL", external.id, true), /OPPORTUNITY_UNAVAILABLE/);
    await db.application.delete({ where: { id: application.id } });
    await db.fundingCall.createMany({ data: Array.from({ length: 160 }, (_, index) => ({ organizationId: organization.id, fundingProgramId: program.id, title: `History ${suffix}`, callNumber: `history-${index}`, publicListingEnabled: true, status: "CLOSED", applicationEndsAt: new Date("2020-01-01") })) });
    await updateFundingCallDiscovery(manager.id, organization.id, program.id, call.id, metadata); await db.fundingCall.update({ where: { id: call.id }, data: { status: "OPEN" } });
    assert.ok((await listPublicOpportunities({ q: suffix })).some((entry) => entry.id === call.id), "Historical calls must not consume the actionable discovery limit");
    await db.organization.update({ where: { id: organization.id }, data: { status: "INACTIVE" } });
    assert.equal(await getPublicOpportunity(call.id), null);
  } finally {
    if (organizations.length) await db.organization.deleteMany({ where: { id: { in: organizations } } });
    if (projects.length) await db.project.deleteMany({ where: { id: { in: projects } } });
    if (users.length) await db.user.deleteMany({ where: { id: { in: users } } });
  }
});
