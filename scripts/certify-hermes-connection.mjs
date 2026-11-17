import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "@playwright/test";
import pg from "pg";
import {
  assertLocalCertificationEnv,
  certificationEnv,
  LOCAL_E2E_USERS,
  readSupabaseStatus,
  stopProcessTree,
} from "./local-certification-support.mjs";

// Local Auth/RLS + Hermes consultation only; optional privileged historical test-run registration.
const repository = resolve(import.meta.dirname, "..");
const generatedSnapshots = new Map(
  ["AGENTS.md", "next-env.d.ts"].map((file) => [file, readFileSync(join(repository, file))]),
);
const bridgePath = process.env.OPTIVOS_HERMES_BRIDGE_CONFIG;
const origin = process.env.OPTIVOS_HERMES_EXISTING_TUNNEL_URL;
if (!bridgePath || !origin)
  throw new Error("Existing private bridge configuration and tunnel URL are required.");
const bridge = JSON.parse(readFileSync(bridgePath, "utf8"));
const url = new URL(origin);
if (
  url.protocol !== "http:" ||
  url.hostname !== "127.0.0.1" ||
  url.pathname !== "/" ||
  url.username ||
  url.password ||
  url.search ||
  url.hash
)
  throw new Error("Only an existing local private tunnel is permitted.");
