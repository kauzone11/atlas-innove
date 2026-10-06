import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import sharp from "sharp";
import { db } from "@/lib/db";
import { authorizeMedia, cleanupMedia, deleteUnattachedMedia, readMedia, setProfileMedia, uploadMedia } from "@/lib/media/service";
import { createPost, deletePost, updatePost } from "@/lib/social/posts";
import { getPost } from "@/lib/social/read-model";
import { blockUser } from "@/lib/network/blocks";
import { sendConnectionRequest, respondConnectionRequest } from "@/lib/network/connections";
import { updateProfile } from "@/lib/profiles/service";
import type { ObjectStorage } from "@/lib/storage/client";

const databaseAvailable = Boolean(process.env.DATABASE_URL);
if (process.env.REQUIRE_DOMAIN_DATABASE === "true" && !databaseAvailable) throw new Error("A disposable PostgreSQL database is required");
after(async () => { await db.$disconnect(); });

class MemoryStorage implements ObjectStorage {
  objects = new Map<string, Uint8Array>(); failPut = false; failDelete = false;
  async put(key: string, bytes: Uint8Array) { if (this.failPut) throw new Error("provider-private-error"); this.objects.set(key, new Uint8Array(bytes)); }
  async get(key: string) { return this.objects.get(key) ?? null; }
  async delete(key: string) { if (this.failDelete) throw new Error("provider-private-error"); this.objects.delete(key); }
  async exists(key: string) { return this.objects.has(key); }
}
async function fixture() {
  const suffix = randomUUID().slice(0, 8);
  const users = await Promise.all(["author", "viewer", "stranger"].map((label) => db.user.create({ data: {
    email: `media-${label}-${suffix}@example.test`, passwordHash: "private-marker", profile: { create: { fullName: `Media ${label}` } },
    innovationProfile: { create: { handle: `media-${label}-${suffix}`, headline: "Media integration", profileVisibility: "PUBLIC", publishedAt: new Date(), directoryEnabled: true, collaborationStatus: "OPEN" } },
  } })));
  const [author, viewer, stranger] = users; const ids = users.map((user) => user.id); const storage = new MemoryStorage();
  const bytes = await sharp({ create: { width: 30, height: 20, channels: 3, background: "#d58233" } }).png().toBuffer();
  return { author, viewer, stranger, ids, storage, bytes,
    upload: (kind: "POST_IMAGE" | "PROFILE_AVATAR" | "PROFILE_COVER" = "POST_IMAGE", userId = author.id) => uploadMedia(userId, { kind, bytes, mimeType: "image/png" }, storage),
    async connect() { const request = await sendConnectionRequest(viewer.id, { recipientUserId: author.id }); await respondConnectionRequest(author.id, request.id, { action: "accept" }); },
    async cleanup() {
      await db.notification.deleteMany({ where: { OR: [{ recipientUserId: { in: ids } }, { actorUserId: { in: ids } }] } });
      await db.socialPost.deleteMany({ where: { authorUserId: { in: ids }, repostOfPostId: { not: null } } });
      await db.socialPost.deleteMany({ where: { authorUserId: { in: ids } } });
      await db.innovationProfile.updateMany({ where: { userId: { in: ids } }, data: { avatarMediaId: null, coverMediaId: null } });
      await db.mediaAsset.deleteMany({ where: { ownerUserId: { in: ids } } });
      await db.userBlock.deleteMany({ where: { OR: [{ blockerUserId: { in: ids } }, { blockedUserId: { in: ids } }] } });
      await db.networkConnection.deleteMany({ where: { OR: [{ userAId: { in: ids } }, { userBId: { in: ids } }] } });
      await db.connectionRequest.deleteMany({ where: { requesterUserId: { in: ids } } });
      await db.user.deleteMany({ where: { id: { in: ids } } });
    },
  };
}

test("media authorization follows post audience, connections, current blocks, profile publication and deletion", { skip: !databaseAvailable }, async () => {
  const f = await fixture();
  try {
    const privateAsset = await f.upload();
    await authorizeMedia(privateAsset.id, f.author.id);
    await assert.rejects(() => authorizeMedia(privateAsset.id));
    const post = await createPost(f.author.id, { visibility: "CONNECTIONS", media: [{ mediaId: privateAsset.id, altText: "Pesquisa" }] });
    assert.equal((await getPost(post.id, f.author.id))?.media[0].altText, "Pesquisa");
    await assert.rejects(() => authorizeMedia(privateAsset.id)); await assert.rejects(() => authorizeMedia(privateAsset.id, f.viewer.id));
    await f.connect(); assert.ok((await readMedia(privateAsset.id, f.viewer.id, "medium", f.storage)).length);
    await blockUser(f.author.id, { blockedUserId: f.viewer.id }); await assert.rejects(() => authorizeMedia(privateAsset.id, f.viewer.id));
    const publicAsset = await f.upload(); const publicPost = await createPost(f.author.id, { visibility: "PUBLIC", media: [{ mediaId: publicAsset.id }] });
    assert.ok(await authorizeMedia(publicAsset.id));
    await updateProfile(f.author.id, { section: "unpublish" }); await assert.rejects(() => authorizeMedia(publicAsset.id));
    assert.ok(await authorizeMedia(publicAsset.id, f.stranger.id));
    await deletePost(f.author.id, publicPost.id); await assert.rejects(() => authorizeMedia(publicAsset.id, f.author.id));
    assert.equal((await db.mediaAsset.findUniqueOrThrow({ where: { id: publicAsset.id } })).status, "DELETED");
  } finally { await f.cleanup(); }
});

