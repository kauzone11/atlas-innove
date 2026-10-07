import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";

test("one hundred people and five hundred posts preserve ranked pagination, privacy and bounded database work", async (context) => {
  if (!process.env.DATABASE_URL) { assert.notEqual(process.env.REQUIRE_DOMAIN_DATABASE, "true"); context.skip("Disposable PostgreSQL required"); return; }
  const client = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
  (globalThis as unknown as { prisma: PrismaClient }).prisma = client;
  const { getFeed } = await import("@/lib/social/feed");
  const { getActivity } = await import("@/lib/social/activity");
  const { getComments, getReactionList, listFollows } = await import("@/lib/social/read-model");
  const suffix = randomUUID().slice(0, 8);
  const userIds = Array.from({ length: 100 }, (_, index) => `social-scale-u-${String(index).padStart(3, "0")}-${suffix}`);
  const [viewer, ...authors] = userIds;
  const postIds = Array.from({ length: 500 }, (_, index) => `social-scale-p-${String(index).padStart(3, "0")}-${suffix}`);
  const at = Date.now() - 600_000;
  let queries = 0; client.$on("query", () => { queries++; });
  const measure = async <T,>(label: string, read: () => Promise<T>, ceiling: number) => {
    queries = 0; const started = Date.now(); const result = await read();
    assert.ok(queries <= ceiling, `${label}: ${queries} queries exceeds ${ceiling}`);
    context.diagnostic(`${label}: ${queries} queries, ${Date.now() - started}ms`);
    assert.doesNotMatch(JSON.stringify(result), /secret-marker|@example\.test|passwordHash|phone/);
    return result;
  };
  try {
    await client.user.createMany({ data: userIds.map((id) => ({ id, email: `${id}@example.test`, passwordHash: "secret-marker" })) });
    await client.userProfile.createMany({ data: userIds.map((userId) => ({ userId, fullName: `Researcher ${userId}`, phone: "secret-marker" })) });
    await client.innovationProfile.createMany({ data: userIds.map((userId) => ({ userId, handle: userId, headline: "Research and development", bio: "secret-marker", profileVisibility: "PUBLIC", publishedAt: new Date(at), directoryEnabled: true })) });
    await client.userFollow.createMany({ data: authors.map((followedUserId) => ({ followerUserId: viewer, followedUserId })) });
    await client.socialPost.createMany({ data: postIds.map((id, index) => ({ id, authorUserId: authors[index % authors.length], createdByUserId: authors[index % authors.length], body: `Research update ${index}`, visibility: index === 0 ? "PLATFORM" : "PUBLIC", createdAt: new Date(at + (index >= 495 ? 499 : index) * 1000) })) });
    await client.postReaction.createMany({ data: authors.slice(0, 25).map((userId) => ({ postId: postIds[0], userId, type: "INSIGHTFUL" })) });
    await client.postComment.createMany({ data: authors.slice(0, 40).map((authorUserId, index) => ({ id: `social-scale-comment-${index}-${suffix}`, postId: postIds[0], authorUserId, body: `Thoughtful contribution ${index}`, createdAt: new Date(at + index * 1000) })) });
    const recent = await measure("recent feed", () => getFeed(viewer), 18);
    assert.deepEqual(recent.items.map((post) => post.id), postIds.slice(-20).reverse());
    assert.ok(recent.nextCursor);
    const nextRecent = await getFeed(viewer, { cursor: recent.nextCursor });
    assert.deepEqual(nextRecent.items.map((post) => post.id), postIds.slice(-40, -20).reverse());
    const ranked = await measure("highlights feed", () => getFeed(viewer, { mode: "HIGHLIGHTS" }), 22);
    assert.equal(ranked.items[0].id, postIds[0], "An older candidate beyond the first chronological page must rank first");
    assert.ok(ranked.nextCursor);
    assert.ok(ranked.nextCursor.length < 8192, `500-post cursor is ${ranked.nextCursor.length} characters`);
    const second = await getFeed(viewer, { mode: "HIGHLIGHTS", cursor: ranked.nextCursor });
    const repeated = await getFeed(viewer, { mode: "HIGHLIGHTS", cursor: ranked.nextCursor });
    assert.deepEqual(second.items.map((post) => post.id), repeated.items.map((post) => post.id));
    assert.equal(new Set([...ranked.items, ...second.items].map((post) => post.id)).size, 40);
    const tied = await getFeed(viewer);
    assert.deepEqual(tied.items.slice(0, 5).map((post) => post.id), postIds.slice(495).reverse());
    const activity = await measure("profile activity", () => getActivity(authors[0], viewer), 28);
    assert.ok(activity.items.length > 0);
    const comments = await measure("comment page", () => getComments(postIds[0], viewer), 15);
    assert.equal(comments.items.length, 15); assert.equal(comments.hasNext, true);
    const commentsNext = await getComments(postIds[0], viewer, { page: 2 });
    assert.equal(new Set([...comments.items, ...commentsNext.items].map((comment) => comment.id)).size, 30);
    const reactions = await measure("reaction page", () => getReactionList(postIds[0], viewer), 25);
    assert.equal(reactions.items.length, 20); assert.equal(reactions.hasNext, true);
    const followers = await measure("following page", () => listFollows(viewer, "following"), 10);
    assert.equal(followers.items.length, 20); assert.equal(followers.hasNext, true);
    const followedIds = new Set<string>();
    for (let page = 1; page <= 5; page++) for (const user of (await listFollows(viewer, "following", page)).items) followedIds.add(user.userId);
    assert.equal(followedIds.size, 99);
    const publicComments = await getActivity(authors[1], undefined, { filter: "comments" });
    assert.equal(publicComments.items.some((post) => post.id === postIds[0]), false);
    await client.userBlock.create({ data: { blockerUserId: viewer, blockedUserId: authors[0] } });
    assert.equal((await getFeed(viewer)).items.some((post) => post.author.userId === authors[0]), false);
    assert.equal((await getFeed(viewer, { mode: "HIGHLIGHTS" })).items.some((post) => post.author.userId === authors[0]), false);
  } finally {
    await client.userBlock.deleteMany({ where: { blockerUserId: viewer } });
    await client.socialPost.deleteMany({ where: { authorUserId: { in: userIds } } });
    await client.user.deleteMany({ where: { id: { in: userIds } } });
    await client.$disconnect();
  }
});