const values = readSupabaseStatus();
if (!values) throw new Error("Start the existing local Supabase stack before this recipe.");
const env = certificationEnv(values);
assertLocalCertificationEnv(env);
const database = new pg.Client({ connectionString: env.DATABASE_URL });
await database.connect();
let companies;
try {
  companies = (
    await database.query(
      "select id, name, organization_id from public.companies where name = ANY($1) and deleted_at is null",
      [[LOCAL_E2E_USERS.tenantA.companyName, LOCAL_E2E_USERS.tenantB.companyName]],
    )
  ).rows;
} finally {
  await database.end();
}
const companyA = companies.filter((row) => row.name === LOCAL_E2E_USERS.tenantA.companyName);
const companyB = companies.filter((row) => row.name === LOCAL_E2E_USERS.tenantB.companyName);
assert.equal(companyA.length, 1, "Exactly one existing local company A is required.");
assert.equal(companyB.length, 1, "Exactly one existing local company B is required.");
const privateKey = execFileSync(
  bridge.powerShell || "powershell.exe",
  [
    "-NoProfile",
    "-NonInteractive",
    "-File",
    join(dirname(bridgePath), "Read-Key.ps1"),
    "-Path",
    bridge.keyFile,
  ],
  { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
).trim();
if (!privateKey) throw new Error("Existing encrypted bridge key is unavailable.");
Object.assign(env, {
  NEXT_PUBLIC_OPTIVOS_ATELIER_IA_LAB: "1",
  VERCEL_ENV: "",
  OPTIVOS_HERMES_COMPANY_ID: companyA[0].id,
  OPTIVOS_HERMES_API_URL: origin,
  OPTIVOS_HERMES_API_KEY: privateKey,
  NODE_OPTIONS: "--max-old-space-size=1536",
});
const output = process.env.OPTIVOS_HERMES_EVIDENCE_DIR
  ? resolve(process.env.OPTIVOS_HERMES_EVIDENCE_DIR)
  : join(repository, "artifacts/hermes-connection-live");
mkdirSync(output, { recursive: true });
const appUrl = "http://127.0.0.1:3000";
const sanitize = (value) =>
  String(value)
    .replaceAll(privateKey, "[REDACTED]")
    .replace(/eyJ[A-Za-z0-9._-]+/g, "[REDACTED_JWT]")
    .replace(/postgres(?:ql)?:\/\/\S+/g, "[REDACTED_DATABASE_URL]");
let app;
let browser;
const checks = [];
const testRunId = process.env.OPTIVOS_HERMES_CERT_RUN_ID;
let testLinkId = null;
const errors = [];
try {
  if (testRunId) {
    assert.match(testRunId, /^run_[0-9a-f]{32}$/);
    const verifiedRunResponse = await fetch(new URL(`/v1/runs/${testRunId}`, origin), {
      method: "GET",
      headers: { Authorization: `Bearer ${privateKey}` },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    assert.equal(verifiedRunResponse.status, 200);
    const verifiedRun = await verifiedRunResponse.json();
    assert.equal(verifiedRun.object, "hermes.run");
    assert.equal(verifiedRun.run_id, testRunId);
    assert.equal(
      verifiedRun.status,
      "completed",
      "Only the known completed historical test run may be registered by this local recipe.",
    );
    const registry = new pg.Client({ connectionString: env.DATABASE_URL });
    await registry.connect();
    try {
      await registry.query(
        "insert into public.agent_mission_links(organization_id,company_id,run_id,title) values($1,$2,$3,$4) on conflict(run_id) do nothing",
        [
          companyA[0].organization_id,
          companyA[0].id,
          testRunId,
          "Test historique de connexion Hermes",
        ],
      );
      const registered = await registry.query(
        "select id from public.agent_mission_links where run_id=$1 and company_id=$2 and organization_id=$3",
        [testRunId, companyA[0].id, companyA[0].organization_id],
      );
      assert.equal(
        registered.rows.length,
        1,
        "An existing run cannot be reassigned to another company.",
      );
      testLinkId = registered.rows[0].id;
    } finally {
      await registry.end();
    }
    checks.push("historical completed test run linked once by a privileged local operator");
  }
  try {
    await fetch(`${appUrl}/login`, { signal: AbortSignal.timeout(1000) });
    throw new Error("Recipe port is already occupied.");
  } catch (error) {
    if (error.message === "Recipe port is already occupied.") throw error;
  }
  app = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--webpack",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3000",
    ],
    {
      cwd: repository,
      env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  app.on("error", () => errors.push("Local app failed to start."));
  app.stdout.on("data", () => {});
  app.stderr.on("data", (data) => {
    if (/Error|error/.test(String(data))) errors.push(sanitize(data).slice(0, 1500));
  });
  const deadline = Date.now() + 120_000;
  let ready = false;
  while (Date.now() < deadline) {
    if (app.exitCode !== null) throw new Error("Local app exited before the recipe.");
    try {
      const response = await fetch(`${appUrl}/login`, { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((done) => setTimeout(done, 500));
  }
  if (!ready) throw new Error("Local app startup exceeded the recipe deadline.");
  browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const anonymous = await browser.newContext();
  const endpoint = (id) => `${appUrl}/api/companies/${id}/atelier-ia/connection`;
  const anonymousResponse = await anonymous.request.get(endpoint(companyA[0].id));
  assert.equal(anonymousResponse.status(), 401, "A real anonymous request must be rejected.");
  checks.push("anonymous request rejected before Hermes");
  async function accountContext(user) {
    const cookies = [];
    const client = createServerClient(values.apiUrl, values.anonKey, {
      cookies: {
        getAll: () => cookies,
        setAll: (rows) => {
          for (const row of rows) {
            const old = cookies.findIndex((item) => item.name === row.name);
            if (old >= 0) cookies.splice(old, 1);
            cookies.push(row);
          }
        },
      },
    });
    const result = await client.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });
    assert.equal(result.error, null, "Real local certification account must sign in.");
    assert.ok(result.data.user?.id);
    const context = await browser.newContext();
    await context.addCookies(
      cookies.map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
        url: appUrl,
        httpOnly: cookie.options?.httpOnly ?? false,
        secure: false,
        sameSite: "Lax",
      })),
    );
    return context;
  }
  const tenantA = await accountContext(LOCAL_E2E_USERS.tenantA);
  const tenantB = await accountContext(LOCAL_E2E_USERS.tenantB);
  const actual = await tenantA.request.get(endpoint(companyA[0].id));
  assert.equal(actual.status(), 200);
  const data = (await actual.json()).data;
  assert.equal(data.state, "connected");
  assert.equal(data.liveExecution, false);
  assert.equal(data.modelCalls, 0);
  assert.ok(!JSON.stringify(data).includes(privateKey));
  assert.equal(actual.headers()["cache-control"], "private, no-store");
  checks.push("authenticated Optivos server connects to native Hermes health, without inference");
  const denied = await tenantB.request.get(endpoint(companyA[0].id));
  assert.ok([403, 404].includes(denied.status()));
  checks.push("tenant B cannot read tenant A connection");
  const unlinked = await tenantB.request.get(endpoint(companyB[0].id));
  assert.equal(unlinked.status(), 200);
  assert.equal((await unlinked.json()).data.state, "unlinked");
  checks.push("tenant B own company is not linked to tenant A Hermes");
  const page = await tenantA.newPage();
  await page.goto(`${appUrl}/companies/${companyA[0].id}/atelier-ia`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Vérifier mon atelier", exact: true }).click();
  await page.getByText("Connexion prête pour le suivi", { exact: true }).waitFor();
  if (testLinkId)
    await page.getByText("1 mission disponible dans la liste récente", { exact: true }).waitFor();
  await page.screenshot({
    path: join(output, "optivos-prise-en-main-authenticated.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Ouvrir la connexion", exact: true }).click();
  checks.push("guided setup verifies real private connection and persisted company mission list");
  await page.getByRole("button", { name: "Vérifier la connexion", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Connexion Hermes vérifiée" }).waitFor();
  await page.screenshot({ path: join(output, "optivos-hermes-authenticated.png"), fullPage: true });
  checks.push("real authenticated UI verifies Hermes health");
  if (testLinkId) {
    const missionBase = (id) => `${appUrl}/api/companies/${id}/atelier-ia/missions`;
    const list = await tenantA.request.get(missionBase(companyA[0].id));
    assert.equal(list.status(), 200);
    const listed = (await list.json()).data.items;
    assert.ok(listed.some((row) => row.id === testLinkId));
    assert.ok(!JSON.stringify(listed).includes(testRunId));
    const observation = await tenantA.request.get(
      `${missionBase(companyA[0].id)}/${testLinkId}/status`,
    );
    assert.equal(observation.status(), 200);
    assert.equal((await observation.json()).data.status, "completed");
    const cross = await tenantB.request.get(`${missionBase(companyA[0].id)}/${testLinkId}/status`);
    assert.ok([403, 404].includes(cross.status()));
    const ownWrong = await tenantB.request.get(
      `${missionBase(companyB[0].id)}/${testLinkId}/status`,
    );
    assert.equal(ownWrong.status(), 404);
    const rawId = await tenantA.request.get(`${missionBase(companyA[0].id)}/${testRunId}/status`);
    assert.equal(rawId.status(), 404);
    const claimed = await tenantA.request.post(missionBase(companyA[0].id), {
      data: { run_id: testRunId },
    });
    assert.equal(claimed.status(), 405);
    checks.push(
      "persisted link resolves native completed state; foreign company, raw IDs and client registration denied",
    );
    for (const reload of [false, true]) {
      if (reload) await page.reload({ waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Missions", exact: true }).click();
      await page.getByText("Suivi réel · lecture seule", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Charger les missions liées", exact: true }).click();
      await page
        .getByRole("heading", { name: "Test historique de connexion Hermes", exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Vérifier l’état", exact: true }).click();
      await page.getByRole("status").filter({ hasText: "Terminée · état Hermes" }).waitFor();
    }
    await page.screenshot({
      path: join(output, "optivos-hermes-mission-live.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({
      path: join(output, "optivos-hermes-mission-mobile.png"),
      fullPage: true,
    });
    checks.push("real mission state in authenticated UI persists after reload and fits mobile");
  }

  writeFileSync(
    join(output, testLinkId ? "live-missions.json" : "live-connection.json"),
    JSON.stringify(
      {
        passed: true,
        commit: execFileSync("git", ["rev-parse", "HEAD"], {
          cwd: repository,
          encoding: "utf8",
        }).trim(),
        environment: "LOCAL",
        supabaseAuth: "REAL local certification accounts",
        hermesHealth: "REAL via existing private tunnel",
        checks,
        modelCalls: 0,
        newMigrations: 0,
        directBusinessWritesByRecipe: testLinkId
          ? "one local registry link, idempotent; no existing business data changed"
          : 0,
        authSessionWrites: true,
        production: "NOT CERTIFIED",
        secretStoredInFiles: false,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: true, checks, output }, null, 2));
} catch (error) {
  writeFileSync(
    join(output, "live-connection-failure.json"),
    JSON.stringify(
      {
        passed: false,
        checks,
        error: sanitize(error.message),
        appErrors: errors,
        environment: "LOCAL",
        modelCalls: 0,
      },
      null,
      2,
    ),
  );
  throw new Error(sanitize(error.message));
} finally {
  await browser?.close();
  stopProcessTree(app);
  delete env.OPTIVOS_HERMES_API_KEY;
  // Next dev adds its guidance and generated type imports. Restore only these exact owned edits.
  for (const [file, original] of generatedSnapshots) {
    const current = readFileSync(join(repository, file), "utf8").replaceAll("\r\n", "\n");
    const before = original.toString("utf8").replaceAll("\r\n", "\n");
    const ownedAgentAppend =
      file === "AGENTS.md" &&
      current.startsWith(before) &&
      /^\s*<!-- BEGIN:nextjs-agent-rules -->[\s\S]*<!-- END:nextjs-agent-rules -->\s*$/.test(
        current.slice(before.length),
      );
    const ownedTypeUpdate =
      file === "next-env.d.ts" &&
      current ===
        before.replace(
          'import "./.next/types/routes.d.ts";',
          'import "./.next/dev/types/routes.d.ts";\nimport "./.next/dev/types/root-params.d.ts";',
        );
    if (ownedAgentAppend || ownedTypeUpdate) writeFileSync(join(repository, file), original);
  }
}
