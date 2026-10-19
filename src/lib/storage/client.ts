import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { localStorageDir, storageConfig } from "@/lib/storage/config";
import { unavailableStorage } from "@/lib/media/errors";

export interface ObjectStorage {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

const MAX_OBJECT_BYTES = 12 * 1024 * 1024;
const localKey = /^media\/[0-9a-f-]{36}\/(?:small|medium|large)\.webp$/;

export function createLocalObjectStorage(directory: string): ObjectStorage {
  const root = path.resolve(directory);
  // Keys are generated server-side, but the strict pattern keeps any key from leaving the storage root.
  const locate = (key: string) => {
    const target = path.resolve(root, key);
    if (!localKey.test(key) || !target.startsWith(root + path.sep)) throw unavailableStorage();
    return target;
  };
  const absent = (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
  return {
    async put(key, bytes) {
      const target = locate(key);
      await mkdir(path.dirname(target), { recursive: true });
      const staging = `${target}.${process.pid}.${Date.now()}.tmp`;
      try { await writeFile(staging, bytes); await rename(staging, target); } catch (error) { await rm(staging, { force: true }); throw error; }
    },
    async get(key) {
      const target = locate(key);
      try { const info = await stat(target); return info.size > MAX_OBJECT_BYTES ? null : new Uint8Array(await readFile(target)); }
      catch (error) { if (absent(error)) return null; throw error; }
    },
    async delete(key) { await rm(locate(key), { force: true }); },
    async exists(key) { try { await stat(locate(key)); return true; } catch (error) { if (absent(error)) return false; throw error; } },
  };
}

export function createObjectStorage(): ObjectStorage {
  const config = storageConfig();
  if (!config) return createLocalObjectStorage(localStorageDir());
  const client = new S3Client({ region: config.region, endpoint: config.endpoint, forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }, maxAttempts: 2 });
  const send = <T>(action: (signal: AbortSignal) => Promise<T>) => action(AbortSignal.timeout(15_000));
  const missing = (error: unknown) => typeof error === "object" && error !== null && ("name" in error && ["NoSuchKey", "NotFound"].includes(String(error.name)) || "$metadata" in error && (error.$metadata as { httpStatusCode?: number })?.httpStatusCode === 404);
  return {
    async put(key, bytes) { await send((abortSignal) => client.send(new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: bytes, ContentType: "image/webp", CacheControl: "private, no-store", ContentLength: bytes.byteLength }), { abortSignal })); },
    async get(key) {
      try {
        const response = await send((abortSignal) => client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }), { abortSignal }));
        if (!response.Body || !response.ContentLength || response.ContentLength > MAX_OBJECT_BYTES) return null;
        return await response.Body.transformToByteArray();
      } catch (error) { if (missing(error)) return null; throw error; }
    },
    async delete(key) { await send((abortSignal) => client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }), { abortSignal })); },
    async exists(key) { try { await send((abortSignal) => client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }), { abortSignal })); return true; } catch (error) { if (missing(error)) return false; throw error; } },
  };
}
