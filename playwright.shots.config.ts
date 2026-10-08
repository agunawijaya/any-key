import { defineConfig, devices } from "@playwright/test";

/* Screenshots of every key screen for the docs (`npm run shots`), on the same port-3211 server as the e2e tests. */
export default defineConfig({
  testDir: "tests/shots",
  timeout: 180_000,
  workers: 3,
  reporter: [["list"]],
  outputDir: "test-results/shots",
  use: { baseURL: "http://localhost:3211" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npx next start -p 3211",
    url: "http://localhost:3211",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
