import { defineConfig } from "@playwright/test";

// Visual baselines are only valid from the pinned Playwright Docker image (see e2e/visual-docker.sh).
// PW_BASE_URL points at a server the caller already started; otherwise Playwright serves the build itself.
const baseURL = process.env["PW_BASE_URL"] ?? "http://127.0.0.1:4173";

export default defineConfig({
  testDir: ".",
  testMatch: "*.visual.spec.ts",
  snapshotPathTemplate: "{testDir}/baselines/{arg}{ext}",
  forbidOnly: !!process.env["CI"],
  reporter: [["list"]],
  use: {
    baseURL,
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
  },
  expect: {
    toHaveScreenshot: { animations: "disabled", maxDiffPixelRatio: 0.001 },
  },
  projects: [{ name: "desktop-1280", use: { browserName: "chromium" } }],
  webServer: process.env["PW_BASE_URL"]
    ? undefined
    : {
        command: "npx vite build && npx vite preview --port 4173 --strictPort",
        url: baseURL,
        timeout: 120_000,
      },
});
