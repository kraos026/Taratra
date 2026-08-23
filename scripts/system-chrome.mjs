import fs from "node:fs";
import path from "node:path";

export function detectSystemChrome() {
  const candidates = chromeCandidates();
  const executablePath = candidates.find((candidate) => fs.existsSync(candidate));
  return {
    found: Boolean(executablePath),
    executablePath,
    provider: executablePath ? "system-chrome" : "none",
    channel: executablePath ? "chrome" : undefined,
  };
}

export function configureSystemChromeForPlaywright(env) {
  if (env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim()) {
    return {
      provider: "explicit-executable",
      channel: undefined,
      executablePath: env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      found: fs.existsSync(env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH),
    };
  }

  if (process.platform !== "win32") {
    return {
      provider: "playwright-default",
      channel: env.PLAYWRIGHT_BROWSER_CHANNEL,
      executablePath: undefined,
      found: true,
    };
  }

  const chrome = detectSystemChrome();
  if (!chrome.found) return chrome;

  env.PLAYWRIGHT_BROWSER_CHANNEL = "chrome";
  env.AUTOMATEX_SYSTEM_CHROME_PATH = chrome.executablePath;
  return chrome;
}

function chromeCandidates() {
  if (process.platform !== "win32") return [];

  return [
    process.env.ProgramFiles &&
      path.join(process.env.ProgramFiles, "Google", "Chrome", "Application", "chrome.exe"),
    process.env["ProgramFiles(x86)"] &&
      path.join(process.env["ProgramFiles(x86)"], "Google", "Chrome", "Application", "chrome.exe"),
    process.env.LOCALAPPDATA &&
      path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
  ].filter(Boolean);
}
