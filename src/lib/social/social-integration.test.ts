import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import { db } from "@/lib/db";
import { blockUser, unblockUser } from "@/lib/network/blocks";
import { disconnectConnection, respondConnectionRequest, sendConnectionRequest } from "@/lib/network/connections";
import { followUser, unfollowUser, updateFollowSettings } from "@/lib/social/follows";
import { createPost, deletePost, featurePost, savePost, updatePost } from "@/lib/social/posts";
import { createComment, deleteComment, hideComment, updateComment } from "@/lib/social/comments";
import { reactToComment, reactToPost } from "@/lib/social/reactions";
import { repostPost } from "@/lib/social/reposts";
import { reportSocialContent } from "@/lib/social/moderation";
import { getComments, getFeaturedPosts, getPost, getReactionList, getSavedPosts, getSocialProfileSummary } from "@/lib/social/read-model";
import { getActivity } from "@/lib/social/activity";
import { getFeed } from "@/lib/social/feed";
import { listNotifications } from "@/lib/notifications/service";

const databaseAvailable = Boolean(process.env.DATABASE_URL);
if (process.env.REQUIRE_DOMAIN_DATABASE === "true" && !databaseAvailable) throw new Error("A disposable PostgreSQL database is required");
after(async () => { await db.$disconnect(); });

