import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { storageConfig } from "@/lib/storage/config";
import { unavailableStorage } from "@/lib/media/errors";

export interface ObjectStorage {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export function createObjectStorage(): ObjectStorage {
  const config = storageConfig();
  if (!config) throw unavailableStorage();
  const client = new S3Client({ region: config.region, endpoint: config.endpoint, forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }, maxAttempts: 2 });
  const send = <T>(action: (signal: AbortSignal) => Promise<T>) => action(AbortSignal.timeout(15_000));
  const missing = (error: unknown) => typeof error === "object" && error !== null && ("name" in error && ["NoSuchKey", "NotFound"].includes(String(error.name)) || "$metadata" in error && (error.$metadata as { httpStatusCode?: number })?.httpStatusCode === 404);
  return {
    async put(key, bytes) { await send((abortSignal) => client.send(new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: bytes, ContentType: "image/webp", CacheControl: "private, no-store", ContentLength: bytes.byteLength }), { abortSignal })); },
    async get(key) {
      try {
        const response = await send((abortSignal) => client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }), { abortSignal }));
        if (!response.Body || !response.ContentLength || response.ContentLength > 12 * 1024 * 1024) return null;
        return await response.Body.transformToByteArray();
      } catch (error) { if (missing(error)) return null; throw error; }
    },
    async delete(key) { await send((abortSignal) => client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }), { abortSignal })); },
    async exists(key) { try { await send((abortSignal) => client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }), { abortSignal })); return true; } catch (error) { if (missing(error)) return false; throw error; } },
  };
}
