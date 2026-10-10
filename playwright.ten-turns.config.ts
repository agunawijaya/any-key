import { defineConfig, devices } from "@playwright/test";

/*
 * Ten Turns in the Pit's own end-to-end tests, on a production build served
 * on port 3220 so they never touch the shared dev server or another game's
 * server. Build first: `npx next build`.
 */
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "ten-turns.spec.ts",
  // Every test seeds its own storage, so they can run side by side.
  fullyParallel: true,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  retries: 1,
  workers: 3,
  reporter: [["list"]],
  outputDir: "test-results/ten-turns",
  use: {
    baseURL: "http://localhost:3220",
    viewport: { width: 1280, height: 720 },
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } } }],
  webServer: {
    command: "npx next start -p 3220",
    url: "http://localhost:3220",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
