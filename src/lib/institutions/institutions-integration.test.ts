import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import { db } from "@/lib/db";
import { createInstitutionPost, deleteInstitutionPost, updateInstitutionPost } from "@/lib/institutions/posts";
import { followOrganization, getPublicInstitution, getPublicProgram, listFollowedInstitutions, listPublicInstitutions, setOrganizationPublication, setOrganizationProfileMedia, setProgramPublication, unfollowOrganization, updateOrganizationProfile } from "@/lib/institutions/service";
import { authorizeMedia } from "@/lib/media/service";
import { getFeed } from "@/lib/social/feed";
import { getPost } from "@/lib/social/read-model";
import { createComment, hideComment } from "@/lib/social/comments";
import { reactToPost } from "@/lib/social/reactions";
import { reportSocialContent } from "@/lib/social/moderation";

const databaseAvailable = Boolean(process.env.DATABASE_URL);
if (process.env.REQUIRE_DOMAIN_DATABASE === "true" && !databaseAvailable) throw new Error("A disposable PostgreSQL database is required");
after(async () => { await db.$disconnect(); });

async function fixture() {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const users = await Promise.all(["manager", "follower", "viewer", "outsider"].map((label) => db.user.create({ data: {
    email: `institution-${label}-${suffix}@example.test`, passwordHash: "private-marker", profile: { create: { fullName: `Institution ${label}` } },
  } })));
  const [manager, follower, viewer, outsider] = users;
  const orgs = await Promise.all(["primary", "foreign"].map((label) => db.organization.create({ data: { name: `Institution ${label} ${suffix}`, slug: `institution-${label}-${suffix}` } })));
  const [organization, foreignOrganization] = orgs;
  await db.organizationMembership.createMany({ data: [
    { organizationId: organization.id, userId: manager.id, role: "ADMIN", status: "ACTIVE" },
    { organizationId: organization.id, userId: viewer.id, role: "VIEWER", status: "ACTIVE" },
  ] });
  const programs = await Promise.all([organization, foreignOrganization].map((org, index) => db.fundingProgram.create({ data: {
    id: `institution-program-${index}-${suffix}`, organizationId: org.id, name: `Program ${index} ${suffix}`, slug: `program-${index}-${suffix}`, status: "ACTIVE", createdByUserId: manager.id,
  } })));
  const [program, foreignProgram] = programs;
  const report = await db.analyticsReportSnapshot.create({ data: {
    organizationId: organization.id, type: "PROGRAM_SUMMARY", title: `Aggregate report ${suffix}`, fundingProgramId: program.id,
    parameters: {}, payload: {}, sourceDigest: "a".repeat(64), generatedByUserId: manager.id, dataAsOf: new Date(),
  } });
  const resultSlug = `institution-results-${suffix}`;
  await db.publicResultPublication.create({ data: {
    organizationId: organization.id, reportSnapshotId: report.id, slug: resultSlug, title: "Resultados agregados publicados",
    summary: "Síntese pública do programa.", publicPayload: { version: 1, sections: [] }, publicPayloadDigest: "b".repeat(64),
    createdByUserId: manager.id, publishedByUserId: manager.id, publishedAt: new Date(),
  } });
  await db.publicResultPublication.create({ data: {
    organizationId: organization.id, reportSnapshotId: report.id, slug: `${resultSlug}-draft`, title: "Resultado ainda não publicado",
    publicPayload: { version: 1, sections: [] }, publicPayloadDigest: "c".repeat(64), createdByUserId: manager.id,
  } });
  return { suffix, manager, follower, viewer, outsider, organization, foreignOrganization, program, foreignProgram, async cleanup() {
    const organizationIds = [organization.id, foreignOrganization.id]; const userIds = users.map((user) => user.id);
    if (await db.organizationPostRevision.count({ where: { organizationId: { in: organizationIds } } }) || await db.publicResultPublication.count({ where: { organizationId: { in: organizationIds } } })) return;
    await db.safetyReport.deleteMany({ where: { OR: [{ reporterUserId: { in: userIds } }, { reportedOrganizationId: { in: organizationIds } }] } });
    await db.socialPost.deleteMany({ where: { authorOrganizationId: { in: organizationIds } } });
    await db.organizationFollow.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await db.organizationProfile.updateMany({ where: { organizationId: { in: organizationIds } }, data: { logoMediaId: null, coverMediaId: null } });
    await db.mediaAsset.deleteMany({ where: { ownerOrganizationId: { in: organizationIds } } });
    await db.organizationProfile.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await db.fundingCall.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await db.fundingProgram.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await db.socialRateLimitEvent.deleteMany({ where: { userId: { in: userIds } } });
    await db.organization.deleteMany({ where: { id: { in: organizationIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
  } };
}

test("institution pages, follow history, public programs, official authorship, moderation and revocation respect tenant boundaries", { skip: !databaseAvailable }, async () => {
  const f = await fixture();
  try {
    await db.organizationProfile.create({ data: { organizationId: f.organization.id, headline: "Apoio à inovação", description: "Descrição pública inicial", focusAreas: ["Tecnologia"] } });
    const makeMedia = async (id: string, organizationId: string, kind: "ORGANIZATION_LOGO" | "POST_IMAGE") => db.mediaAsset.create({ data: {
      id, ownerOrganizationId: organizationId, kind, storageKey: `media/${id}/large.webp`, status: "READY", width: 300, height: 200, sizeBytes: 300,
      derivatives: { small: { key: `media/${id}/small.webp`, width: 100, height: 67, sizeBytes: 100 }, medium: { key: `media/${id}/medium.webp`, width: 200, height: 133, sizeBytes: 100 }, large: { key: `media/${id}/large.webp`, width: 300, height: 200, sizeBytes: 100 } },
    } });
    const logoId = `institution-logo-${f.suffix}`; const foreignLogoId = `foreign-logo-${f.suffix}`; const postImageId = `institution-post-image-${f.suffix}`;
    await makeMedia(logoId, f.organization.id, "ORGANIZATION_LOGO"); await makeMedia(foreignLogoId, f.foreignOrganization.id, "ORGANIZATION_LOGO"); await makeMedia(postImageId, f.organization.id, "POST_IMAGE");
    await assert.rejects(() => setOrganizationProfileMedia(f.organization.id, f.manager.id, { kind: "ORGANIZATION_LOGO", mediaId: foreignLogoId }));
    await setOrganizationProfileMedia(f.organization.id, f.manager.id, { kind: "ORGANIZATION_LOGO", mediaId: logoId });
    await assert.rejects(() => authorizeMedia(logoId));
    assert.equal((await authorizeMedia(logoId, f.viewer.id)).id, logoId);
    assert.equal(await getPublicInstitution(f.organization.slug), null);
    assert.equal((await listPublicInstitutions(null)).items.some((item) => item.id === f.organization.id), false);
    await assert.rejects(() => followOrganization(f.follower.id, f.organization.id));
    await assert.rejects(() => setOrganizationPublication(f.organization.id, f.viewer.id, true));
    await assert.rejects(() => updateOrganizationProfile(f.organization.id, f.outsider.id, { headline: "Tentativa externa" }));

    await setOrganizationPublication(f.organization.id, f.manager.id, true);
    await setProgramPublication(f.organization.id, f.program.id, f.manager.id, true);
    const publicProgram = await getPublicProgram(f.organization.slug, f.program.slug);
    assert.equal(publicProgram?.program.id, f.program.id);
    assert.deepEqual(publicProgram?.results.map((result) => result.slug), [`institution-results-${f.suffix}`]);
    assert.equal(await getPublicProgram(f.organization.slug, f.foreignProgram.slug), null);
    await db.fundingCall.create({ data: { organizationId: f.organization.id, fundingProgramId: f.program.id, title: "Chamada pública", callNumber: "PUB-1", status: "OPEN", publicListingEnabled: true } });
    await db.fundingCall.create({ data: { organizationId: f.organization.id, fundingProgramId: f.program.id, title: "Chamada interna", callNumber: "INT-1", status: "OPEN", publicListingEnabled: false } });

    const concurrentFollows = await Promise.allSettled(Array.from({ length: 5 }, () => followOrganization(f.follower.id, f.organization.id)));
    assert.equal(concurrentFollows.filter((result) => result.status === "fulfilled").length, 5);
    assert.equal(await db.organizationFollow.count({ where: { organizationId: f.organization.id, followerUserId: f.follower.id, endedAt: null } }), 1);
    assert.equal((await listFollowedInstitutions(f.follower.id)).items.length, 1);
    const listed = await listPublicInstitutions(f.follower.id);
    assert.equal(listed.items.find((item) => item.id === f.organization.id)?.following, true);

    await assert.rejects(() => createInstitutionPost(f.outsider.id, f.organization.id, { body: "Unauthorized post", visibility: "PUBLIC" }));
    await assert.rejects(() => createInstitutionPost(f.manager.id, f.organization.id, { body: "Wrong tenant program", visibility: "PLATFORM", fundingProgramId: f.foreignProgram.id }));
    const post = await createInstitutionPost(f.manager.id, f.organization.id, { body: "Atualização oficial", visibility: "PUBLIC", fundingProgramId: f.program.id, media: [{ mediaId: postImageId, altText: "Imagem da atualização" }] });
    assert.equal(post.author.kind, "ORGANIZATION");
    const stored = await db.socialPost.findUniqueOrThrow({ where: { id: post.id }, select: { authorUserId: true, authorOrganizationId: true, createdByUserId: true, revision: true } });
    assert.deepEqual(stored, { authorUserId: null, authorOrganizationId: f.organization.id, createdByUserId: f.manager.id, revision: 1 });
    assert.equal(await db.organizationPostRevision.count({ where: { postId: post.id, action: "CREATE", changedByUserId: f.manager.id } }), 1);
    const institution = await getPublicInstitution(f.organization.slug, f.follower.id);
    assert.deepEqual(institution?.calls.map((call) => call.title), ["Chamada pública"]);
    assert.deepEqual(institution?.results.map((result) => result.slug), [`institution-results-${f.suffix}`]);
    assert.equal(institution?.posts.some((item) => item.id === post.id), true);
    assert.equal((await getFeed(f.follower.id, { mode: "RECENT" })).items.some((item) => item.id === post.id), true);
    assert.equal((await getPost(post.id))?.author.kind, "ORGANIZATION");

    const report = await reportSocialContent(f.follower.id, { postId: post.id, reason: "OTHER" });
    const savedReport = await db.safetyReport.findUniqueOrThrow({ where: { id: report.id }, select: { reportedUserId: true, reportedOrganizationId: true } });
    assert.deepEqual(savedReport, { reportedUserId: null, reportedOrganizationId: f.organization.id });
    await reactToPost(f.follower.id, post.id, "INSIGHTFUL");
    const comment = await createComment(f.follower.id, post.id, { body: "Comentário de participante" });
    await hideComment(f.manager.id, comment.id);
    assert.ok((await db.postComment.findUniqueOrThrow({ where: { id: comment.id }, select: { hiddenByUserId: true } })).hiddenByUserId === f.manager.id);

    const staleEdit = { body: "Primeira edição", visibility: "PUBLIC", commentPolicy: "EVERYONE", allowReposts: true, media: [{ mediaId: postImageId, altText: "Imagem da atualização" }], fundingProgramId: f.program.id, revision: 1 };
    const edits = await Promise.allSettled([
      updateInstitutionPost(f.manager.id, f.organization.id, post.id, staleEdit),
      updateInstitutionPost(f.manager.id, f.organization.id, post.id, { ...staleEdit, body: "Edição concorrente" }),
    ]);
    assert.equal(edits.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(await db.organizationPostRevision.count({ where: { postId: post.id } }), 2);
    await assert.rejects(() => updateInstitutionPost(f.outsider.id, f.organization.id, post.id, { ...staleEdit, revision: 2 }));

    await unfollowOrganization(f.follower.id, f.organization.id);
    await followOrganization(f.follower.id, f.organization.id);
    assert.equal(await db.organizationFollow.count({ where: { organizationId: f.organization.id, followerUserId: f.follower.id } }), 2);
    await setOrganizationPublication(f.organization.id, f.manager.id, false);
    assert.equal(await getPublicInstitution(f.organization.slug), null);
    assert.equal(await getPublicInstitution(f.organization.slug, f.viewer.id, true) !== null, true);
    assert.equal(await getPublicInstitution(f.organization.slug, f.outsider.id, true), null);
    await assert.rejects(() => followOrganization(f.outsider.id, f.organization.id));
    assert.equal((await getFeed(f.follower.id, { mode: "RECENT" })).items.some((item) => item.id === post.id), false);
    assert.equal(await getPost(post.id), null);
    await assert.rejects(() => authorizeMedia(logoId));
    assert.equal((await authorizeMedia(logoId, f.viewer.id)).id, logoId);
    assert.equal((await authorizeMedia(postImageId, f.viewer.id)).id, postImageId);
    await assert.rejects(() => authorizeMedia(postImageId));
    await setOrganizationPublication(f.organization.id, f.manager.id, true);
    assert.equal((await getFeed(f.follower.id, { mode: "RECENT" })).items.some((item) => item.id === post.id), true);
    await deleteInstitutionPost(f.manager.id, f.organization.id, post.id);
    assert.equal(await db.organizationPostRevision.count({ where: { postId: post.id, action: "DELETE", revision: 3 } }), 1);
    assert.equal(await getPost(post.id), null);
    await assert.rejects(() => authorizeMedia(postImageId));

    await db.organizationMembership.update({ where: { organizationId_userId: { organizationId: f.organization.id, userId: f.manager.id } }, data: { status: "DISABLED" } });
    await assert.rejects(() => updateOrganizationProfile(f.organization.id, f.manager.id, { headline: "Após revogação" }));
    await assert.rejects(() => updateInstitutionPost(f.manager.id, f.organization.id, post.id, { ...staleEdit, revision: 2 }));
  } finally { await f.cleanup(); }
});
