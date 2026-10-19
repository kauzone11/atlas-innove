import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createLocalObjectStorage } from "@/lib/storage/client";
import { isStorageConfigured, localStorageDir } from "@/lib/storage/config";

const id = "0b7a7c04-33a1-4c34-9d52-5b8f7f0f6a11";

test("local object storage stores, reads, checks and deletes derivatives", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "atlas-media-"));
  try {
    const storage = createLocalObjectStorage(root);
    const key = `media/${id}/small.webp`;
    assert.equal(await storage.exists(key), false);
    assert.equal(await storage.get(key), null);
    await storage.put(key, Uint8Array.from([1, 2, 3]));
    assert.equal(await storage.exists(key), true);
    assert.deepEqual([...(await storage.get(key))!], [1, 2, 3]);
    await storage.put(key, Uint8Array.from([9]));
    assert.deepEqual([...(await storage.get(key))!], [9]);
    assert.deepEqual(await readdir(path.join(root, "media", id)), ["small.webp"]);
    await storage.delete(key);
    await storage.delete(key);
    assert.equal(await storage.exists(key), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("local object storage rejects keys outside the generated derivative layout", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "atlas-media-"));
  try {
    const storage = createLocalObjectStorage(root);
    for (const key of ["../escape.webp", `media/${id}/../../escape.webp`, `media/${id}/original.png`, "/etc/passwd", `media/${id}/small.webp/../large.webp`, "media/not-a-uuid/small.webp"]) {
      await assert.rejects(() => storage.put(key, Uint8Array.from([1])), { code: "MEDIA_STORAGE_UNAVAILABLE" });
      await assert.rejects(() => storage.get(key), { code: "MEDIA_STORAGE_UNAVAILABLE" });
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("uploads stay available through the local store when no bucket is configured", () => {
  assert.equal(isStorageConfigured(), true);
  assert.equal(localStorageDir({}), "data/media");
  assert.equal(localStorageDir({ MEDIA_LOCAL_DIR: " /var/lib/atlas/media " }), "/var/lib/atlas/media");
});