test("profile replacement and removal revoke old URLs; ownership, kind and private profile cannot be bypassed", { skip: !databaseAvailable }, async () => {
  const f = await fixture();
  try {
    const avatar = await f.upload("PROFILE_AVATAR"); const cover = await f.upload("PROFILE_COVER");
    await assert.rejects(() => setProfileMedia(f.stranger.id, { kind: "PROFILE_AVATAR", mediaId: avatar.id }));
    await assert.rejects(() => setProfileMedia(f.author.id, { kind: "PROFILE_AVATAR", mediaId: cover.id }));
    await setProfileMedia(f.author.id, { kind: "PROFILE_AVATAR", mediaId: avatar.id }); await setProfileMedia(f.author.id, { kind: "PROFILE_COVER", mediaId: cover.id });
    assert.ok(await authorizeMedia(avatar.id)); assert.ok(await authorizeMedia(cover.id));
    await assert.rejects(() => deleteUnattachedMedia(f.author.id, avatar.id));
    const replacement = await f.upload("PROFILE_AVATAR"); await setProfileMedia(f.author.id, { kind: "PROFILE_AVATAR", mediaId: replacement.id });
    await assert.rejects(() => authorizeMedia(avatar.id, f.author.id)); assert.ok(await authorizeMedia(replacement.id));
    await db.innovationProfile.update({ where: { userId: f.author.id }, data: { profileVisibility: "PLATFORM", publishedAt: null } });
    await assert.rejects(() => authorizeMedia(replacement.id)); await assert.rejects(() => authorizeMedia(cover.id));
    assert.ok(await authorizeMedia(cover.id, f.viewer.id));
    await blockUser(f.author.id, { blockedUserId: f.viewer.id }); await assert.rejects(() => authorizeMedia(cover.id, f.viewer.id));
    await setProfileMedia(f.author.id, { kind: "PROFILE_COVER", mediaId: null }); await assert.rejects(() => authorizeMedia(cover.id, f.author.id));
  } finally { await f.cleanup(); }
});

test("attachment transactions reject foreign, deleted, duplicate and fifth images and preserve content under races", { skip: !databaseAvailable }, async () => {
  const f = await fixture();
  try {
    const asset = await f.upload();
    await assert.rejects(() => createPost(f.stranger.id, { media: [{ mediaId: asset.id }] }));
    assert.equal(await db.socialPost.count({ where: { authorUserId: f.stranger.id } }), 0);
    await assert.rejects(() => createPost(f.author.id, { media: Array.from({ length: 5 }, () => ({ mediaId: asset.id })) }));
    await assert.rejects(() => createPost(f.author.id, { media: [{ mediaId: asset.id }, { mediaId: asset.id }] }));
    const attempts = await Promise.allSettled([createPost(f.author.id, { media: [{ mediaId: asset.id }] }), createPost(f.author.id, { media: [{ mediaId: asset.id }] })]);
    assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 1);
    const post = attempts.find((result): result is PromiseFulfilledResult<{ id: string }> => result.status === "fulfilled")!.value;
    await assert.rejects(() => updatePost(f.author.id, post.id, { media: [] }));
    await assert.rejects(() => db.socialPostMedia.deleteMany({ where: { postId: post.id } }));
    await assert.rejects(() => db.mediaAsset.update({ where: { id: asset.id }, data: { status: "DELETED", deletedAt: new Date() } }));
    await updatePost(f.author.id, post.id, { body: "Texto preservado", media: [] });
    assert.equal((await getPost(post.id, f.author.id))?.media.length, 0);
    await assert.rejects(() => createPost(f.author.id, { media: [{ mediaId: asset.id }] }));
    await assert.rejects(() => db.socialPost.create({ data: { authorUserId: f.author.id } }));
  } finally { await f.cleanup(); }
});

test("failed object writes remain unservable; explicit cleanup retries failed deletions and protects attachments", { skip: !databaseAvailable }, async () => {
  const f = await fixture();
  try {
    f.storage.failPut = true;
    await assert.rejects(() => f.upload(), (error: unknown) => error instanceof Error && error.message === "MEDIA_STORAGE_UNAVAILABLE");
    assert.equal(await db.mediaAsset.count({ where: { ownerUserId: f.author.id, status: "READY" } }), 0);
    f.storage.failPut = false;
    const orphan = await f.upload(); const attached = await f.upload();
    await createPost(f.author.id, { media: [{ mediaId: attached.id }] });
    f.storage.failDelete = true;
    const future = new Date(Date.now() + 2 * 86400000);
    const failed = await cleanupMedia({ now: future, storage: f.storage, ownerUserId: f.author.id }); assert.ok(failed.failed >= 1);
    await assert.rejects(() => authorizeMedia(orphan.id, f.author.id));
    assert.ok(await authorizeMedia(attached.id, f.author.id));
    assert.equal((await db.mediaAsset.findUniqueOrThrow({ where: { id: orphan.id } })).physicalDeletedAt, null);
    f.storage.failDelete = false;
    const success = await cleanupMedia({ now: future, storage: f.storage, ownerUserId: f.author.id }); assert.ok(success.deleted >= 1);
    assert.ok((await db.mediaAsset.findUniqueOrThrow({ where: { id: orphan.id } })).physicalDeletedAt);
    assert.equal([...f.storage.objects.keys()].some((key) => key.includes(orphan.id)), false);
    assert.ok([...f.storage.objects.keys()].some((key) => key.includes(attached.id)));
  } finally { await f.cleanup(); }
});