async function fixture() {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const users = await Promise.all(["author", "follower", "connection", "stranger", "blocked"].map((label) => db.user.create({ data: {
    email: `social-${label}-${suffix}@example.test`, passwordHash: "private-marker", profile: { create: { fullName: `Social ${label}`, phone: "private-marker" } },
    innovationProfile: { create: { handle: `social-${label}-${suffix}`, headline: "Innovation research", bio: "private-marker", profileVisibility: "PUBLIC", publishedAt: new Date(), directoryEnabled: true, collaborationStatus: "OPEN" } },
  } })));
  const [author, follower, connection, stranger, blocked] = users;
  const ids = users.map((user) => user.id);
  const connect = async (a = author.id, b = connection.id) => {
    const request = await sendConnectionRequest(a, { recipientUserId: b });
    const acceptance = await Promise.allSettled([respondConnectionRequest(b, request.id, { action: "accept" }), respondConnectionRequest(b, request.id, { action: "accept" })]);
    assert.equal(acceptance.filter((result) => result.status === "fulfilled").length, 1);
    return db.networkConnection.findUniqueOrThrow({ where: { sourceRequestId: request.id } });
  };
  return { author, follower, connection, stranger, blocked, ids, connect, async cleanup() {
    await db.safetyReport.deleteMany({ where: { reporterUserId: { in: ids } } });
    await db.notification.deleteMany({ where: { OR: [{ recipientUserId: { in: ids } }, { actorUserId: { in: ids } }] } });
    await db.socialPost.deleteMany({ where: { authorUserId: { in: ids }, repostOfPostId: { not: null } } });
    await db.socialPost.deleteMany({ where: { authorUserId: { in: ids } } });
    await db.userBlock.deleteMany({ where: { OR: [{ blockerUserId: { in: ids } }, { blockedUserId: { in: ids } }] } });
    await db.networkConnection.deleteMany({ where: { OR: [{ userAId: { in: ids } }, { userBId: { in: ids } }] } });
    await db.connectionRequest.deleteMany({ where: { requesterUserId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  } };
}

test("follow periods are independent from connections and preserve policy, block and concurrency rules", { skip: !databaseAvailable }, async () => {
  const f = await fixture();
  try {
    await assert.rejects(() => followUser(f.author.id, f.author.id));
    await Promise.allSettled(Array.from({ length: 6 }, () => followUser(f.follower.id, f.author.id)));
    const first = await db.userFollow.findFirstOrThrow({ where: { followerUserId: f.follower.id, followedUserId: f.author.id, endedAt: null } });
    assert.equal(await db.userFollow.count({ where: { followerUserId: f.follower.id, followedUserId: f.author.id, endedAt: null } }), 1);
    assert.equal(await db.networkConnection.count({ where: { OR: [{ userAId: f.follower.id }, { userBId: f.follower.id }] } }), 0);
    assert.equal(await db.notification.count({ where: { recipientUserId: f.author.id, actorUserId: f.follower.id, kind: "NEW_FOLLOWER" } }), 1);
    await unfollowUser(f.follower.id, f.author.id);
    const ended = await db.userFollow.findUniqueOrThrow({ where: { id: first.id } }); assert.ok(ended.endedAt);
    await followUser(f.follower.id, f.author.id);
    assert.equal(await db.userFollow.count({ where: { followerUserId: f.follower.id, followedUserId: f.author.id } }), 2);
    assert.deepEqual(await db.userFollow.findUniqueOrThrow({ where: { id: first.id } }), ended);
    const connection = await f.connect();
    assert.equal(await db.userFollow.count({ where: { endedAt: null, OR: [{ followerUserId: f.author.id, followedUserId: f.connection.id }, { followerUserId: f.connection.id, followedUserId: f.author.id }] } }), 2);
    assert.equal(await db.notification.count({ where: { kind: "NEW_FOLLOWER", OR: [{ recipientUserId: f.author.id, actorUserId: f.connection.id }, { recipientUserId: f.connection.id, actorUserId: f.author.id }] } }), 0);
    await unfollowUser(f.connection.id, f.author.id);
    assert.equal((await db.networkConnection.findUniqueOrThrow({ where: { id: connection.id } })).endedAt, null);
    await updateFollowSettings(f.author.id, { followPolicy: "CONNECTIONS_ONLY", primaryProfileAction: "FOLLOW" });
    assert.equal(await db.userFollow.count({ where: { followerUserId: f.follower.id, followedUserId: f.author.id, endedAt: null } }), 0);
    await assert.rejects(() => followUser(f.follower.id, f.author.id));
    await followUser(f.connection.id, f.author.id);
    await disconnectConnection(f.author.id, connection.id);
    assert.equal(await db.userFollow.count({ where: { followerUserId: f.connection.id, followedUserId: f.author.id, endedAt: null } }), 0);
    await updateFollowSettings(f.author.id, { followPolicy: "EVERYONE", primaryProfileAction: "CONNECT" });
    await followUser(f.follower.id, f.author.id); await followUser(f.author.id, f.follower.id);
    await blockUser(f.author.id, { blockedUserId: f.follower.id });
    assert.equal(await db.userFollow.count({ where: { endedAt: null, OR: [{ followerUserId: f.author.id, followedUserId: f.follower.id }, { followerUserId: f.follower.id, followedUserId: f.author.id }] } }), 0);
    await assert.rejects(() => followUser(f.follower.id, f.author.id));
    await assert.rejects(() => followUser(f.author.id, f.follower.id));
  } finally { await f.cleanup(); }
});

test("all post audiences enforce the author, anonymous, unrelated, follower, connection and blocked matrix", { skip: !databaseAvailable }, async () => {
  const f = await fixture();
  try {
    await f.connect(); await followUser(f.follower.id, f.author.id); await blockUser(f.author.id, { blockedUserId: f.blocked.id });
    for (const visibility of ["PUBLIC", "PLATFORM", "CONNECTIONS"] as const) {
      const post = await createPost(f.author.id, { body: `${visibility} evidence`, visibility });
      const viewers = [f.author.id, undefined, f.stranger.id, f.follower.id, f.connection.id, f.blocked.id];
      const expected = visibility === "PUBLIC" ? [true, true, true, true, true, false] : visibility === "PLATFORM" ? [true, false, true, true, true, false] : [true, false, false, false, true, false];
      for (let i = 0; i < viewers.length; i++) {
        const dto = await getPost(post.id, viewers[i]);
        assert.equal(Boolean(dto), expected[i], `${visibility} viewer ${i}`);
        if (dto) assert.doesNotMatch(JSON.stringify(dto), /private-marker|@example\.test|passwordHash|phone/);
      }
    }
    const publicPost = await createPost(f.author.id, { body: "Withdrawn public identity", visibility: "PUBLIC" });
    await db.innovationProfile.update({ where: { userId: f.author.id }, data: { publishedAt: null } });
    assert.equal(await getPost(publicPost.id), null);
    assert.ok(await getPost(publicPost.id, f.stranger.id));
    assert.equal((await getActivity(f.author.id)).items.length, 0);
    await assert.rejects(() => createPost(f.author.id, { body: "Cannot publish", visibility: "PUBLIC" }));
  } finally { await f.cleanup(); }
});

test("post lifecycle keeps stable IDs, validates HTTPS and protects ownership, saves and featured content", { skip: !databaseAvailable }, async () => {
  const f = await fixture();
  try {
    for (const externalUrl of ["http://example.test", "javascript:alert(1)", "https://user:password@example.test", "file:///tmp/test"]) await assert.rejects(() => createPost(f.author.id, { externalUrl }));
    await assert.rejects(() => createPost(f.author.id, { body: "x".repeat(3001) }));
    await assert.rejects(() => createPost(f.author.id, { body: "   " }));
    const post = await createPost(f.author.id, { body: "Original", externalUrl: "https://example.test/research", visibility: "PUBLIC" });
    await assert.rejects(() => updatePost(f.stranger.id, post.id, { body: "Forged edit" }));
    await assert.rejects(() => deletePost(f.stranger.id, post.id));
    await assert.rejects(() => updatePost(f.author.id, post.id, { visibility: "PLATFORM" }));
    await updatePost(f.author.id, post.id, { body: "Edited" });
    await db.innovationProfile.update({ where: { userId: f.author.id }, data: { handle: `changed-${randomUUID().slice(0, 8)}` } });
    assert.equal((await getPost(post.id))?.body, "Edited"); assert.ok((await getPost(post.id))?.editedAt);
    assert.equal((await getPost(post.id))?.externalUrl, "https://example.test/research");
    await savePost(f.stranger.id, post.id, true); await savePost(f.stranger.id, post.id, true);
    assert.equal((await getSavedPosts(f.stranger.id)).items.length, 1); assert.equal((await getSavedPosts(f.author.id)).items.length, 0);
    assert.equal((await getPost(post.id, f.author.id))?.saved, false);
    await savePost(f.stranger.id, post.id, false); assert.equal((await getSavedPosts(f.stranger.id)).items.length, 0);
    await assert.rejects(() => featurePost(f.stranger.id, post.id, true));
    await featurePost(f.author.id, post.id, true); assert.equal((await getFeaturedPosts(f.author.id)).length, 1);
    await savePost(f.stranger.id, post.id, true);
    await deletePost(f.author.id, post.id);
    assert.ok((await db.socialPost.findUniqueOrThrow({ where: { id: post.id } })).deletedAt);
    assert.equal(await getPost(post.id, f.author.id), null); assert.equal(await getPost(post.id), null);
    assert.equal((await getSavedPosts(f.stranger.id)).items.length, 0); assert.equal((await getFeaturedPosts(f.author.id)).length, 0);
    await assert.rejects(() => reactToPost(f.stranger.id, post.id, "LIKE"));
    await assert.rejects(() => createComment(f.stranger.id, post.id, { body: "Deleted target" }));
  } finally { await f.cleanup(); }
});

test("post and comment reactions are desired-state idempotent under concurrent retries with safe notifications", { skip: !databaseAvailable }, async () => {
  const f = await fixture();
  try {
    const post = await createPost(f.author.id, { body: "Reaction evidence", visibility: "PUBLIC" });
    await Promise.all(Array.from({ length: 5 }, () => reactToPost(f.follower.id, post.id, "LIKE")));
    assert.equal(await db.postReaction.count({ where: { postId: post.id, userId: f.follower.id } }), 1);
    await reactToPost(f.follower.id, post.id, "INSIGHTFUL");
    assert.equal((await getPost(post.id, f.follower.id))?.viewerReaction, "INSIGHTFUL");
    assert.equal(await db.notification.count({ where: { recipientUserId: f.author.id, actorUserId: f.follower.id, kind: "POST_REACTION" } }), 1);
    await reactToPost(f.author.id, post.id, "LOVE");
    assert.equal(await db.notification.count({ where: { recipientUserId: f.author.id, actorUserId: f.author.id } }), 0);
    const comment = await createComment(f.follower.id, post.id, { body: "A comment" });
    await Promise.all(Array.from({ length: 5 }, () => reactToComment(f.stranger.id, comment.id, "SUPPORT")));
    assert.equal(await db.commentReaction.count({ where: { commentId: comment.id, userId: f.stranger.id } }), 1);
    await reactToComment(f.stranger.id, comment.id, "CELEBRATE");
    assert.equal((await db.commentReaction.findUniqueOrThrow({ where: { commentId_userId: { commentId: comment.id, userId: f.stranger.id } } })).type, "CELEBRATE");
    await reactToComment(f.stranger.id, comment.id, null); await reactToPost(f.follower.id, post.id, null);
    assert.equal(await db.commentReaction.count({ where: { commentId: comment.id } }), 0);
    await db.innovationProfile.update({ where: { userId: f.author.id }, data: { profileVisibility: "PRIVATE", publishedAt: null } });
    await db.innovationProfile.update({ where: { userId: f.follower.id }, data: { profileVisibility: "PRIVATE", publishedAt: null } });
    assert.equal((await getReactionList(post.id, f.stranger.id)).items[0].handle, null);
  } finally { await f.cleanup(); }
});

test("comments limit depth, preserve tombstones, enforce post policy and reject forged parents and authors", { skip: !databaseAvailable }, async () => {
  const f = await fixture();
  try {
    await f.connect();
    const post = await createPost(f.author.id, { body: "Comment evidence", visibility: "PUBLIC" });
    const other = await createPost(f.author.id, { body: "Other discussion" });
    const top = await createComment(f.follower.id, post.id, { body: "First comment" });
    const reply = await createComment(f.author.id, post.id, { body: "Author reply", parentCommentId: top.id });
    await assert.rejects(() => createComment(f.stranger.id, other.id, { body: "Foreign parent", parentCommentId: top.id }));
    const flattened = await createComment(f.stranger.id, post.id, { body: "Reply to reply", parentCommentId: reply.id });
    assert.equal((await db.postComment.findUniqueOrThrow({ where: { id: flattened.id } })).parentCommentId, top.id);
    await assert.rejects(() => updateComment(f.stranger.id, top.id, { body: "Forged" }));
    await assert.rejects(() => deleteComment(f.stranger.id, top.id));
    await assert.rejects(() => hideComment(f.stranger.id, top.id));
    await updateComment(f.follower.id, top.id, { body: "Edited comment" });
    assert.equal((await getComments(post.id, f.author.id)).items[0].body, "Edited comment");
    await deleteComment(f.follower.id, top.id);
    assert.equal((await getComments(post.id, f.author.id)).items[0].body, null);
    assert.equal((await getComments(post.id, f.author.id, { parentCommentId: top.id })).items[0].body, "Author reply");
    const hidden = await createComment(f.follower.id, post.id, { body: "Hide this body" });
    await hideComment(f.author.id, hidden.id);
    assert.equal((await getComments(post.id, f.follower.id)).items.find((entry) => entry.id === hidden.id)?.body, null);
    await assert.rejects(() => reactToComment(f.stranger.id, hidden.id, "LIKE"));
    const off = await createPost(f.author.id, { body: "Read only", commentPolicy: "OFF" });
    await assert.rejects(() => createComment(f.author.id, off.id, { body: "Not even owner" }));
    const only = await createPost(f.author.id, { body: "Connected discussion", commentPolicy: "CONNECTIONS_ONLY" });
    await assert.rejects(() => createComment(f.follower.id, only.id, { body: "Not connected" }));
    await createComment(f.connection.id, only.id, { body: "Connected" });
    await blockUser(f.author.id, { blockedUserId: f.follower.id });
    await assert.rejects(() => createComment(f.follower.id, post.id, { body: "Blocked" }));
    assert.equal((await getComments(post.id, f.author.id)).items.some((entry) => entry.author.userId === f.follower.id), false);
    assert.equal(await db.notification.count({ where: { recipientUserId: f.follower.id, actorUserId: f.author.id, kind: "COMMENT_REPLY" } }), 1);
  } finally { await f.cleanup(); }
});

test("reposts flatten references, enforce audience ceilings and preserve unavailable original placeholders", { skip: !databaseAvailable }, async () => {
  const f = await fixture();
  try {
    await f.connect();
    const original = await createPost(f.author.id, { body: "Public original", visibility: "PUBLIC" });
    const copies = await Promise.allSettled(Array.from({ length: 4 }, () => repostPost(f.follower.id, original.id, {})));
    assert.ok(copies.some((result) => result.status === "fulfilled"));
    assert.equal(await db.socialPost.count({ where: { authorUserId: f.follower.id, repostOfPostId: original.id, deletedAt: null } }), 1);
    const repost = await db.socialPost.findFirstOrThrow({ where: { authorUserId: f.follower.id, repostOfPostId: original.id, deletedAt: null } });
    const next = await repostPost(f.stranger.id, repost.id, { body: "My comment" });
    assert.equal((await db.socialPost.findUniqueOrThrow({ where: { id: next.id } })).repostOfPostId, original.id);
    const platform = await createPost(f.author.id, { body: "Platform original", visibility: "PLATFORM" });
    await assert.rejects(() => repostPost(f.follower.id, platform.id, { visibility: "PUBLIC" }));
    await repostPost(f.follower.id, platform.id, { visibility: "PLATFORM" });
    const connections = await createPost(f.author.id, { body: "Private circle", visibility: "CONNECTIONS" });
    await assert.rejects(() => repostPost(f.connection.id, connections.id, {}));
    const disabled = await createPost(f.author.id, { body: "No repost", allowReposts: false });
    await assert.rejects(() => repostPost(f.follower.id, disabled.id, {}));
    await deletePost(f.author.id, original.id);
    assert.equal((await getPost(repost.id, f.stranger.id))?.original, null);
    await assert.rejects(() => repostPost(f.blocked.id, repost.id, {}));
    assert.equal(await db.notification.count({ where: { recipientUserId: f.author.id, actorUserId: f.follower.id, kind: "POST_REPOST" } }), 2);
  } finally { await f.cleanup(); }
});

test("blocking withdraws feeds, saved access, notifications and interaction while safety rejects foreign targets", { skip: !databaseAvailable }, async () => {
  const f = await fixture();
  try {
    const post = await createPost(f.author.id, { body: "Accessible before block", visibility: "PUBLIC" });
    await followUser(f.follower.id, f.author.id); await savePost(f.follower.id, post.id, true);
    const comment = await createComment(f.author.id, post.id, { body: "Safety reference" });
    const postReport = await reportSocialContent(f.follower.id, { postId: post.id, reason: "SPAM" });
    const commentReport = await reportSocialContent(f.follower.id, { commentId: comment.id, reason: "OTHER", details: "Review requested" });
    assert.ok(postReport.id && commentReport.id);
    await assert.rejects(() => reportSocialContent(f.follower.id, { postId: "forged-post", reason: "SPAM" }));
    await assert.rejects(() => reportSocialContent(f.follower.id, { commentId: "forged-comment", reason: "SPAM" }));
    const other = await createPost(f.stranger.id, { body: "Unrelated post" });
    await assert.rejects(() => reportSocialContent(f.follower.id, { postId: other.id, commentId: comment.id, reason: "SPAM" }));
    assert.equal((await getFeed(f.follower.id)).items.some((entry) => entry.id === post.id), true);
    await blockUser(f.author.id, { blockedUserId: f.follower.id });
    assert.equal((await getFeed(f.follower.id)).items.some((entry) => entry.id === post.id), false);
    assert.equal((await getSavedPosts(f.follower.id)).items.length, 0);
    await assert.rejects(() => reactToPost(f.follower.id, post.id, "LIKE"));
    await assert.rejects(() => reactToComment(f.follower.id, comment.id, "LIKE"));
    await assert.rejects(() => repostPost(f.follower.id, post.id, {}));
    await assert.rejects(() => getSocialProfileSummary(f.author.id, f.follower.id));
    assert.equal((await listNotifications(f.author.id)).notifications.some((entry) => entry.kind === "NEW_FOLLOWER"), false);
    await unblockUser(f.author.id, { blockedUserId: f.follower.id });
    assert.equal((await getFeed(f.follower.id)).items.some((entry) => entry.id === post.id), false);
  } finally { await f.cleanup(); }
});

test("soft deleted content still consumes creation limits and concurrent edit/delete cannot resurrect it", { skip: !databaseAvailable }, async () => {
  const f = await fixture();
  try {
    const post = await createPost(f.author.id, { body: "Race target" });
    const comment = await createComment(f.follower.id, post.id, { body: "Race comment" });
    await Promise.allSettled([updateComment(f.follower.id, comment.id, { body: "Concurrent edit" }), deleteComment(f.follower.id, comment.id)]);
    assert.ok((await db.postComment.findUniqueOrThrow({ where: { id: comment.id } })).deletedAt);
    assert.equal((await getComments(post.id, f.author.id)).items[0].body, null);
    await Promise.allSettled([updatePost(f.author.id, post.id, { body: "Concurrent edit" }), deletePost(f.author.id, post.id)]);
    assert.equal(await getPost(post.id, f.author.id), null);
    await db.socialRateLimitEvent.createMany({ data: Array.from({ length: 19 }, () => ({ userId: f.author.id, kind: "POST" })) });
    await assert.rejects(() => createPost(f.author.id, { body: "Rate limit survives deletion" }), /RATE_LIMIT/);
  } finally { await f.cleanup(); }
});

test("deleted featured posts release their slots and public profile surfaces never expose authenticated-only content", { skip: !databaseAvailable }, async () => {
  const f = await fixture();
  try {
    const posts: Array<{ id: string }> = [];
    for (let index = 0; index < 4; index++) posts.push(await createPost(f.author.id, { body: `Featured ${index}`, visibility: index === 0 ? "PUBLIC" : "PLATFORM" }));
    for (const post of posts.slice(0, 3)) await featurePost(f.author.id, post.id, true);
    await assert.rejects(() => featurePost(f.author.id, posts[3].id, true), /FEATURED_LIMIT/);
    assert.deepEqual((await getFeaturedPosts(f.author.id, f.follower.id, true)).map((post) => post.id), [posts[0].id]);
    assert.deepEqual((await getActivity(f.author.id, f.author.id, { publicOnly: true })).items.map((post) => post.id), [posts[0].id]);
    const repost = await repostPost(f.connection.id, posts[0].id, { visibility: "PUBLIC" });
    await blockUser(f.stranger.id, { blockedUserId: f.author.id });
    const publicReposts = await getActivity(f.connection.id, f.stranger.id, { filter: "reposts", publicOnly: true });
    assert.equal(publicReposts.items[0].id, repost.id); assert.equal(publicReposts.items[0].original, null);
    assert.doesNotMatch(JSON.stringify(publicReposts), /Featured 0/);
    for (const post of posts.slice(0, 3)) await deletePost(f.author.id, post.id);
    await featurePost(f.author.id, posts[3].id, true);
    assert.deepEqual((await getFeaturedPosts(f.author.id, f.author.id)).map((post) => post.id), [posts[3].id]);
  } finally { await f.cleanup(); }
});

test("highlights snapshot prevents engagement churn from duplicating pages and rechecks subscriptions and blocks", { skip: !databaseAvailable }, async () => {
  const f = await fixture();
  try {
    await followUser(f.follower.id, f.author.id); await followUser(f.follower.id, f.connection.id);
    const stamp = randomUUID().slice(0, 8); const at = Date.now() - 60_000;
    const rows = Array.from({ length: 45 }, (_, index) => ({ id: `snapshot-${String(index).padStart(2, "0")}-${stamp}`, authorUserId: index % 2 ? f.author.id : f.connection.id, createdByUserId: index % 2 ? f.author.id : f.connection.id, body: `Snapshot ${index}`, visibility: "PLATFORM" as const, createdAt: new Date(at + index * 1000) }));
    await db.socialPost.createMany({ data: rows });
    const comment = await db.postComment.create({ data: { postId: rows[44].id, authorUserId: f.stranger.id, body: "A changing contribution" } });
    const first = await getFeed(f.follower.id, { mode: "HIGHLIGHTS" }); assert.ok(first.nextCursor);
    await db.postReaction.create({ data: { postId: rows[0].id, userId: f.stranger.id, type: "LIKE" } });
    await hideComment(f.connection.id, comment.id);
    const seen = first.items.map((post) => post.id); let cursor: string | null = first.nextCursor;
    while (cursor) { const next = await getFeed(f.follower.id, { mode: "HIGHLIGHTS", cursor }); seen.push(...next.items.map((post) => post.id)); cursor = next.nextCursor; }
    assert.equal(seen.length, 45); assert.equal(new Set(seen).size, 45); assert.deepEqual(new Set(seen), new Set(rows.map((row) => row.id)));
    assert.equal((await getFeed(f.stranger.id, { mode: "HIGHLIGHTS", cursor: first.nextCursor })).items.length, 0, "Cursor must be viewer-bound");
    const strangerPost = await createPost(f.stranger.id, { body: "Not followed", visibility: "PUBLIC" });
    const forged = Buffer.from(JSON.stringify({ at: new Date().toISOString(), ids: [strangerPost.id] })).toString("base64url");
    assert.equal((await getFeed(f.follower.id, { mode: "HIGHLIGHTS", cursor: forged })).items.some((post) => post.id === strangerPost.id), false);
    const beforeUnfollow = await getFeed(f.follower.id, { mode: "HIGHLIGHTS" }); assert.ok(beforeUnfollow.nextCursor);
    await unfollowUser(f.follower.id, f.author.id);
    const afterUnfollow = await getFeed(f.follower.id, { mode: "HIGHLIGHTS", cursor: beforeUnfollow.nextCursor });
    assert.equal(afterUnfollow.items.some((post) => post.author.userId === f.author.id), false);
    await blockUser(f.follower.id, { blockedUserId: f.connection.id });
    assert.equal((await getFeed(f.follower.id, { mode: "HIGHLIGHTS", cursor: beforeUnfollow.nextCursor })).items.length, 0);
  } finally { await f.cleanup(); }
});
