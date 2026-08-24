import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

export const LOCAL_APP_URL = "http://localhost:3000";
export const LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:55022/postgres";
export const LOCAL_SUPABASE_URL = "http://127.0.0.1:55021";
export const LOCAL_PROJECT_REF = "local";

export const LOCAL_E2E_USERS = {
  tenantA: {
    email: "tenant-a.certification@automatex.local",
    password: "AutomateX-local-certification-A-2026!",
    organizationName: "AutomateX Certification Tenant A",
    companyName: "AutomateX Certification Company A",
  },
  tenantB: {
    email: "tenant-b.certification@automatex.local",
    password: "AutomateX-local-certification-B-2026!",
    organizationName: "AutomateX Certification Tenant B",
    companyName: "AutomateX Certification Company B",
  },
};

export function certificationEnv(values) {
  const anonKey = values.anonKey;
  const serviceRoleKey = values.serviceRoleKey;
  return {
    ...process.env,
    AUTOMATEX_CERTIFICATION_DB: "true",
    AUTOMATEX_CERTIFICATION_TARGET: "local",
    AUTOMATEX_E2E_BASE_URL: LOCAL_APP_URL,
    DATABASE_URL: LOCAL_DB_URL,
    DIRECT_URL: LOCAL_DB_URL,
    NEXT_PUBLIC_SUPABASE_URL: values.apiUrl ?? LOCAL_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: anonKey,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    SUPABASE_PROJECT_REF: LOCAL_PROJECT_REF,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    E2E_USER_A_EMAIL: LOCAL_E2E_USERS.tenantA.email,
    E2E_USER_A_PASSWORD: LOCAL_E2E_USERS.tenantA.password,
    E2E_USER_B_EMAIL: LOCAL_E2E_USERS.tenantB.email,
    E2E_USER_B_PASSWORD: LOCAL_E2E_USERS.tenantB.password,
    PLAYWRIGHT_DISABLE_VIDEO: process.env.PLAYWRIGHT_DISABLE_VIDEO ?? "true",
  };
}

export function certificationEnvFromProcess() {
  return certificationEnv({
    apiUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}

export function cleanNextArtifacts() {
  const nextDir = path.join(process.cwd(), ".next");
  fs.rmSync(nextDir, { recursive: true, force: true });
}

export function assertLocalCertificationEnv(env) {
  const database = parseUrl(env.DATABASE_URL, "DATABASE_URL");
  const direct = parseUrl(env.DIRECT_URL, "DIRECT_URL");
  const supabase = parseUrl(env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
  assertLocalPostgres(database, "DATABASE_URL");
  assertLocalPostgres(direct, "DIRECT_URL");
  if (!["127.0.0.1", "localhost"].includes(supabase.hostname) || supabase.port !== "55021")
    throw new Error(
      "LOCAL CERTIFICATION GUARD: NEXT_PUBLIC_SUPABASE_URL must target local Supabase",
    );
  if (env.AUTOMATEX_E2E_BASE_URL !== LOCAL_APP_URL)
    throw new Error(
      "LOCAL CERTIFICATION GUARD: AUTOMATEX_E2E_BASE_URL must be http://localhost:3000",
    );
  if (env.SUPABASE_PROJECT_REF !== LOCAL_PROJECT_REF)
    throw new Error("LOCAL CERTIFICATION GUARD: SUPABASE_PROJECT_REF must be local");
}

export async function ensureLocalSupabase() {
  let values = readSupabaseStatus();
  if (!values) {
    console.log("LOCAL SUPABASE: starting minimal local stack");
    const supabase = executableForPlatform("npx");
    const started = spawnSync(
      supabase.command,
      [...supabase.argsPrefix, "supabase", "start", "-x", "studio,imgproxy,edge-runtime,vector"],
      {
        encoding: "utf8",
        shell: false,
      },
    );
    if (started.status !== 0) {
      const output = `${started.error?.message ?? ""}\n${started.stderr ?? ""}\n${started.stdout ?? ""}`;
      throw new Error(`LOCAL SUPABASE: start failed (${sanitizeSupabaseOutput(output)})`);
    }
    values = readSupabaseStatus();
  }
  if (!values) throw new Error("LOCAL SUPABASE: status unavailable after start");
  if ((values.apiUrl ?? LOCAL_SUPABASE_URL) !== LOCAL_SUPABASE_URL)
    throw new Error("LOCAL SUPABASE: API URL is not local");
  if (!values.anonKey || !values.serviceRoleKey)
    throw new Error("LOCAL SUPABASE: local API keys unavailable");
  return values;
}

export function readSupabaseStatus() {
  const supabase = executableForPlatform("npx");
  const status = spawnSync(
    supabase.command,
    [...supabase.argsPrefix, "supabase", "status", "-o", "env"],
    {
      encoding: "utf8",
      shell: false,
    },
  );
  if (status.status !== 0) return null;
  const values = parseEnvOutput(status.stdout);
  return {
    apiUrl: values.API_URL ?? values.SUPABASE_URL ?? LOCAL_SUPABASE_URL,
    dbUrl: values.DB_URL,
    anonKey: values.ANON_KEY,
    serviceRoleKey: values.SERVICE_ROLE_KEY,
  };
}

export async function ensureAutomatexApp(env) {
  return startProductionApp(env);
}

export async function startProductionApp(env) {
  if ((await portOpen("127.0.0.1", 3000)) || (await portOpen("::1", 3000)))
    throw new Error("LOCAL APP: port 3000 is busy; certification requires an owned server");

  console.log("LOCAL APP: starting production server on http://localhost:3000");
  const npm = executableForPlatform("npm");
  const child = spawn(
    npm.command,
    [...npm.argsPrefix, "run", "start", "--", "-H", "localhost", "-p", "3000"],
    {
      env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.on("data", (data) => {
    const text = data.toString();
    if (/ready|started|local/i.test(text)) process.stdout.write(text);
  });
  child.stderr.on("data", (data) => process.stderr.write(sanitizeSupabaseOutput(data.toString())));
  await waitForAppReadiness(90_000);
  return child;
}

export function stopProcessTree(child) {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], {
      encoding: "utf8",
      shell: false,
      stdio: "ignore",
    });
    return;
  }
  child.kill();
}

export async function waitForLocalLogin(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await localLoginReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`HTTP readiness timed out: ${LOCAL_APP_URL}/login`);
}

export async function localLoginReady() {
  return await httpReady(`${LOCAL_APP_URL}/login`, 200);
}

export async function waitForAppReadiness(timeoutMs) {
  const checks = [
    { path: "/login", expectedStatus: 200, expectedContentType: "text/html" },
    { path: "/api/companies", expectedStatus: 401, expectedContentType: "application/json" },
    {
      path: "/api/companies/00000000-0000-0000-0000-000000000000/automation-audit/decision-center",
      expectedStatus: 401,
      expectedContentType: "application/json",
    },
  ];
  const start = Date.now();
  let last = "";
  while (Date.now() - start < timeoutMs) {
    const results = [];
    for (const check of checks) {
      const result = await httpCheck(`${LOCAL_APP_URL}${check.path}`);
      results.push(`${check.path}:${result.status}:${result.contentType}`);
      if (
        result.status !== check.expectedStatus ||
        !result.contentType.includes(check.expectedContentType)
      )
        break;
    }
    if (results.length === checks.length) return;
    last = results.join(", ");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`LOCAL APP readiness timed out: ${last}`);
}

export async function waitForHttp(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await httpReady(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`HTTP readiness timed out: ${url}`);
}

export async function httpReady(url, expectedStatus) {
  const result = await httpCheck(url);
  return expectedStatus === undefined
    ? result.status >= 200 && result.status < 500
    : result.status === expectedStatus;
}

export async function httpCheck(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(url, { redirect: "manual", signal: controller.signal });
    return {
      status: response.status,
      contentType: response.headers.get("content-type") ?? "",
    };
  } catch {
    return { status: 0, contentType: "" };
  } finally {
    clearTimeout(timeout);
  }
}

