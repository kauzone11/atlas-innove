import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { detectImageType, MEDIA_SIZE_LIMITS, processImage, withImageProcessingSlot } from "@/lib/media/processing";
import { readMediaUpload, withMediaUploadSlot } from "@/lib/media/multipart";
import { storageConfig } from "@/lib/storage/config";

test("sanitized derivatives autorotate, strip EXIF and preserve post aspect ratio", async () => {
  const bytes = await sharp({ create: { width: 80, height: 40, channels: 3, background: "#a55e20" } }).jpeg().withMetadata({ orientation: 6, exif: { IFD0: { Artist: "private-camera-owner" } } }).toBuffer();
  const result = await processImage(bytes, "POST_IMAGE", "image/jpeg");
  for (const output of Object.values(result)) {
    const metadata = await sharp(output.bytes).metadata();
    assert.equal(metadata.format, "webp"); assert.equal(metadata.width, 40); assert.equal(metadata.height, 80);
    assert.equal(metadata.exif, undefined); assert.equal(metadata.icc, undefined); assert.equal(metadata.orientation, undefined);
    assert.equal(output.bytes.includes(Buffer.from("private-camera-owner")), false);
  }
});

test("avatar crop is square, bounded and server processed; post cropping is rejected", async () => {
  const bytes = await sharp({ create: { width: 80, height: 40, channels: 3, background: "#fff" } }).png().toBuffer();
  assert.equal((await processImage(bytes, "PROFILE_AVATAR", "image/png")).large.width, 40);
  const crop = { x: .25, y: 0, width: .5, height: 1 };
  assert.equal((await processImage(bytes, "PROFILE_AVATAR", "image/png", crop)).large.width, 40);
  await assert.rejects(() => processImage(bytes, "PROFILE_AVATAR", "image/png", { x: 0, y: 0, width: 1, height: 1 }));
  await assert.rejects(() => processImage(bytes, "POST_IMAGE", "image/png", crop));
  await assert.rejects(() => processImage(bytes, "PROFILE_COVER", "image/png", { x: .9, y: 0, width: .5, height: 1 }));
});

test("image validation rejects MIME spoofing, SVG, GIF, truncation, oversized files and excessive dimensions", async () => {
  const png = await sharp({ create: { width: 12, height: 8, channels: 3, background: "#fff" } }).png().toBuffer();
  assert.equal(detectImageType(png), "image/png");
  await assert.rejects(() => processImage(png, "POST_IMAGE", "image/jpeg"));
  for (const input of [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), Buffer.from("GIF89a"), png.subarray(0, 12), Buffer.from("not an image")]) {
    await assert.rejects(() => processImage(input, "POST_IMAGE", "image/png"));
  }
  await assert.rejects(() => processImage(Buffer.alloc(MEDIA_SIZE_LIMITS.PROFILE_AVATAR + 1), "PROFILE_AVATAR", "image/png"));
  const wide = await sharp({ create: { width: 10001, height: 1, channels: 3, background: "#fff" } }).png().toBuffer();
  await assert.rejects(() => processImage(wide, "POST_IMAGE", "image/png"));
  const huge = await sharp({ create: { width: 6400, height: 6400, channels: 3, background: "#fff" } }).png().toBuffer();
  await assert.rejects(() => processImage(huge, "POST_IMAGE", "image/png"));
});

test("processing slots fail fast under saturation and release after failure", async () => {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => { release = resolve; });
  const first = withImageProcessingSlot(() => wait); const second = withImageProcessingSlot(() => wait);
  await assert.rejects(() => withImageProcessingSlot(async () => true), /MEDIA_PROCESSING_BUSY/);
  release(); await Promise.all([first, second]);
  await assert.rejects(() => withImageProcessingSlot(async () => { throw new Error("expected"); }));
  assert.equal(await withImageProcessingSlot(async () => true), true);
});

test("animated image containers and polyglot metadata never survive processing", async () => {
  const first = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#fff" } }).png().toBuffer();
  const second = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#000" } }).png().toBuffer();
  const animated = await sharp([first, second], { join: { animated: true } }).webp({ delay: [100, 100], loop: 0 }).toBuffer();
  assert.equal((await sharp(animated, { animated: true }).metadata()).pages, 2);
  await assert.rejects(() => processImage(animated, "POST_IMAGE", "image/webp"));
  const acTL = Buffer.alloc(20); acTL.writeUInt32BE(8, 0); acTL.write("acTL", 4); acTL.writeUInt32BE(2, 8);
  await assert.rejects(() => processImage(Buffer.concat([first.subarray(0, 33), acTL, first.subarray(33)]), "POST_IMAGE", "image/png"));
  const polyglot = Buffer.concat([first, Buffer.from('<script>alert("private-marker")</script>')]);
  const result = await processImage(polyglot, "POST_IMAGE", "image/png");
  assert.equal(result.large.bytes.includes(Buffer.from("<script>")), false);
});

test("upload body admission is bounded before parsing and always releases capacity", async () => {
  let release!: () => void; const wait = new Promise<void>((resolve) => { release = resolve; });
  const active = Array.from({ length: 4 }, () => withMediaUploadSlot(() => wait));
  await assert.rejects(() => withMediaUploadSlot(async () => true), /MEDIA_UPLOAD_BUSY/);
  release(); await Promise.all(active); assert.equal(await withMediaUploadSlot(async () => true), true);
});

test("multipart byte limits are enforced for declared and streamed request bodies", async () => {
  await assert.rejects(() => readMediaUpload(new Request("http://localhost/upload", { method: "POST", headers: { "content-type": "multipart/form-data; boundary=a", "content-length": "99999999" }, body: "x" })), /MEDIA_TOO_LARGE/);
  const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(11 * 1024 * 1024)); controller.close(); } });
  const request = new Request("http://localhost/upload", { method: "POST", headers: { "content-type": "multipart/form-data; boundary=a" }, body, duplex: "half" } as RequestInit);
  await assert.rejects(() => readMediaUpload(request), /MEDIA_TOO_LARGE/);
  const file = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#fff" } }).png().toBuffer();
  const form = new FormData(); form.set("kind", "POST_IMAGE"); form.set("file", new Blob([new Uint8Array(file)], { type: "image/png" }), "untrusted.svg");
  const result = await readMediaUpload(new Request("http://localhost/upload", { method: "POST", body: form }));
  assert.equal(result.kind, "POST_IMAGE"); assert.equal(result.mimeType, "image/png"); assert.deepEqual(Buffer.from(result.bytes), file);
});

test("storage is fail closed, private configuration permits only HTTPS or local integration endpoints", () => {
  assert.equal(storageConfig({}), null);
  const env = { NODE_ENV: "production", OBJECT_STORAGE_REGION: "local", OBJECT_STORAGE_BUCKET: "private", OBJECT_STORAGE_ACCESS_KEY_ID: "test", OBJECT_STORAGE_SECRET_ACCESS_KEY: "test" };
  assert.ok(storageConfig({ ...env, OBJECT_STORAGE_ENDPOINT: "https://s3.example.test" }));
  assert.ok(storageConfig({ ...env, OBJECT_STORAGE_ENDPOINT: "http://127.0.0.1:9000" }));
  for (const endpoint of ["http://external.example.test", "https://user:password@example.test", "file:///tmp", "https://example.test?secret=1"]) assert.equal(storageConfig({ ...env, OBJECT_STORAGE_ENDPOINT: endpoint }), null);
});
