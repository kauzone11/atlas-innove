import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import type { IncomingMessage } from "node:http";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { defaultConfig, type NextConfigComplete } from "next/dist/server/config-shared";
import { ImageOptimizerCache, imageOptimizer, sendResponse } from "next/dist/server/image-optimizer";
import { createRequestResponseMocks } from "next/dist/server/lib/mock-request";
import nextConfig from "../../../next.config";

const defaults = defaultConfig as unknown as NextConfigComplete;
const configured = { ...defaults, images: { ...defaults.images, ...nextConfig.images } };
const request = (cookie?: string) => ({ headers: { accept: "image/webp", ...(cookie ? { cookie } : {}) } } as IncomingMessage);
const parameters = (url: string) => ({ url, w: "384", q: "75" });

test("Next's default optimizer publicly caches no-store images independently of the requesting session", async () => {
  const url = "/api/media/public-before-privacy-revocation?variant=medium";
  const anonymous = ImageOptimizerCache.validateParams(request(), parameters(url), defaults, false);
  const authenticated = ImageOptimizerCache.validateParams(request("atlas_innove_session=fixture"), parameters(url), defaults, false);
  assert.ok(!("errorMessage" in anonymous));
  assert.ok(!("errorMessage" in authenticated));
  assert.equal(ImageOptimizerCache.getCacheKey(anonymous), ImageOptimizerCache.getCacheKey(authenticated));
  const buffer = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#fff" } }).webp().toBuffer();
  const optimized = await imageOptimizer({ buffer, contentType: "image/webp", cacheControl: "private, no-store", etag: "fixture" }, anonymous, defaultConfig, { silent: true });
  assert.equal(optimized.maxAge, defaultConfig.images.minimumCacheTTL);
  const mocked = createRequestResponseMocks({ url });
  sendResponse(mocked.req, mocked.res, url, "webp", optimized.buffer, optimized.etag, false, "MISS", defaultConfig.images, optimized.maxAge, false);
  assert.equal(mocked.res.getHeader("Cache-Control"), `public, max-age=${optimized.maxAge}, must-revalidate`);
});

test("the application optimizer rejects authorized media and paths outside static asset directories", () => {
  for (const url of [
    "/api/media/fixture", "/api/media/fixture?variant=small", "/api/media/fixture?variant=medium", "/api/media/fixture?variant=large",
    "/brand/../api/media/fixture", "/demo/%2e%2e/api/media/fixture", "/api/personal/media/fixture",
    "/brand/atlas-innove-lockup.svg?url=/api/media/fixture", "https://innove.example.test/api/media/fixture",
  ]) {
    for (const cookie of [undefined, "atlas_innove_session=fixture"]) {
      assert.deepEqual(ImageOptimizerCache.validateParams(request(cookie), parameters(url), configured, false), { errorMessage: '"url" parameter is not allowed' }, url);
    }
  }
});

test("every existing static brand and demo image remains eligible for optimization", async () => {
  let count = 0;
  for (const directory of ["brand", "demo"]) {
    const files = await readdir(path.join(process.cwd(), "public", directory), { recursive: true, withFileTypes: true });
    for (const file of files) {
      if (!file.isFile()) continue;
      const relative = path.relative(path.join(process.cwd(), "public"), path.join(file.parentPath, file.name)).replaceAll(path.sep, "/");
      const result = ImageOptimizerCache.validateParams(request(), parameters(`/${relative}`), configured, false);
      assert.ok(!("errorMessage" in result), `${relative}: ${"errorMessage" in result ? result.errorMessage : ""}`);
      count += 1;
    }
  }
  assert.ok(count > 0);
});
