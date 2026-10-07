import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

test("one versus twenty image posts and distinct avatars retain bounded query fanout", async (context) => {
  if (!process.env.DATABASE_URL) { assert.notEqual(process.env.REQUIRE_DOMAIN_DATABASE, "true"); context.skip("Disposable PostgreSQL required"); return; }
  const client = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
  (globalThis as unknown as { prisma: PrismaClient }).prisma = client;
  const { loadPosts } = await import("@/lib/social/read-model");
  const suffix = randomUUID().slice(0, 8);
  const userIds = Array.from({ length: 20 }, (_, index) => `media-query-${index}-${suffix}`);
  const postIds = userIds.map((id) => `post-${id}`);
  const derivative = (id: string) => Object.fromEntries(["small", "medium", "large"].map((variant) => [variant, { key: `media/${id}/${variant}.webp`, width: 20, height: 20, sizeBytes: 100 }]));
  let queries = 0; client.$on("query", () => { queries++; });
  try {
    await client.user.createMany({ data: userIds.map((id) => ({ id, email: `${id}@example.test`, passwordHash: "private-marker" })) });
    await client.userProfile.createMany({ data: userIds.map((userId) => ({ userId, fullName: "Pesquisa" })) });
    await client.mediaAsset.createMany({ data: userIds.flatMap((ownerUserId) => ["PROFILE_AVATAR", "POST_IMAGE"].map((kind) => {
      const id = `${kind}-${ownerUserId}`;
      return { id, ownerUserId, kind: kind as "PROFILE_AVATAR" | "POST_IMAGE", storageKey: `media/${id}/large.webp`, status: "READY" as const, width: 20, height: 20, sizeBytes: 300, derivatives: derivative(id) };
    })) });
    await client.innovationProfile.createMany({ data: userIds.map((userId) => ({ userId, handle: userId, headline: "Research", profileVisibility: "PUBLIC", publishedAt: new Date(), avatarMediaId: `PROFILE_AVATAR-${userId}` })) });
    await client.socialPost.createMany({ data: userIds.map((authorUserId, index) => ({ id: postIds[index], authorUserId, createdByUserId: authorUserId, visibility: "PUBLIC", body: "Evidence" })) });
    await client.socialPostMedia.createMany({ data: userIds.map((id, index) => ({ postId: postIds[index], mediaId: `POST_IMAGE-${id}`, position: 0 })) });
    queries = 0; const one = await loadPosts({ id: postIds[0] }, undefined, { take: 1 }); const oneCount = queries;
    queries = 0; const twenty = await loadPosts({ id: { in: postIds } }, undefined, { take: 20 }); const twentyCount = queries;
    assert.equal(one.length, 1); assert.equal(twenty.length, 20);
    assert.ok(twenty.every((post) => post.media.length === 1 && post.author.avatarMedia));
    assert.ok(twentyCount <= oneCount + 2, `1 post: ${oneCount}; 20 posts: ${twentyCount}`);
    assert.ok(twentyCount <= 16);
    assert.doesNotMatch(JSON.stringify(twenty), /storageKey|derivatives|ownerUserId|private-marker|@example\.test/);
    context.diagnostic(`Media read-model queries: 1 post=${oneCount}, 20 distinct authors/posts=${twentyCount}`);
  } finally {
    await client.socialPost.deleteMany({ where: { id: { in: postIds } } });
    await client.innovationProfile.updateMany({ where: { userId: { in: userIds } }, data: { avatarMediaId: null } });
    await client.mediaAsset.deleteMany({ where: { ownerUserId: { in: userIds } } });
    await client.user.deleteMany({ where: { id: { in: userIds } } });
    await client.$disconnect();
  }
});
