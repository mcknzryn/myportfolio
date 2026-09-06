import { defineConfig, devices } from "@playwright/test";

// Keep browser tests isolated from the regular `npm run dev` server on port 4321.
// Reusing that server can make results depend on when and how it was started.
const baseURL = "http://127.0.0.1:4322";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  workers: 4,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  // Keep the existing reviewed images in one obvious folder even though the
  // optional visual test now has its own spec file.
  snapshotPathTemplate: "{testDir}/site.spec.ts-snapshots/{arg}{ext}",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.02,
    },
  },
  projects: [
    {
      name: "chromium",
      testIgnore: ["**/cross-browser-smoke.spec.ts", "**/visual.spec.ts"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "firefox-desktop",
      testMatch: "**/cross-browser-smoke.spec.ts",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "webkit-phone",
      testMatch: "**/cross-browser-smoke.spec.ts",
      use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "visual",
      testMatch: "**/visual.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4322",
    // Astro 7 backgrounds dev servers when it detects an agent. Playwright
    // needs to own the foreground process so it can stop it after the suite.
    env: { ASTRO_DEV_BACKGROUND: "1" },
    url: baseURL,
    reuseExistingServer: false,
  },
});
