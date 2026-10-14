import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const require = createRequire(join(root, "package.json"));
const { build, preview } = await import(
  pathToFileURL(require.resolve("vite", { paths: [dirname(require.resolve("vitest"))] })).href
);
const { chromium } = require("@playwright/test");
const tailwind = require("@tailwindcss/postcss");
const fixture = join(root, "artifacts/atelier-ia-component-preview");
const evidence = process.env.OPTIVOS_ATELIER_EVIDENCE_DIR
  ? resolve(process.env.OPTIVOS_ATELIER_EVIDENCE_DIR)
  : join(fixture, "evidence");
mkdirSync(fixture, { recursive: true });
mkdirSync(evidence, { recursive: true });
const companyId = "11111111-1111-4111-8111-111111111111";
const unix = (value) => value.replaceAll("\\", "/");
writeFileSync(
  join(fixture, "index.html"),
  '<!doctype html><html lang="fr"><head><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Optivos — Atelier IA — recette de composants</title></head><body><div id="root"></div><script type="module" src="./entry.tsx"></script></body></html>',
);
writeFileSync(
  join(fixture, "next-link.tsx"),
  'import type {AnchorHTMLAttributes} from "react"; export default function Link(props: AnchorHTMLAttributes<HTMLAnchorElement>) { return <a {...props}/> }',
);
writeFileSync(
  join(fixture, "next-navigation.ts"),
  `export const usePathname = () => '/companies/${companyId}/atelier-ia'; export const useRouter = () => ({push: (url: string) => {location.href=url}});`,
);
writeFileSync(
  join(fixture, "entry.tsx"),
  `import {createRoot} from 'react-dom/client';
import {CompanyShell} from '@/components/dashboard/company-shell';
import {InteractiveDashboard} from '@/components/dashboard/interactive-dashboard';
import {AgentWorkspacePanel} from '@/modules/agent-workspace/presentation/agent-workspace-panel';
import './style.css';
createRoot(document.getElementById('root')!).render(location.search.includes('dashboard') ? <InteractiveDashboard/> : <CompanyShell verifiedCompanyId='${companyId}'><AgentWorkspacePanel company={{id:'${companyId}',name:'Entreprise de démonstration',canSimulate:true}}/></CompanyShell>);`,
);
// Preview only: avoid remote font requests and restrict Tailwind scanning.
const css = readFileSync(join(root, "src/app/globals.css"), "utf8")
  .replace(/^@import url\([^\r\n]+\);\r?\n/m, "")
  .replace(
    '@import "tailwindcss";',
    `@import "tailwindcss" source(none);\n@source "${unix(join(root, "src/modules/agent-workspace/presentation"))}";\n@source "${unix(join(root, "src/components/dashboard"))}";\n@source "${unix(join(root, "src/components/brand"))}";\n@source "${unix(join(root, "src/components/ui/button.tsx"))}";`,
  );
