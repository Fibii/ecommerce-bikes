import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);

// Two servers from the same production build (decision A8): one whose stock
// service never fails and one whose stock service always fails. Run
// `npm run build` first; `npm run test:e2e` does it for you.
const reliable = { port: 3000, failureRate: "0" };
const failing = { port: 3001, failureRate: "1" };

const server = ({ port, failureRate }: typeof reliable) => ({
  command: "npm run start",
  url: `http://localhost:${port}`,
  env: {
    PORT: String(port),
    STOCK_FAILURE_RATE: failureRate,
    STOCK_LATENCY_MIN_MS: "0",
    STOCK_LATENCY_MAX_MS: "50",
  },
  reuseExistingServer: false,
  timeout: 120_000,
});

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${reliable.port}`,
    trace: "on-first-retry",
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [server(reliable), server(failing)],
});
