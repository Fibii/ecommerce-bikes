import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  // Path to the Next.js app, so next.config.ts and .env files are loaded in tests.
  dir: "./",
});

const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  // Unit tests live next to the code in src/. End-to-end tests run with Playwright.
  roots: ["<rootDir>/src"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
};

// Exported this way so next/jest can load the async Next.js config.
export default createJestConfig(config);
