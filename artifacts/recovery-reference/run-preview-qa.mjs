import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const root = process.cwd();
for (const line of readFileSync(`${root}/.env.local`, "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const index = trimmed.indexOf("=");
  if (index < 0) continue;
  const key = trimmed.slice(0, index).trim();
  let value = trimmed.slice(index + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  process.env[key] = value;
}

const baseURL = process.env.AUTOMATEX_VISUAL_QA_BASE_URL ?? "https://taratra-r08nu3uj7-optivos.vercel.app";
const email = process.env.AUTOMATEX_STAGING_TENANT_A_EMAIL;
const password = process.env.AUTOMATEX_STAGING_TENANT_A_PASSWORD;
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
if (!email || !password) throw new Error("Required staging QA credentials are missing");

const output = `${root}/artifacts/optivos-visual-qa/preview`;
mkdirSync(output, { recursive: true });
const chromeCandidates = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  `${process.env.LOCALAPPDATA ?? ""}/Google/Chrome/Application/chrome.exe`,
];
const executablePath = chromeCandidates.find(existsSync);
if (!executablePath) throw new Error("System Chrome not found");

const browser = await chromium.launch({ executablePath, headless: true });
const report = { baseURL, generatedAt: new Date().toISOString(), viewports: {}, screenshots: [], issues: [] };
let reusableCompanyId;
const sizes = {
  desktop: { width: 1440, height: 1000 },
  tablet: { width: 900, height: 1100 },
  mobile: { width: 412, height: 915 },
};

for (const [label, viewport] of Object.entries(sizes)) {
  const context = await browser.newContext({
    baseURL,
    viewport,
    extraHTTPHeaders: baseURL.includes(".vercel.app") && bypass ? { "x-vercel-protection-bypass": bypass } : undefined,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text().slice(0, 400)); });
  page.on("requestfailed", (request) => failedRequests.push({ url: request.url().replace(/([?&](?:token|secret|key)=)[^&]+/gi, "$1[redacted]"), failure: request.failure()?.errorText }));

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator("body").waitFor({ timeout: 15000 });
  const loginShot = `${output}/${label}-login.png`;
  await page.screenshot({ path: loginShot, fullPage: true });
  report.screenshots.push(loginShot);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|log in|connexion|se connecter/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30000 });

  const companiesResponse = await page.request.get("/api/companies?page=1&pageSize=100&sortBy=updatedAt&sortOrder=desc");
  const companiesPayload = await companiesResponse.json();
  const companyItems = Array.isArray(companiesPayload?.data) ? companiesPayload.data : companiesPayload?.data?.items ?? [];
  let company = reusableCompanyId
    ? companyItems.find((item) => item.id === reusableCompanyId)
    : companyItems.find((item) => String(item.name ?? "").startsWith("Optivos Pilot Company")) ??
      companyItems[0];
  let selectedAuditResponse;
  let selectedAuditPayload;
  for (const candidate of reusableCompanyId
    ? []
    : [
        ...companyItems.filter((item) =>
          String(item.name ?? "").startsWith("Optivos Pilot Company"),
        ),
        ...companyItems.filter(
          (item) => !String(item.name ?? "").startsWith("Optivos Pilot Company"),
        ),
      ]) {
    const response = await page.request.get(`/api/companies/${candidate.id}/automation-audit`);
    if (!response.ok()) continue;
    const payload = await response.json();
    const serialized = JSON.stringify(payload).toLowerCase();
    if (/"overallstatus":"(?:ready|complete|completed)"|"complete":true/.test(serialized)) {
      company = candidate;
      selectedAuditResponse = response;
      selectedAuditPayload = payload;
      break;
    }
  }
  if (!company?.id) throw new Error(`No certification company visible for ${label}`);
  const companyId = company.id;
  reusableCompanyId = companyId;
  const auditResponse = selectedAuditResponse ?? await page.request.get(`/api/companies/${companyId}/automation-audit`);
  const auditPayload = selectedAuditPayload ?? await auditResponse.json();
  const auditText = JSON.stringify(auditPayload);
  const idPattern = /"id":"([0-9a-f-]{16,})"/gi;
  const ids = [...auditText.matchAll(idPattern)].map((match) => match[1]);

  const routes = [
    ["overview", "/"],
    ["companies", "/companies"],
    ["company", `/companies/${companyId}`],
    ["audit", `/companies/${companyId}/automation-audit`],
    ["roi", `/companies/${companyId}/automation-audit`],
    ["discovery", `/companies/${companyId}/discovery`],
    ["interview", `/companies/${companyId}/interview`],
    ["process", `/companies/${companyId}/process-maps`],
    ["opportunities", "/recommendations"],
    ["action-plan", "/recommendations"],
    ["decision-center", `/companies/${companyId}/automation-audit/decision-center`],
    ["results", `/companies/${companyId}/automation-audit/results`],
  ];

  const routeResults = [];
  for (const [name, route] of routes) {
    const response = await page.goto(route, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.locator("body").waitFor({ timeout: 15000 });
    const bodyText = (await page.locator("body").innerText()).slice(0, 30000);
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      clipped: [...document.querySelectorAll("button,a")].filter((el) => {
        const s = getComputedStyle(el); const r = el.getBoundingClientRect();
        return s.visibility !== "hidden" && s.display !== "none" && (r.right > document.documentElement.clientWidth + 2 || r.left < -2);
      }).length,
    }));
    const result = {
      name, route, finalUrl: page.url(), status: response?.status() ?? null,
      contentType: response?.headers()["content-type"] ?? null,
      optivos: /Optivos/i.test(bodyText), automatex: /AutomateX/i.test(bodyText),
      executionVisible: /\bExecution\b|\bWorkflows\b|\bMonitoring\b|\bRuntime\b/i.test(bodyText),
      overflow: metrics.scrollWidth > metrics.clientWidth + 2, clippedControls: metrics.clipped,
      bodyHash: createHash("sha256").update(bodyText).digest("hex").slice(0, 8),
      bodyPreview: bodyText.slice(0, 500).replace(/\s+/g, " "),
    };
    routeResults.push(result);
    if ((response?.status() ?? 500) >= 400) report.issues.push({ viewport: label, severity: "BLOCKER", kind: "route", ...result });
    if (result.overflow || result.clippedControls > 0) report.issues.push({ viewport: label, severity: label === "mobile" ? "HIGH" : "MEDIUM", kind: "responsive", ...result });
    if (result.executionVisible) report.issues.push({ viewport: label, severity: "HIGH", kind: "future-feature-visible", ...result });
    if (["overview", "companies", "company", "audit", "roi", "opportunities", "action-plan", "decision-center", "results"].includes(name)) {
      const shot = `${output}/${label}-${name}.png`;
      await page.screenshot({ path: shot, fullPage: true });
      report.screenshots.push(shot);
    }
  }
  report.viewports[label] = {
    viewport, loginFinalUrl: page.url(), companyId, api: { companies: companiesResponse.status(), audit: auditResponse.status(), ids: ids.length },
    routes: routeResults, consoleErrors: [...new Set(consoleErrors)], failedRequests,
  };
  await context.close();
}

await browser.close();
writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ report: `${output}/report.json`, screenshots: report.screenshots.length, issues: report.issues.length }));
