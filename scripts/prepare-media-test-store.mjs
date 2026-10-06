import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import { CreateBucketCommand, GetBucketPolicyCommand, HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";

const endpoint = new URL(process.env.OBJECT_STORAGE_ENDPOINT ?? "");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname), "Test storage must be on loopback");
assert.equal(process.env.INNOVE_MEDIA_BROWSER_TESTS, "true");
const bucket = process.env.OBJECT_STORAGE_BUCKET;
assert.ok(bucket?.startsWith("atlas-innove-"), "Use an Atlas Innove disposable test bucket");
for (let attempt = 0; ; attempt++) {
  try { assert.equal((await fetch(new URL("/minio/health/live", endpoint), { signal: AbortSignal.timeout(2000) })).status, 200); break; }
  catch (error) { if (attempt >= 29) throw error; await setTimeout(1000); }
}
const storage = new S3Client({ endpoint: endpoint.toString(), region: process.env.OBJECT_STORAGE_REGION, forcePathStyle: true,
  credentials: { accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY_ID, secretAccessKey: process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY } });
try {
  try { await storage.send(new HeadBucketCommand({ Bucket: bucket })); }
  catch (error) { if (error.$metadata?.httpStatusCode !== 404) throw error; await storage.send(new CreateBucketCommand({ Bucket: bucket })); }
  try { await storage.send(new GetBucketPolicyCommand({ Bucket: bucket })); throw new Error("Test bucket must not have an anonymous access policy"); }
  catch (error) { if (error.name !== "NoSuchBucketPolicy") throw error; }
  console.log("PASS: private loopback S3-compatible test bucket is ready.");
} finally { storage.destroy(); }