export function runChecked(command, args, env) {
  const executable = executableForPlatform(command);
  const result = spawnSync(executable.command, [...executable.argsPrefix, ...args], {
    stdio: "inherit",
    shell: false,
    env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

export function runCheckedCapture(command, args, env) {
  const executable = executableForPlatform(command);
  const result = spawnSync(executable.command, [...executable.argsPrefix, ...args], {
    encoding: "utf8",
    shell: false,
    env,
  });
  if (result.status !== 0) {
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
    throw new Error(`${command} ${args.join(" ")} failed: ${sanitizeSupabaseOutput(output)}`);
  }
  return result.stdout;
}

function executableForPlatform(command) {
  if (process.platform !== "win32") return { command, argsPrefix: [] };
  if (command === "npm") return nodeCliExecutable("npm-cli.js");
  if (command === "npx") return nodeCliExecutable("npx-cli.js");
  return { command, argsPrefix: [] };
}

function nodeCliExecutable(cliFileName) {
  const cliPath = path.join(
    path.dirname(process.execPath),
    "node_modules",
    "npm",
    "bin",
    cliFileName,
  );
  if (!fs.existsSync(cliPath))
    return { command: cliFileName === "npm-cli.js" ? "npm.cmd" : "npx.cmd", argsPrefix: [] };
  return { command: process.execPath, argsPrefix: [cliPath] };
}

export function logPresence(env) {
  const rows = [
    ["AUTOMATEX_E2E_BASE_URL", env.AUTOMATEX_E2E_BASE_URL],
    ["DATABASE_URL", env.DATABASE_URL],
    ["DIRECT_URL", env.DIRECT_URL],
    ["NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", env.NEXT_PUBLIC_SUPABASE_ANON_KEY],
    ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY],
    ["SUPABASE_PROJECT_REF", env.SUPABASE_PROJECT_REF],
    ["E2E Tenant A user vars", env.E2E_USER_A_EMAIL && env.E2E_USER_A_PASSWORD],
    ["E2E Tenant B user vars", env.E2E_USER_B_EMAIL && env.E2E_USER_B_PASSWORD],
  ];
  for (const [name, value] of rows) console.log(`${name} = ${value ? "PRESENT" : "MISSING"}`);
}

function parseUrl(value, name) {
  if (!value) throw new Error(`LOCAL CERTIFICATION GUARD: missing ${name}`);
  try {
    return new URL(value);
  } catch {
    throw new Error(`LOCAL CERTIFICATION GUARD: invalid ${name}`);
  }
}

function assertLocalPostgres(url, name) {
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "55022")
    throw new Error(`LOCAL CERTIFICATION GUARD: ${name} must target 127.0.0.1:55022`);
}

function parseEnvOutput(output) {
  const values = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return values;
}

async function portOpen(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: 1000 });
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => resolve(false));
  });
}

function sanitizeSupabaseOutput(value) {
  return String(value ?? "")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[REDACTED_DATABASE_URL]")
    .replace(/eyJ[a-zA-Z0-9._-]+/g, "[REDACTED_JWT]")
    .replace(/service_role key:.*$/gim, "service_role key: [REDACTED]")
    .replace(/anon key:.*$/gim, "anon key: [REDACTED]");
}
