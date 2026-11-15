import { defineConfig, devices } from "@playwright/test";

/**
 * E2E against a running server (pnpm dev or pnpm start) on :3000, started with
 * KVITTEL_E2E_IGNORE_SCHEDULE=1 so Shabbat/hours windows don't block the run.
 * Uses the locally installed Chrome (PW_CHANNEL=chromium to use bundled browsers).
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", channel: process.env.PW_CHANNEL ?? "chrome", trace: "retain-on-failure" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], channel: process.env.PW_CHANNEL ?? "chrome", viewport: { width: 1440, height: 900 } } }],
});
