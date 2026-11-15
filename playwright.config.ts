import { defineConfig, devices } from "@playwright/test";

const port = process.env.PORT ?? "3000";
const baseURL = `http://localhost:${port}`;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Run against the production build, which is what customers get.
  webServer: {
    command: "npm run build && npm run start",
    url: baseURL,
    env: { PORT: port },
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
