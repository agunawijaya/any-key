import { defineConfig, devices } from "@playwright/test";

/*
 * End-to-end tests run against a production build served on port 3211, so
 * they never touch the dev server on 3210. `npm run e2e` builds first.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  retries: 1,
  workers: 3,
  reporter: [["list"]],
  outputDir: "test-results/e2e",
  use: {
    baseURL: "http://localhost:3211",
    viewport: { width: 1280, height: 720 },
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } } }],
  webServer: {
    command: "npx next start -p 3211",
    url: "http://localhost:3211",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
