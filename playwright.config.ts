import { defineConfig } from "@playwright/test";
import { join } from "node:path";
import { tmpdir } from "node:os";

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  outputDir: process.env.INNOVE_BROWSER_OUTPUT ?? join(tmpdir(), "atlas-innove-browser-results"),
  reporter: "list",
  use: { baseURL: process.env.INNOVE_BROWSER_BASE_URL ?? "http://127.0.0.1:3000", browserName: "chromium", locale: "pt-BR", actionTimeout: 15_000, navigationTimeout: 30_000, viewport: { width: 1440, height: 1000 }, screenshot: "only-on-failure", trace: "retain-on-failure" },
});