writeFileSync(join(fixture, "style.css"), css);
const config = {
  configFile: false,
  root: fixture,
  logLevel: "error",
  define: { "process.env.NEXT_PUBLIC_OPTIVOS_ATELIER_IA_LAB": '"1"' },
  resolve: {
    alias: [
      { find: "@", replacement: join(root, "src") },
      { find: /^next\/link$/, replacement: join(fixture, "next-link.tsx") },
      { find: /^next\/navigation$/, replacement: join(fixture, "next-navigation.ts") },
      { find: /^react$/, replacement: require.resolve("react") },
      { find: /^react\/jsx-runtime$/, replacement: require.resolve("react/jsx-runtime") },
      { find: /^react-dom\/client$/, replacement: require.resolve("react-dom/client") },
    ],
  },
  css: { postcss: { plugins: [tailwind({ base: root })] } },
  build: { outDir: join(fixture, "dist"), emptyOutDir: false },
};
await build(config);
const http = await preview({ ...config, preview: { host: "127.0.0.1", port: 0 } });
const address = http.httpServer.address();
const base = `http://127.0.0.1:${address.port}`;
let browser;
const checks = [];
const errors = [];
const blocked = [];
let mutationCount = 0;
let connectionCount = 0;
let connectionStatus = 200;
let registryCount = 0;
let registryStatus = 200;
let registryBody = { data: { items: [], hasMore: false } };
let connectionBody = {
  data: {
    state: "connected",
    checkedAt: "2026-10-14T10:00:00.000Z",
    monitoring: { status: true, events: true },
    liveExecution: false,
    modelCalls: 0,
  },
};
try {
  const executablePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
  browser = await chromium.launch({
    headless: true,
    ...(existsSync(executablePath) ? { executablePath } : {}),
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname !== "127.0.0.1") {
      blocked.push(url.origin);
      return route.abort();
    }
    if (request.method() !== "GET") mutationCount++;
    if (url.pathname.endsWith("/atelier-ia/connection")) {
      connectionCount++;
      return route.fulfill({
        status: connectionStatus,
        contentType: "application/json",
        body: JSON.stringify(connectionBody),
      });
    }
    if (url.pathname.endsWith("/atelier-ia/missions")) {
      registryCount++;
      return route.fulfill({
        status: registryStatus,
        contentType: "application/json",
        body: JSON.stringify(registryBody),
      });
    }
    if (url.pathname === "/api/companies")
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ data: { items: [], total: 0 } }),
      });
    if (url.pathname.startsWith("/api/"))
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            company: { id: companyId, name: "Entreprise de démonstration" },
            currentStage: "DISCOVERY",
            overallStatus: "READY",
            stages: [],
            nextAction: "START_DISCOVERY",
            blockingReason: null,
          },
        }),
      });
    return route.continue();
  });
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Vos missions, en toute clarté" }).waitFor();
  assert.equal(
    await page.getByRole("link", { name: "Atelier IA", exact: true }).first().getAttribute("href"),
    `/companies/${companyId}/atelier-ia`,
  );
  checks.push("company-scoped Atelier navigation");
  await page.getByRole("heading", { name: "Commencez ici", exact: true }).waitFor();
  assert.equal(connectionCount, 0);
  assert.equal(registryCount, 0);
  await page.getByRole("button", { name: "Vérifier mon atelier", exact: true }).click();
  await page.getByText("Connexion prête pour le suivi", { exact: true }).waitFor();
  await page.getByText("Aucune mission réelle liée pour le moment", { exact: true }).waitFor();
  assert.equal(connectionCount, 1);
  assert.equal(registryCount, 1);
  await page.screenshot({
    path: join(evidence, "optivos-prise-en-main-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({
    path: join(evidence, "optivos-prise-en-main-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  registryBody = {
    data: {
      items: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          title: "Mission de test",
          created_at: "2026-10-14T10:00:00.000Z",
        },
      ],
      hasMore: false,
    },
  };
  await page.getByRole("button", { name: "Vérifier mon atelier", exact: true }).click();
  await page.getByText("1 mission disponible dans la liste récente", { exact: true }).waitFor();
  registryStatus = 503;
  await page.getByRole("button", { name: "Vérifier mon atelier", exact: true }).click();
  await page.getByText("Liste temporairement indisponible", { exact: true }).waitFor();
  assert.equal(
    await page.getByText("1 mission disponible dans la liste récente", { exact: true }).count(),
    0,
  );
  connectionStatus = 403;
  await page.getByRole("button", { name: "Vérifier mon atelier", exact: true }).click();
  await page.getByText("Vérification indisponible", { exact: true }).waitFor();
  assert.equal(await page.getByText("Connexion prête pour le suivi", { exact: true }).count(), 0);
  connectionStatus = 200;
  registryStatus = 200;
  connectionBody.data.state = "unconfigured";
  await page.getByRole("button", { name: "Vérifier mon atelier", exact: true }).click();
  await page
    .getByText("Configuration à terminer avec votre installateur", { exact: true })
    .waitFor();
  connectionBody.data.state = "connected";
  await page.getByRole("button", { name: "Ouvrir la connexion", exact: true }).click();
  await page.getByRole("heading", { name: "Connexion Hermes", exact: true }).waitFor();
  await page.getByRole("button", { name: "Accueil", exact: true }).click();
  await page.getByRole("button", { name: "Voir l’activité réelle", exact: true }).click();
  await page.getByRole("heading", { name: "Activité réelle", exact: true }).waitFor();
  await page.getByRole("button", { name: "Accueil", exact: true }).click();
  await page.getByRole("button", { name: "Essayer une simulation", exact: true }).click();
  assert.equal(
    await page.locator("#agent-title").evaluate((element) => document.activeElement === element),
    true,
  );
  connectionCount = 0;
  registryCount = 0;
  checks.push(
    "guided setup: no automatic reads, two manual GETs, real empty/nonempty states, failures clear stale readiness, mobile and navigation",
  );

  const desktopNav = page.getByRole("navigation", { name: "Navigation principale", exact: true });
  const auditToggle = desktopNav.getByRole("button", { name: "Audit", exact: true });
  const agentToggle = desktopNav.getByRole("button", {
    name: "Orchestrateur & agents",
    exact: true,
  });
  assert.equal(await auditToggle.getAttribute("aria-expanded"), "false");
  assert.equal(await agentToggle.getAttribute("aria-expanded"), "true");
  assert.equal(
    await desktopNav.getByRole("link", { name: "Mon entreprise", exact: true }).count(),
    0,
  );
  await auditToggle.focus();
  await page.keyboard.press("Enter");
  assert.equal(await auditToggle.getAttribute("aria-expanded"), "true");
  assert.equal(
    await desktopNav.getByRole("link", { name: "Mon entreprise", exact: true }).count(),
    1,
  );
  assert.equal(await desktopNav.getByRole("link", { name: "Résultats", exact: true }).count(), 1);
  assert.equal(
    await desktopNav
      .getByRole("link", { name: "Atelier IA", exact: true })
      .getAttribute("aria-current"),
    "page",
  );
  await page.screenshot({ path: join(evidence, "optivos-navigation-desktop.png"), fullPage: true });
  await auditToggle.click();
  checks.push("audit and agent groups, keyboard toggle and current location");

  await page.screenshot({ path: join(evidence, "optivos-atelier-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: "Préparer la simulation", exact: true }).click();
  await page.getByRole("button", { name: "Valider et simuler", exact: true }).waitFor();
  checks.push("explicit mission validation");
  await page.getByRole("button", { name: "Valider et simuler", exact: true }).click();
  await page.getByText("Terminée · simulation", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Résultats", exact: true }).click();
  await page.getByText("EXEMPLE SIMULÉ", { exact: false }).waitFor();
  checks.push("simulated result and progress");
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  checks.push("mobile without horizontal overflow");
  for (const viewport of [
    { width: 375, height: 812 },
    { width: 844, height: 390 },
    { width: 820, height: 1180 },
  ]) {
    await page.setViewportSize(viewport);
    const menu = page.getByRole("button", { name: "Menu", exact: true });
    await menu.click();
    const mobileNav = page.getByRole("navigation", {
      name: "Navigation principale mobile",
      exact: true,
    });
    assert.equal(
      await mobileNav
        .getByRole("button", { name: "Orchestrateur & agents", exact: true })
        .getAttribute("aria-expanded"),
      "true",
    );
    const auditMenu = mobileNav.getByRole("button", { name: "Audit", exact: true });
    if ((await auditMenu.getAttribute("aria-expanded")) === "false") await auditMenu.click();
    for (const control of await mobileNav.locator("button:visible, a:visible").all()) {
      const box = await control.boundingBox();
      assert.ok(box && box.height >= 44);
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (viewport.width === 375)
      await page.screenshot({
        path: join(evidence, "optivos-navigation-mobile.png"),
        fullPage: true,
      });
    await page.keyboard.press("Escape");
    assert.equal(await menu.getAttribute("aria-expanded"), "false");
    assert.equal(await menu.evaluate((element) => document.activeElement === element), true);
    assert.equal(
      await page
        .getByRole("navigation", { name: "Navigation principale mobile", exact: true })
        .count(),
      0,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  checks.push("375px, landscape and tablet menus, 44px targets, Escape restores focus");

  await page.screenshot({ path: join(evidence, "optivos-atelier-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Réglages", exact: true }).click();
  await page
    .getByText("0 € d’appels IA ; aucune activation payante disponible.", { exact: true })
    .waitFor();
  checks.push("live execution stays disabled");
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Missions", exact: true }).click();
  await page.getByText("Aucune mission dans cette rubrique.", { exact: false }).waitFor();
  checks.push("no cross-session mission persistence");
  await page.getByRole("button", { name: "Connexion", exact: true }).click();
  assert.equal(connectionCount, 0);
  const checkConnection = page.getByRole("button", { name: "Vérifier la connexion", exact: true });
  await checkConnection.click();
  await page.getByRole("status").filter({ hasText: "Connexion Hermes vérifiée" }).waitFor();
  assert.equal(connectionCount, 1);
  await page.screenshot({ path: join(evidence, "optivos-hermes-connexion.png"), fullPage: true });
  for (const [state, label] of [
    ["unconfigured", "Connexion non configurée"],
    ["unlinked", "Ce dossier n’est pas lié à Hermes"],
    ["unavailable", "Hermes est temporairement indisponible"],
  ]) {
    connectionBody = {
      data: {
        state,
        checkedAt: "2026-10-14T10:00:00.000Z",
        monitoring: { status: false, events: false },
        liveExecution: false,
        modelCalls: 0,
      },
    };
    await checkConnection.click();
    await page.getByRole("status").filter({ hasText: label }).waitFor();
    assert.equal(await page.getByText("disponible dans Hermes", { exact: true }).count(), 0);
  }
  connectionStatus = 403;
  await checkConnection.click();
  await page.getByRole("status").filter({ hasText: "Vérification impossible" }).waitFor();
  connectionStatus = 200;
  connectionBody = { data: { state: "connected", liveExecution: true } };
  await checkConnection.click();
  await page.getByRole("status").filter({ hasText: "Vérification impossible" }).waitFor();
  assert.equal(connectionCount, 6);
  checks.push(
    "manual health only, four connection states, access failure and invalid live response",
  );
  await page.goto(`${base}/?dashboard`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Bienvenue dans Optivos", exact: true }).waitFor();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const rootNav = page.getByRole("navigation", {
    name: "Navigation principale mobile",
    exact: true,
  });
  await rootNav.getByRole("button", { name: "Audit", exact: true }).click();
  assert.equal(
    await rootNav.getByRole("link", { name: "Mon entreprise", exact: true }).getAttribute("href"),
    "/companies",
  );
  await rootNav.getByRole("button", { name: "Orchestrateur & agents", exact: true }).click();
  assert.equal(
    await rootNav.getByRole("link", { name: "Atelier IA", exact: true }).getAttribute("href"),
    "/atelier-ia",
  );
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({
    path: join(evidence, "optivos-accueil-navigation-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  assert.equal(
    await page.getByRole("navigation", { name: "Navigation principale", exact: true }).count(),
    1,
  );
  checks.push("overview dashboard uses the same grouped desktop and mobile navigation");
  assert.equal(errors.length, 0);
  assert.equal(blocked.length, 0);
  assert.equal(mutationCount, 0);
  checks.push("no JS errors, remote requests or mutations");
  writeFileSync(
    join(evidence, "component-preview.json"),
    JSON.stringify(
      {
        passed: true,
        checks,
        kind: "component fixture with mocked company navigation",
        realSupabaseAuth: false,
        hermesHealthMocked: true,
        databaseMutations: 0,
        externalModelCalls: 0,
        stagingCertified: false,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: true, checks, evidence }, null, 2));
} finally {
  await browser?.close();
  await new Promise((resolve) => http.httpServer.close(resolve));
}
