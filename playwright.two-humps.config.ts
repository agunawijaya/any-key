import { defineConfig, devices } from "@playwright/test";

/*
 * Two Humps' own end-to-end tests, on a production build served on port 3213
 * so they never touch the shared dev server or the main suite's server.
 * Build first: `npx next build`.
 */
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "two-humps.spec.ts",
  timeout: 150_000,
  expect: { timeout: 10_000 },
  retries: 1,
  workers: 3,
  reporter: [["list"]],
  outputDir: "test-results/two-humps",
  use: {
    baseURL: "http://localhost:3213",
    viewport: { width: 1280, height: 720 },
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } } }],
  webServer: {
    command: "npx next start -p 3213",
    url: "http://localhost:3213",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
