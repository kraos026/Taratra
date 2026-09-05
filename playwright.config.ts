import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { assertPilotTarget } from "./tests/support/pilot-target-guard";

function loadDotEnvLocal(): void {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    if (process.env[key]) continue;
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    )
      value = value.slice(1, -1);
    process.env[key] = value;
  }
}

loadDotEnvLocal();

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const browserChannel =
  executablePath || process.env.CI
    ? process.env.PLAYWRIGHT_BROWSER_CHANNEL
    : (process.env.PLAYWRIGHT_BROWSER_CHANNEL ??
      (process.platform === "win32" ? "chrome" : undefined));
const baseURL = process.env.AUTOMATEX_E2E_BASE_URL ?? "http://localhost:3000";
const vercelBypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
const extraHTTPHeaders = vercelBypassSecret
  ? { "x-vercel-protection-bypass": vercelBypassSecret }
  : undefined;

assertPilotTarget({ ...process.env, AUTOMATEX_E2E_BASE_URL: baseURL });

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
    baseURL,
    browserName: "chromium",
    extraHTTPHeaders,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: process.env.PLAYWRIGHT_DISABLE_VIDEO === "true" ? "off" : "retain-on-failure",
    headless: process.env.PLAYWRIGHT_HEADED === "true" ? false : true,
    channel: browserChannel,
    launchOptions: executablePath ? { executablePath } : undefined,
  },
});
