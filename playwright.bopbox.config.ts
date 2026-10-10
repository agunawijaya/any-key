import { defineConfig, devices } from "@playwright/test";

/*
 * Bop Box's own end-to-end tests, on a production build served on port 3222
 * so they never touch the shared dev server or the main suite's server.
 * Build first: `npx next build`. Set BOPBOX_E2E_URL to test a running server
 * instead (the shared dev server, say) without starting one.
 */
const url = process.env.BOPBOX_E2E_URL;

export default defineConfig({
  testDir: "tests/e2e",
  // The Live view, and the Story (whose architecture chapter grew a diagram for it).
  testMatch: ["bopbox-live.spec.ts", "story.spec.ts"],
  timeout: 120_000,
  expect: { timeout: 15_000 },
  retries: 1,
  workers: 2,
  reporter: [["list"]],
  outputDir: "test-results/bopbox",
  use: {
    baseURL: url ?? "http://localhost:3222",
    viewport: { width: 1280, height: 720 },
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } } }],
  webServer: url
    ? undefined
    : {
        command: "npx next start -p 3222",
        url: "http://localhost:3222",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
