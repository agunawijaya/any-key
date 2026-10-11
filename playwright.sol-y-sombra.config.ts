import { defineConfig, devices } from "@playwright/test";

/*
 * Sol y Sombra's own end-to-end tests, on a production build served on port
 * 3221 so they never touch the shared dev server or the main suite's server.
 * The ring is Canvas 2D; Chromium gets the GPU through ANGLE where there is
 * one. Build first: `npx next build`.
 */
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "sol-y-sombra.spec.ts",
  // Every test seeds its own storage, so they can run side by side.
  fullyParallel: true,
  timeout: 240_000,
  expect: { timeout: 15_000 },
  retries: 1,
  workers: 3,
  reporter: [["list"]],
  outputDir: "test-results/sol-y-sombra",
  use: {
    baseURL: "http://localhost:3221",
    viewport: { width: 1280, height: 720 },
    trace: "retain-on-failure",
    launchOptions: { args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } } }],
  webServer: {
    command: "npx next start -p 3221",
    url: "http://localhost:3221",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
