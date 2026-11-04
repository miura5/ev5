import { defineConfig } from "@playwright/test";

// Gate 5 journeys against v5 staging (E2E_URL, E2E_TOKEN). No retries; a todo journey is a failing test, never a skip.
export default defineConfig({
  testDir: ".",
  testMatch: "*.journey.spec.ts",
  forbidOnly: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env["E2E_URL"],
    viewport: { width: 1280, height: 800 },
  },
  projects: [{ name: "desktop-1280", use: { browserName: "chromium" } }],
});
