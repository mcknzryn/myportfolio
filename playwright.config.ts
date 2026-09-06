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
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}{ext}",
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
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "firefox-desktop",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "webkit-desktop",
      use: {
        ...devices["Desktop Safari"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "chromium-tablet",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 820, height: 1180 },
      },
    },
    {
      name: "chromium-phone",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "chromium-short-landscape",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 844, height: 390 },
      },
    },
    {
      name: "firefox-tablet",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 820, height: 1180 },
      },
    },
    {
      name: "firefox-phone",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "firefox-short-landscape",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 844, height: 390 },
      },
    },
    {
      name: "webkit-tablet",
      use: {
        ...devices["Desktop Safari"],
        viewport: { width: 820, height: 1180 },
      },
    },
    {
      name: "webkit-phone",
      use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "webkit-short-landscape",
      use: {
        ...devices["iPhone 13 landscape"],
        viewport: { width: 844, height: 390 },
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
