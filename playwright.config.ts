import { defineConfig, devices } from "@playwright/test";

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const browserChannel =
  executablePath || process.env.CI
    ? process.env.PLAYWRIGHT_BROWSER_CHANNEL
    : (process.env.PLAYWRIGHT_BROWSER_CHANNEL ??
      (process.platform === "win32" ? "chrome" : undefined));

export default defineConfig({
  testDir: "./tests/e2e/pilot",
  globalSetup: "./tests/e2e/pilot/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.AUTOMATEX_E2E_BASE_URL ?? "http://localhost:3000",
    browserName: "chromium",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: process.env.PLAYWRIGHT_DISABLE_VIDEO === "true" ? "off" : "retain-on-failure",
    headless: process.env.PLAYWRIGHT_HEADED === "true" ? false : true,
    channel: browserChannel,
    launchOptions: executablePath ? { executablePath } : undefined,
  },
});
