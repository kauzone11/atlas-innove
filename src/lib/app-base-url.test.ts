import assert from "node:assert/strict";
import test from "node:test";
import { appMetadataUrl, getAppBaseUrl } from "@/lib/app-base-url";

test("metadata URLs use a validated origin and normalized absolute path", () => {
  const environment = { APP_BASE_URL: "https://example.test///", NODE_ENV: "production" };
  assert.equal(getAppBaseUrl(environment).origin, "https://example.test");
  assert.equal(appMetadataUrl("/people//ana", environment), "https://example.test/people/ana");
  assert.equal(appMetadataUrl("/people//ana?source=https://example.test", environment), "https://example.test/people/ana?source=https://example.test");
  assert.equal(appMetadataUrl("/", { NODE_ENV: "test" }), "http://localhost:3000/");
  for (const APP_BASE_URL of ["javascript:alert(1)", "https://user:password@example.test", "http://example.test", "https://example.test/path", "https://example.test?x=1"]) {
    assert.throws(() => getAppBaseUrl({ APP_BASE_URL, NODE_ENV: "production" }), /APP_BASE_URL_INVALID/);
  }
  assert.throws(() => getAppBaseUrl({ NODE_ENV: "production" }), /APP_BASE_URL_REQUIRED/);
  assert.throws(() => getAppBaseUrl({ APP_BASE_URL: "http://localhost:3000", NODE_ENV: "production" }), /APP_BASE_URL_INVALID/);
  for (const path of ["people/ana", "//other.test/profile", "https://other.test", "/\\other.test", "/\n/other.test", "/\t/other.test"]) assert.throws(() => appMetadataUrl(path, environment), /METADATA_PATH_INVALID/);
});
