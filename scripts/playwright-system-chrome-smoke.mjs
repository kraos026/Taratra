import { chromium } from "playwright";
import { configureSystemChromeForPlaywright, detectSystemChrome } from "./system-chrome.mjs";

const baseUrl = process.env.AUTOMATEX_E2E_BASE_URL ?? "http://localhost:3000";
const detected = detectSystemChrome();
const resolved = configureSystemChromeForPlaywright(process.env);

console.log(`SYSTEM CHROME FOUND = ${detected.found ? "YES" : "NO"}`);
console.log(`PLAYWRIGHT BROWSER PROVIDER = ${resolved.provider}`);
console.log(`PLAYWRIGHT BROWSER CHANNEL = ${process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? "NONE"}`);
console.log(`PLAYWRIGHT EXECUTABLE DETECTED = ${resolved.executablePath ? "YES" : "NO"}`);
console.log("PLAYWRIGHT BUNDLED BROWSER REQUIRED = NO");

if (process.platform === "win32" && !detected.found) {
  throw new Error("SYSTEM CHROME FOUND = NO");
}

const launchOptions = {
  headless: process.env.PLAYWRIGHT_HEADED === "true" ? false : true,
};

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
  launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
} else if (process.env.PLAYWRIGHT_BROWSER_CHANNEL) {
  launchOptions.channel = process.env.PLAYWRIGHT_BROWSER_CHANNEL;
}

const browser = await chromium.launch(launchOptions);
try {
  const page = await browser.newPage();
  const response = await page.goto(`${baseUrl}/login`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  const status = response?.status() ?? 0;
  console.log(`PLAYWRIGHT CHROME SMOKE /login = ${status}`);
  if (status < 200 || status >= 500) {
    throw new Error(`PLAYWRIGHT CHROME SMOKE failed with HTTP ${status}`);
  }
} finally {
  await browser.close();
}

console.log("PLAYWRIGHT CHROME SMOKE = PASS");
