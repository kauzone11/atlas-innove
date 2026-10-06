export type StorageConfig = { endpoint?: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string; forcePathStyle: boolean };

export function storageConfig(env: Readonly<Record<string, string | undefined>> = process.env): StorageConfig | null {
  const bucket = env.OBJECT_STORAGE_BUCKET?.trim();
  const region = env.OBJECT_STORAGE_REGION?.trim();
  const accessKeyId = env.OBJECT_STORAGE_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.OBJECT_STORAGE_SECRET_ACCESS_KEY?.trim();
  if (!bucket || !region || !accessKeyId || !secretAccessKey) return null;
  const endpoint = env.OBJECT_STORAGE_ENDPOINT?.trim() || undefined;
  if (endpoint) {
    try {
      const parsed = new URL(endpoint);
      if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
      if (env.NODE_ENV === "production" && parsed.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)) return null;
    } catch { return null; }
  }
  if (env.OBJECT_STORAGE_FORCE_PATH_STYLE && !["true", "false"].includes(env.OBJECT_STORAGE_FORCE_PATH_STYLE)) return null;
  return { endpoint, region, bucket, accessKeyId, secretAccessKey, forcePathStyle: env.OBJECT_STORAGE_FORCE_PATH_STYLE === "true" };
}

export function isStorageConfigured(): boolean { return storageConfig() !== null; }
