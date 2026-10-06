type BaseUrlEnvironment = { APP_BASE_URL?: string; NODE_ENV?: string };

export function getAppBaseUrl(environment: BaseUrlEnvironment = process.env): URL {
  const configured = environment.APP_BASE_URL?.trim();
  if (!configured && environment.NODE_ENV === "production") throw new Error("APP_BASE_URL_REQUIRED");
  let url: URL;
  try { url = new URL(configured || "http://localhost:3000"); }
  catch { throw new Error("APP_BASE_URL_INVALID"); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || !/^\/*$/.test(url.pathname)
    || (url.protocol !== "https:" && !(url.protocol === "http:" && local && environment.NODE_ENV !== "production"))) {
    throw new Error("APP_BASE_URL_INVALID");
  }
  return new URL(url.origin);
}

export function appMetadataUrl(path: string, environment: BaseUrlEnvironment = process.env): string {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || /[\u0000-\u001f\u007f]/.test(path)) throw new Error("METADATA_PATH_INVALID");
  const base = getAppBaseUrl(environment);
  const url = new URL(path, base);
  if (url.origin !== base.origin) throw new Error("METADATA_PATH_INVALID");
  url.pathname = url.pathname.replace(/\/{2,}/g, "/");
  return url.toString();
}
