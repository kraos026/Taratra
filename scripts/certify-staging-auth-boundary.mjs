import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { detectSystemChrome } from "./system-chrome.mjs";

const ref = "ajvncwsazrhqjlktzojm";
const supabaseUrl = `https://${ref}.supabase.co`;
const preview = process.argv[2];
const sha = process.argv[3];
assert.match(preview ?? "", /^https:\/\/taratra-[a-z0-9]+-optivos\.vercel\.app$/);
assert.match(sha ?? "", /^[a-f0-9]{40}$/);
function cli(command) {
  const r = spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", command], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 60000,
    maxBuffer: 5_000_000,
  });
  assert.equal(r.status, 0, "authenticated CLI unavailable");
  return JSON.parse(r.stdout);
}
const runId = `CERT-STAGING-${Date.now()}-${randomUUID().slice(0, 8)}`;
const evidence = { runId, sha, preview, environment: "STAGING", results: [], identities: [] };
let currentPage;
let browser,
  stage = "preflight";
try {
  const project = cli(
    "npx vercel api /v9/projects/prj_8j7KPE6ifL9P8G8Hs58TrJcXet6a --scope optivos",
  );
  const bypass = Object.keys(project.protectionBypass ?? {})[0];
  assert.ok(bypass, "no existing deployment-protection credential");
  const deployment = cli(
    `npx vercel api /v13/deployments/${new URL(preview).hostname} --scope optivos`,
  );
  assert.notEqual(deployment.target, "production");
  assert.equal(deployment.meta.githubCommitRef, "astra/optivos-finalization-20260914");
  assert.equal(deployment.meta.githubCommitSha, sha);
  const bypassHeaders = { "x-vercel-protection-bypass": bypass };
  const proofResponse = await fetch(`${preview}/api/internal/db-target-check`, {
    headers: bypassHeaders,
    redirect: "error",
  });
  assert.equal(proofResponse.status, 200);
  const proof = await proofResponse.json();
  assert.equal(proof.environment, "preview");
  assert.equal(proof.sha, sha);
  assert.equal(proof.overall, "PREVIEW_ENV_STAGING_COHERENT");
  evidence.results.push("exact SHA preview and three runtime STAGING targets: PASS");
  const keys = cli(`npx supabase projects api-keys --project-ref ${ref} --output json`);
  const adminKey = keys.find((k) => k.name === "service_role")?.api_key;
  const anonKey = keys.find((k) => k.name === "anon")?.api_key;
  assert.ok(adminKey && anonKey);
  const admin = createClient(supabaseUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const settings = await (
    await fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: anonKey } })
  ).json();
  evidence.authSettings = {
    disableSignup: settings.disable_signup,
    mailerAutoconfirm: settings.mailer_autoconfirm,
    emailEnabled: settings.external?.email,
    smtpDelivery: "NOT_PROVEN",
    redirectAllowlist: "NOT_PROVEN",
  };
  browser = await chromium.launch({
    executablePath: detectSystemChrome().executablePath,
    headless: true,
  });
  const pages = [];
  const credentials = [];
  for (const label of ["A", "B"]) {
    stage = `provision-${label}`;
    const password = randomBytes(32).toString("base64url");
    const email = `cert-staging-user-${label.toLowerCase()}-${randomUUID()}@example.invalid`;
    const resumeId = process.env[`OPTIVOS_CERT_RESUME_USER_${label}`];
    if (resumeId) {
      const existing = await admin.auth.admin.getUserById(resumeId);
      assert.equal(existing.data.user?.user_metadata?.label, `CERT-STAGING-USER-${label}`);
      assert.match(existing.data.user?.email ?? "", /^cert-staging-user-[ab]-.*@example\.invalid$/);
    }
    const created = resumeId
      ? await admin.auth.admin.updateUserById(resumeId, { password, email_confirm: true })
      : await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { certification: runId, label: `CERT-STAGING-USER-${label}` },
        });
    assert.equal(created.error, null);
    evidence.identities.push({ label, userId: created.data.user.id });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.route("**/*", (route) => {
      const origin = new URL(route.request().url()).origin;
      if (origin === preview)
        return route.continue({ headers: { ...route.request().headers(), ...bypassHeaders } });
      if (origin === supabaseUrl) return route.continue();
      return route.abort();
    });
    const page = await context.newPage();
    currentPage = page;
    page.on("response", async (response) => {
      if (response.url().startsWith(`${supabaseUrl}/auth/v1/token`)) {
        const body = await response.json().catch(() => ({}));
        evidence.authResponse = {
          status: response.status(),
          errorCode: typeof body.error_code === "string" ? body.error_code : null,
        };
      }
    });
    stage = `login-${label}`;
    await page.goto(`${preview}/login`);
    await page.getByLabel("email", { exact: true }).fill(created.data.user.email);
    await page.getByLabel("password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Se connecter", exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/onboarding" || url.pathname === "/", {
      timeout: 60000,
    });
    stage = `onboarding-${label}`;
    if (new URL(page.url()).pathname === "/onboarding") {
      await page.getByLabel("Nom de votre espace").fill(`${runId}-${label}`);
      await page.getByRole("button", { name: "Créer mon espace", exact: true }).click();
      await page.waitForURL(preview + "/", { timeout: 45000 });
    }
    pages.push(page);
    credentials.push({ email: created.data.user.email, password });
    evidence.results.push(`USER ${label} UI login and workspace access: PASS`);
  }
  async function api(page, path, method = "GET", data, allowed = [200]) {
    assert.ok(path.startsWith("/api/") && !path.startsWith("//"));
    const response = await page.request.fetch(preview + path, {
      method,
      data,
      headers: bypassHeaders,
      maxRedirects: 0,
    });
    (evidence.requests ??= []).push({ method, path, status: response.status() });
    assert.ok(allowed.includes(response.status()), `unexpected API status ${response.status()}`);
    return response;
  }
  stage = "company-create-A";
  const company = await (
    await api(
      pages[0],
      "/api/companies",
      "POST",
      {
        name: `${runId}-Company-A`,
        sectorId: "operations",
        employeeCount: 42,
        companySize: "small",
        primaryContactName: "Certification Owner",
        primaryContactRole: "Operations Director",
        country: "France",
        description: "Synthetic certification dossier, no customer data.",
        status: "client",
      },
      [200, 201],
    )
  ).json();
  const companyId = company.data?.company?.id ?? company.data?.id ?? company.id;
  assert.match(companyId, /^[a-f0-9-]{36}$/);
  evidence.companyId = companyId;
  stage = "isolation-company-and-evidence";
  await api(pages[1], "/api/companies");
  for (const path of [
    `/api/companies/${companyId}`,
    `/api/companies/${companyId}/automation-audit`,
    `/api/companies/${companyId}/automation-audit/evidence-requests`,
    `/api/companies/${companyId}/automation-audit/results`,
    `/api/companies/${companyId}/automation-audit/decision-center`,
  ]) {
    await api(pages[1], path, "GET", undefined, [404]);
  }
  // Collection APIs filter by authenticated organization + company and return an empty page.
  // This is not evidence for denial of populated artifact IDs: the full journey must test those.
  for (const suffix of [
    "analysis",
    "ai-opportunities",
    "automation-opportunities",
    "recommendations",
  ]) {
    const body = await (await api(pages[1], `/api/companies/${companyId}/${suffix}`)).json();
    assert.deepEqual(body.data?.items, []);
    assert.equal(body.data?.total, 0);
  }
  await api(
    pages[1],
    `/api/companies/${companyId}/automation-audit/evidence`,
    "POST",
    {
      requestId: "cert-denied",
      sourceId: runId,
      sourceVersion: 1,
      sourceType: "DOCUMENT",
      rawContent: "Synthetic denied evidence",
      origin: "certification",
    },
    [404],
  );
  await api(
    pages[1],
    `/api/companies/${companyId}`,
    "PATCH",
    { name: `${runId}-FORBIDDEN` },
    [404],
  );
  evidence.results.push(
    "USER B cannot read/mutate USER A company, audit projection or evidence: PASS",
  );
  stage = "discovery-create-A";
  await api(pages[0], `/api/companies/${companyId}/discovery`, "POST", undefined, [200, 201]);
  evidence.results.push("USER A discovery creation: PASS");
  stage = "dashboard-mobile-and-refresh";
  currentPage = pages[0];
  await pages[0].reload();
  await pages[0].getByRole("heading", { name: "Bienvenue dans Optivos" }).waitFor();
  await pages[0].getByText(`${runId}-Company-A`, { exact: true }).waitFor({ timeout: 60000 });
  await pages[0].evaluate(() => document.fonts.ready);
  await pages[0].setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await pages[0].evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
  );
  const directory = join(tmpdir(), "optivos-finalization");
  mkdirSync(directory, { recursive: true });
  await pages[0].screenshot({
    path: join(directory, "staging-dashboard-mobile.png"),
    fullPage: true,
  });
  await pages[0].setViewportSize({ width: 1440, height: 1000 });
  await pages[0].screenshot({
    path: join(directory, "staging-dashboard-desktop.png"),
    fullPage: true,
  });
  const persisted = await (await api(pages[0], `/api/companies/${companyId}`)).json();
  assert.ok(JSON.stringify(persisted).includes(`${runId}-Company-A`));
  evidence.results.push("company persistence after refresh and mobile overflow: PASS");
  stage = "logout-relogin-persistence";
  await api(pages[0], "/api/companies");
  await pages[0].setViewportSize({ width: 390, height: 844 });
  const logoutResponse = pages[0].waitForResponse(
    (response) =>
      response.url() === `${preview}/auth/logout` && response.request().method() === "POST",
  );
  await pages[0].getByRole("button", { name: "Se déconnecter", exact: true }).click();
  assert.equal((await logoutResponse).status(), 303);
  await pages[0].waitForURL(preview + "/login");
  await api(pages[0], `/api/companies/${companyId}`, "GET", undefined, [401]);
  await pages[0].goto(`${preview}/login`);
  await pages[0].getByLabel("email", { exact: true }).fill(credentials[0].email);
  await pages[0].getByLabel("password", { exact: true }).fill(credentials[0].password);
  await pages[0].getByRole("button", { name: "Se connecter", exact: true }).click();
  await pages[0].waitForURL(preview + "/", { timeout: 60000 });
  const afterRelogin = await (await api(pages[0], `/api/companies/${companyId}`)).json();
  assert.ok(JSON.stringify(afterRelogin).includes(`${runId}-Company-A`));
  evidence.results.push("logout revokes local access; re-login restores persisted company: PASS");
  evidence.fullCanonicalJourney = "NOT_RUN";
  evidence.result = "PASS_SCOPED_AUTH_COMPANY_ISOLATION_ONLY";
} catch (error) {
  evidence.lastPath = currentPage ? new URL(currentPage.url()).pathname : null;
  if (currentPage) {
    const directory = join(tmpdir(), "optivos-finalization");
    mkdirSync(directory, { recursive: true });
    await currentPage
      .screenshot({ path: join(directory, "staging-failure.png"), fullPage: true })
      .catch(() => {});
    evidence.pageTitle = await currentPage.title().catch(() => "UNAVAILABLE");
  }
  evidence.result = "FAIL";
  evidence.failedStage = stage;
  evidence.errorKind = error?.name === "TimeoutError" ? "TIMEOUT" : "ASSERTION_OR_ACCESS";
  process.exitCode = 1;
} finally {
  await browser?.close();
  const directory = join(tmpdir(), "optivos-finalization");
  mkdirSync(directory, { recursive: true });
  const path = join(directory, `${runId}.json`);
  writeFileSync(path, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
  console.log(`SAFE EVIDENCE: ${path}`);
  console.log(
    "Credentials stayed in process memory; no plaintext secret file created. Synthetic staging identities/data retained for traceability, no production mutation.",
  );
}
