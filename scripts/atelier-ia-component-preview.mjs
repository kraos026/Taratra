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
  `export const usePathname = () => location.search.includes('enterprise') ? '/atelier-ia/entreprises' : '/companies/${companyId}/atelier-ia'; export const useRouter = () => ({push: (url: string) => {location.href=url}});`,
);
writeFileSync(
  join(fixture, "entry.tsx"),
  `import {createRoot} from 'react-dom/client';
import {CompanyShell} from '@/components/dashboard/company-shell';
import {InteractiveDashboard} from '@/components/dashboard/interactive-dashboard';
import {AgentWorkspacePanel} from '@/modules/agent-workspace/presentation/agent-workspace-panel';
import {AgentCompanyPanel} from '@/modules/agent-workspace/presentation/agent-company-panel';
import './style.css';
createRoot(document.getElementById('root')!).render(location.search.includes('dashboard') ? <InteractiveDashboard/> : location.search.includes('enterprise') ? <CompanyShell><AgentCompanyPanel initial={[]} companies={[{id:'${companyId}',name:'Entreprise de recette'}]} canWrite={true}/></CompanyShell> : <CompanyShell verifiedCompanyId='${companyId}'><AgentWorkspacePanel company={{id:'${companyId}',name:'Entreprise de démonstration',canWrite:true}}/></CompanyShell>);`,
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
let teamRows = [];
let teamWrites = 0;
let pilotReads = 0;
let pilotWrites = 0;
let pilotReadinessStatus = 503;
const pilotRequestIds = [];
let pilotRows = [];
const reviewRequestIds = [];
let inventoryCount = 0;
let inventoryStatus = 200;
let inventoryBody = {
  data: {
    checkedAt: "2026-10-14T10:00:00.000Z",
    skills: {
      state: "available",
      items: [{ name: "research", description: "Sources vérifiables" }],
    },
    toolsets: {
      state: "available",
      items: [{ name: "web", label: "Recherche Web", enabled: true, configured: false }],
    },
    modelCalls: 0,
  },
};
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
    if (/^\/api\/atelier-ia\/entreprises\/[^/]+\/readiness$/.test(url.pathname)) {
      pilotReads++;
      return route.fulfill({
        status: pilotReadinessStatus,
        contentType: "application/json",
        body: JSON.stringify(
          pilotReadinessStatus === 200
            ? {
                data: {
                  state: "ready",
                  toolsAllowed: 0,
                  fallbackAllowed: false,
                  policy: {
                    model: "nvidia/nemotron-3.5-lightning:free",
                    checkedAt: 1792080000,
                    pricing: { prompt: "0", completion: "0" },
                  },
                },
              }
            : { error: { message: "Pilote temporairement indisponible." } },
        ),
      });
    }
    if (
      /^\/api\/atelier-ia\/entreprises\/[^/]+\/missions\/[0-9a-f-]+\/review$/.test(url.pathname)
    ) {
      pilotWrites++;
      const row = pilotRows.find((item) => item.id === url.pathname.split("/").at(-2));
      const input = request.postDataJSON();
      reviewRequestIds.push(input.id);
      row.reviews ||= [];
      if (!row.reviews.some((entry) => entry.id === input.id))
        row.reviews.push({
          id: input.id,
          decision: input.decision,
          comment: input.comment,
          created_at: 1792080001,
        });
      return route.fulfill({
        status: reviewRequestIds.length === 1 ? 503 : 200,
        contentType: "application/json",
        body: JSON.stringify(
          reviewRequestIds.length === 1
            ? { error: { message: "Enregistrement incertain" } }
            : { data: row },
        ),
      });
    }
    if (/^\/api\/atelier-ia\/entreprises\/[^/]+\/missions\/[0-9a-f-]+\/stop$/.test(url.pathname)) {
      pilotWrites++;
      const row = pilotRows.find((item) => item.id === url.pathname.split("/").at(-2));
      row.status = "stopping";
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ data: { stopping: true } }),
      });
    }
    if (/^\/api\/atelier-ia\/entreprises\/[^/]+\/missions$/.test(url.pathname)) {
      if (request.method() === "POST") {
        pilotWrites++;
        const input = request.postDataJSON();
        pilotRequestIds.push(input.id);
        assert.deepEqual(Object.keys(input).sort(), ["id", "prompt"]);
        let row = pilotRows.find((item) => item.id === input.id);
        if (!row) {
          row = {
            ...input,
            status: "queued",
            created_at: 1792080000,
            updated_at: 1792080000,
            output: null,
            error: null,
            proof: null,
          };
          pilotRows.push(row);
        }
        return route.fulfill({
          status: pilotRequestIds.length === 1 ? 503 : 202,
          contentType: "application/json",
          body: JSON.stringify(
            pilotRequestIds.length === 1
              ? { error: { message: "Accusé de réception perdu : reprenez la même demande." } }
              : { data: row },
          ),
        });
      }
      pilotReads++;
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ data: { items: pilotRows, hasMore: false } }),
      });
    }
    if (
      url.pathname.endsWith("/atelier-ia/connection") ||
      /^\/api\/atelier-ia\/entreprises\/[^/]+\/connection$/.test(url.pathname)
    ) {
      connectionCount++;
      return route.fulfill({
        status: connectionStatus,
        contentType: "application/json",
        body: JSON.stringify(connectionBody),
      });
    }
    if (url.pathname === "/api/atelier-ia/entreprises" && request.method() === "POST") {
      teamWrites++;
      const input = request.postDataJSON();
      assert.equal(Object.hasOwn(input, "organization_id"), false);
      assert.equal(Object.hasOwn(input, "status"), false);
      const row = {
        ...input,
        company_id: input.companyId,
        status: "preparation",
        api_budget_euro: 0,
        concurrency_limit: 1,
        created_at: "2026-10-14T10:00:00Z",
      };
      teamRows = [row, ...teamRows.filter((x) => x.id !== row.id)];
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ data: row }),
      });
    }
    if (url.pathname === "/api/atelier-ia/entreprises")
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ data: { items: teamRows, hasMore: false, canWrite: true } }),
      });
    if (url.pathname.startsWith("/api/atelier-ia/entreprises/") && request.method() === "PATCH") {
      teamWrites++;
      const id = url.pathname.split("/").at(-1);
      const company_id = request.postDataJSON().companyId;
      const row = teamRows.find((x) => x.id === id);
      row.company_id = company_id;
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ data: row }),
      });
    }
    if (
      url.pathname.endsWith("/atelier-ia/inventory") ||
      /^\/api\/atelier-ia\/entreprises\/[^/]+\/inventory$/.test(url.pathname)
    ) {
      inventoryCount++;
      return route.fulfill({
        status: inventoryStatus,
        contentType: "application/json",
        body: JSON.stringify(inventoryBody),
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
  await page.getByRole("heading", { name: "Votre poste de commande" }).waitFor();
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
  await page.getByRole("button", { name: "Vue d’ensemble", exact: true }).click();
  await page.getByRole("button", { name: "Voir les missions", exact: true }).click();
  await page.getByRole("heading", { name: "Activité réelle", exact: true }).waitFor();
  await page.getByRole("button", { name: "Vue d’ensemble", exact: true }).click();
  connectionCount = 0;
  registryCount = 0;
  checks.push(
    "guided setup: no automatic reads, two manual GETs, real empty/nonempty states, failures clear stale readiness, mobile and navigation",
  );

  const desktopNav = page.getByRole("navigation", { name: "Navigation principale", exact: true });
  const auditToggle = desktopNav.getByRole("button", { name: "Audit", exact: true });
  const agentToggle = desktopNav.getByRole("button", {
    name: "Équipes & agents",
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
  const atelierNav = page.getByRole("navigation", { name: "Navigation de l’atelier" });
  for (const label of ["Vue d’ensemble", "Missions", "Discussion", "Capacités", "Installation"]) {
    await atelierNav.getByRole("button", { name: label, exact: true }).click();
    assert.equal(
      await atelierNav
        .getByRole("button", { name: label, exact: true })
        .getAttribute("aria-current"),
      "page",
    );
    assert.equal(await page.getByText(/simulation|EXEMPLE SIMULÉ/i).count(), 0);
  }
  await atelierNav.getByRole("button", { name: "Missions", exact: true }).click();
  assert.equal(
    await page.getByRole("button", { name: "Nouvelle mission", exact: true }).isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Charger les missions liées", exact: true }).click();
  await page.getByRole("heading", { name: "Mission de test", exact: true }).waitFor();
  await atelierNav.getByRole("button", { name: "Discussion", exact: true }).click();
  await page
    .getByText("La conversation réelle n’est pas encore connectée à Optivos.", { exact: false })
    .waitFor();
  assert.equal(await page.getByRole("textbox").count(), 0);
  await atelierNav.getByRole("button", { name: "Capacités", exact: true }).click();
  for (const name of ["Skills", "Plugins", "API", "MCP"])
    await page.getByRole("heading", { name, exact: true }).waitFor();
  assert.equal(inventoryCount, 0);
  await page.getByRole("button", { name: "Vérifier les capacités", exact: true }).click();
  await page.getByText("research", { exact: true }).waitFor();
  await page.getByText("Recherche Web", { exact: true }).waitFor();
  await page.getByText("Activation : oui · Configuration : non", { exact: true }).waitFor();
  inventoryStatus = 503;
  await page.getByRole("button", { name: "Vérifier les capacités", exact: true }).click();
  await page
    .getByText("Vérification impossible. Réessayez pour obtenir un inventaire actualisé.", {
      exact: true,
    })
    .waitFor();
  assert.equal(await page.getByText("research", { exact: true }).count(), 0);
  inventoryStatus = 200;
  inventoryBody.data.skills = { state: "unconfigured", items: [] };
  inventoryBody.data.toolsets = { state: "unconfigured", items: [] };
  await page.getByRole("button", { name: "Vérifier les capacités", exact: true }).click();
  await page.getByText("Connexion non configurée", { exact: true }).first().waitFor();
  assert.equal(await page.getByText("Connexion non configurée", { exact: true }).count(), 2);
  checks.push(
    "manual inventory read, actual items rendered, enabled/configured distinction, failure clears stale data",
  );
  checks.push(
    "five coherent sections, no simulated workflow, real registry consultation, unavailable actions explained",
  );
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
        .getByRole("button", { name: "Équipes & agents", exact: true })
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
  await page.getByRole("button", { name: "Installation", exact: true }).click();
  await page.getByText("0 € de nouveaux frais API", { exact: true }).waitFor();
  await page.getByRole("heading", { name: "Autonomie et permissions", exact: true }).waitFor();
  await page.getByRole("heading", { name: "Clients et isolation", exact: true }).waitFor();
  checks.push("budget, autonomy, providers and client hosting prerequisites visible");
  const checkConnection = page.getByRole("button", { name: "Vérifier la connexion", exact: true });
  await checkConnection.click();
  await page.getByRole("status").filter({ hasText: "Connexion Hermes vérifiée" }).waitFor();
  assert.equal(connectionCount, 1);
  await page.screenshot({ path: join(evidence, "optivos-hermes-connexion.png"), fullPage: true });
  for (const [state, label] of [
    ["unconfigured", "Connexion non configurée"],
    ["unlinked", "Cet espace n’est pas lié à Hermes"],
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
  await rootNav.getByRole("button", { name: "Équipes & agents", exact: true }).click();
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
  await page.goto(`${base}/?enterprise`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Créer votre entreprise IA", exact: true }).waitFor();
  await page.getByRole("radio", { name: "À partir d’un modèle", exact: false }).check();
  await page.getByLabel("Modèle d’équipe", { exact: true }).selectOption("research");
  assert.equal(
    await page.getByLabel("Nom de l’agent 1", { exact: true }).inputValue(),
    "Responsable de recherche",
  );
  await page.getByRole("radio", { name: "Manuel", exact: false }).check();
  await page.getByRole("button", { name: "Ajouter un agent", exact: true }).click();
  assert.equal(
    await page.getByRole("button", { name: "Ajouter un agent", exact: true }).isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Retirer l’agent 3", exact: true }).click();
  await page.getByLabel("Nom de l’entreprise IA", { exact: true }).fill("Équipe recherche pilote");
  await page
    .getByLabel("Quel résultat doit produire cette équipe ?", { exact: true })
    .fill("Produire un rapport avec des sources vérifiables.");
  await page.getByRole("button", { name: "Enregistrer l’entreprise IA", exact: true }).click();
  await page.getByRole("heading", { name: "Équipe recherche pilote", exact: true }).waitFor();
  await page.getByText("Équipe en préparation · budget API 0 €", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("Nom de l’entreprise IA", { exact: true }).isVisible(), false);
  await page.getByRole("button", { name: "Réglages", exact: true }).click();
  await page
    .getByLabel("Dossier lié à Équipe recherche pilote", { exact: true })
    .selectOption(companyId);
  await page.getByRole("button", { name: "Actualiser", exact: true }).click();
  assert.equal(
    await page.getByLabel("Dossier lié à Équipe recherche pilote", { exact: true }).inputValue(),
    companyId,
  );
  assert.equal(teamWrites, 2);
  assert.equal(mutationCount, 2);
  connectionBody = {
    data: {
      state: "connected",
      checkedAt: "2026-10-15T08:00:00Z",
      monitoring: { status: true, events: true },
      liveExecution: false,
      modelCalls: 0,
    },
  };
  inventoryBody.data.skills = {
    state: "available",
    items: [{ name: "research", description: "Sources vérifiables" }],
  };
  const enterprise = page.getByRole("region", {
    name: "Espace de travail de l’équipe",
    exact: true,
  });
  const countBefore = connectionCount;
  await enterprise.getByRole("button", { name: "Connexion", exact: true }).click();
  assert.equal(connectionCount, countBefore);
  const connectionRequest = page.waitForRequest((request) =>
    request.url().endsWith(`/api/atelier-ia/entreprises/${teamRows[0].id}/connection`),
  );
  await enterprise.getByRole("button", { name: "Vérifier la connexion", exact: true }).click();
  await connectionRequest;
  await enterprise.getByText(/Connexion Hermes vérifiée/).waitFor();
  const inventoryRequest = page.waitForRequest((request) =>
    request.url().endsWith(`/api/atelier-ia/entreprises/${teamRows[0].id}/inventory`),
  );
  await enterprise.getByRole("button", { name: "Vérifier les capacités", exact: true }).click();
  await inventoryRequest;
  await enterprise.getByText("research", { exact: true }).waitFor();
  checks.push(
    "standalone workspace health and inventory use workspace routes on manual action only; responses mocked",
  );
  await enterprise.getByRole("button", { name: "Missions", exact: true }).click();
  await enterprise.getByText("Quel travail voulez-vous avancer ?", { exact: true }).waitFor();
  assert.equal(pilotReads, 0);
  await enterprise.getByRole("button", { name: "Vérifier le pilote gratuit", exact: true }).click();
  await enterprise.getByText("Pilote temporairement indisponible.", { exact: true }).waitFor();
  assert.equal(
    await enterprise
      .getByRole("button", { name: "Lancer la mission textuelle", exact: true })
      .isDisabled(),
    true,
  );
  pilotReadinessStatus = 200;
  await enterprise.getByRole("button", { name: "Vérifier le pilote gratuit", exact: true }).click();
  await enterprise
    .getByText("Pilote gratuit vérifié. Aucun outil externe ni repli autorisé.", { exact: true })
    .waitFor();
  await enterprise
    .getByLabel("Quelle mission textuelle confier à Hermes ?", { exact: true })
    .fill("Prépare une procédure de recette pour notre accueil client.");
  await enterprise
    .getByRole("button", { name: "Lancer la mission textuelle", exact: true })
    .click();
  await enterprise
    .getByText("Accusé de réception perdu : reprenez la même demande.", { exact: true })
    .waitFor();
  assert.equal(
    await enterprise
      .getByLabel("Quelle mission textuelle confier à Hermes ?", { exact: true })
      .isDisabled(),
    true,
  );
  await enterprise.getByRole("button", { name: "Reprendre la même demande", exact: true }).click();
  await enterprise.getByText("En attente", { exact: true }).waitFor();
  assert.equal(pilotRequestIds[0], pilotRequestIds[1]);
  assert.equal(pilotRows.length, 1);
  await enterprise.getByRole("button", { name: "Demander l’arrêt", exact: true }).click();
  await enterprise.getByText("Arrêt demandé", { exact: true }).waitFor();
  pilotRows[0].status = "stopped";
  pilotRows.push({
    ...pilotRows[0],
    id: "33333333-3333-4333-8333-333333333333",
    prompt: "Ancienne mission de recette terminée",
    status: "completed",
    output: "Résultat de recette uniquement : procédure d’accueil en cinq étapes.",
    proof: {
      model: "nvidia/nemotron-3.5-lightning:free",
      verifiedApiCostUsd: "0",
      llmRequests: 1,
      verifiedResponses: 1,
      tools: 0,
      fallbacks: 0,
      runtime: "Hermes AIAgent",
    },
  });
  await page.getByRole("button", { name: "Actualiser les missions", exact: true }).click();
  await enterprise.getByText("Arrêtée", { exact: true }).waitFor();
  await page.getByRole("button", { name: /^Ancienne mission de recette terminée/ }).click();
  await enterprise.getByText(/Réponse réelle Hermes · coût API vérifié : 0 \$/).waitFor();
  assert.equal(pilotWrites, 3);
  await enterprise.getByText("Relire ou corriger ce résultat", { exact: true }).click();
  assert.equal(
    await enterprise
      .getByRole("button", { name: "Demander une correction", exact: true })
      .isDisabled(),
    true,
  );
  await enterprise
    .getByLabel("Votre retour sur ce résultat", { exact: true })
    .fill("Préciser les responsabilités de chaque personne.");
  await enterprise.getByRole("button", { name: "Demander une correction", exact: true }).click();
  await enterprise
    .getByRole("button", { name: "Reprendre la même relecture", exact: true })
    .waitFor();
  await enterprise
    .getByRole("button", { name: "Reprendre la même relecture", exact: true })
    .click();
  await enterprise.getByText("Correction demandée", { exact: true }).waitFor();
  assert.equal(reviewRequestIds[0], reviewRequestIds[1]);
  await enterprise.getByRole("button", { name: "Accepter le résultat", exact: true }).click();
  await enterprise.getByText("Résultat accepté", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Actualiser les missions", exact: true }).click();
  await enterprise.getByText("Résultat accepté", { exact: true }).waitFor();
  assert.equal(pilotRows.at(-1).reviews.length, 2);
  assert.equal(pilotRows.length, 2);
  assert.equal(pilotRequestIds.length, 2);
  checks.push(
    "human review: bounded feedback, lost acknowledgement retries the same UUID, correction then acceptance persists without generation; backend mocked",
  );
  checks.push(
    "workspace redesign: creation hidden after save, team/settings/connection/mission views, original decorative characters and selected conversation; no extra automatic API reads",
  );
  assert.equal(mutationCount, 8);
  checks.push(
    "text pilot manual readiness, blocked unavailable launch, lost-ack idempotent retry, real-state stop and verified-cost result presentation; backend mocked",
  );
  assert.equal(blocked.length, 0);
  assert.equal(errors.length, 0);
  pilotRows.at(-1).output = Array.from(
    { length: 70 },
    (_, index) =>
      `Étape ${index + 1} : exemple de résultat long pour vérifier le défilement indépendant du fil.`,
  ).join("\n\n");
  await page.getByRole("button", { name: "Actualiser les missions", exact: true }).click();
  assert.ok(
    await page
      .getByLabel("Fil de la mission", { exact: true })
      .evaluate((node) => node.scrollHeight > node.clientHeight),
  );
  for (const width of [375, 820, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1));
    const box = await enterprise
      .getByLabel("Quelle mission textuelle confier à Hermes ?", { exact: true })
      .boundingBox();
    assert.ok(box && box.y >= 0 && box.y + box.height <= 1000, `Composer visible at ${width}px`);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: join(evidence, "optivos-entreprises-ia-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: join(evidence, "optivos-entreprises-ia-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Équipes & missions", exact: true }).click();
  await page.getByRole("button", { name: "Nouvelle mission", exact: true }).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(
    await page
      .getByRole("button", { name: "Équipes & missions", exact: true })
      .evaluate((node) => node === document.activeElement),
    true,
  );
  await enterprise.getByRole("button", { name: "Équipe", exact: true }).focus();
  await page.keyboard.press("Enter");
  await enterprise.getByText("Sous votre direction", { exact: true }).waitFor();
  assert.equal(
    await enterprise
      .getByRole("button", { name: "Lancer la mission textuelle", exact: true })
      .isVisible(),
    true,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: join(evidence, "optivos-agent-characters-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Options des projets", exact: true }).click();
  await page.getByRole("menuitem", { name: "Nouveau projet", exact: true }).click();
  await page.getByLabel("Nom de l’entreprise IA", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Revenir à mon équipe", exact: true }).click();
  await enterprise.getByText("Sous votre direction", { exact: true }).waitFor();
  assert.equal(pilotWrites, 6);
  assert.equal(teamWrites, 2);
  await page.getByRole("button", { name: "Affichage", exact: true }).click();
  await page.getByRole("menuitem", { name: "Panneau latéral", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("menuitem", { name: "Connexion", exact: true }).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(
    await page
      .getByRole("button", { name: "Affichage", exact: true })
      .evaluate((node) => node === document.activeElement),
    true,
  );
  await page.getByRole("button", { name: "Fichier", exact: true }).click();
  const downloadReady = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Exporter le résultat…", exact: true }).click();
  const resultDownload = await downloadReady;
  assert.match(resultDownload.suggestedFilename(), /^optivos-mission-[0-9a-f-]+\.txt$/);
  const downloadedPath = await resultDownload.path();
  assert.ok(downloadedPath);
  assert.equal(readFileSync(downloadedPath, "utf8"), pilotRows.at(-1).output);
  await page.getByRole("button", { name: "Options de la conversation", exact: true }).click();
  const archiveAction = page.getByRole("menuitem", { name: "Archiver", exact: true });
  assert.equal(await archiveAction.getAttribute("aria-disabled"), "true");
  await archiveAction.focus();
  await page.keyboard.press("Enter");
  await page
    .getByText(
      "Cette commande Codex n’est pas raccordée à Optivos. Aucune action n’a été exécutée.",
      { exact: true },
    )
    .waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Planifiées", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Planifiées", exact: true })
    .getByText("Sa fonction n’est pas raccordée à Optivos.", { exact: false })
    .waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Ouvrir le menu du profil", exact: true }).click();
  await page.getByRole("menuitem", { name: "Paramètres", exact: true }).click();
  const settingsDialog = page.getByRole("dialog", { name: "Paramètres", exact: true });
  await settingsDialog.getByRole("button", { name: "Apparence", exact: true }).click();
  await settingsDialog
    .getByLabel("Taille du texte des messages", { exact: true })
    .selectOption("16");
  await settingsDialog.getByLabel("Réduire les mouvements", { exact: true }).check();
  const savedPreferences = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("optivos.workspace.appearance.v1")),
  );
  assert.equal(savedPreferences.messageSize, 16);
  assert.equal(savedPreferences.reduceMotion, true);
  await settingsDialog.getByLabel("Rechercher dans les paramètres", { exact: true }).fill("MCP");
  await settingsDialog.getByRole("button", { name: "Serveurs MCP", exact: true }).click();
  await settingsDialog
    .getByRole("button", { name: "Vérifier les capacités", exact: true })
    .waitFor();
  await settingsDialog.getByLabel("Rechercher dans les paramètres", { exact: true }).fill("");
  await settingsDialog.getByRole("button", { name: "Git", exact: true }).click();
  await settingsDialog
    .getByText(
      "Ce menu est présent dans le catalogue de Codex. Sa fonction n’est pas raccordée à Optivos.",
      { exact: true },
    )
    .waitFor();
  await settingsDialog.getByRole("button", { name: "Apparence", exact: true }).click();
  await page.screenshot({ path: join(evidence, "optivos-codex-settings.png"), fullPage: true });
  await page.keyboard.press("Escape");
  assert.equal(
    await page
      .getByRole("button", { name: "Ouvrir le menu du profil", exact: true })
      .evaluate((node) => node === document.activeElement),
    true,
  );
  assert.equal(pilotWrites, 6);
  assert.equal(teamWrites, 2);
  checks.push(
    "Codex application menus: nested keyboard navigation and focus return, exact-result text export, unavailable archive has no mutation",
  );
  checks.push(
    "profile/settings: searched MCP category, persisted message-size and motion preferences, unavailable Git and scheduling explicitly labelled",
  );
  checks.push(
    "keyboard inspector, characters, reversible creation; fixed-height conversation, anchored composer, long-response scroll and mobile rail Escape",
  );
  await enterprise.getByRole("button", { name: "Missions", exact: true }).click();
  await page.getByRole("button", { name: "Nouvelle mission", exact: true }).click();
  await enterprise.getByText("Quel travail voulez-vous avancer ?", { exact: true }).waitFor();
  assert.equal(pilotWrites, 6);
  await page.screenshot({ path: join(evidence, "optivos-workspace-empty.png"), fullPage: true });
  await page.getByRole("button", { name: "Rechercher", exact: true }).click();
  const searchDialog = page.getByRole("dialog", { name: "Rechercher", exact: true });
  const missionSearch = searchDialog.getByLabel("Rechercher dans les conversations chargées", {
    exact: true,
  });
  await missionSearch.fill("aucune mission ne correspond");
  assert.equal(
    await searchDialog
      .getByRole("button", { name: /^Ancienne mission de recette terminée/ })
      .count(),
    0,
  );
  await missionSearch.fill("");
  assert.equal(
    await searchDialog
      .getByRole("button", { name: /^Ancienne mission de recette terminée/ })
      .count(),
    1,
  );
  await page.keyboard.press("Escape");
  await enterprise.getByRole("button", { name: "Choisir un modèle", exact: true }).click();
  await page.getByRole("menuitem", { name: "9Router", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByText("9Router n’est pas raccordé.", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Fichier", exact: true }).click();
  await page.screenshot({ path: join(evidence, "optivos-codex-file-menu.png"), fullPage: true });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: "Fichier", exact: true }).click();
  const mobileMenuBox = await page
    .getByRole("menu", { name: "Fichier", exact: true })
    .boundingBox();
  assert.ok(
    mobileMenuBox &&
      mobileMenuBox.x >= 0 &&
      mobileMenuBox.x + mobileMenuBox.width <= 375 &&
      mobileMenuBox.y + mobileMenuBox.height <= 812,
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Équipes & missions", exact: true }).click();
  await page.getByRole("button", { name: "Ouvrir le menu du profil", exact: true }).click();
  await page.getByRole("menuitem", { name: "Paramètres", exact: true }).click();
  const mobileSettings = page.getByRole("dialog", { name: "Paramètres", exact: true });
  await mobileSettings
    .getByLabel("Rechercher dans les paramètres", { exact: true })
    .fill("competences");
  await mobileSettings.getByRole("button", { name: "Compétences", exact: true }).waitFor();
  assert.equal(
    await mobileSettings.getByRole("heading", { name: "Personnel", exact: true }).count(),
    0,
  );
  await mobileSettings.getByLabel("Rechercher dans les paramètres", { exact: true }).fill("");
  await mobileSettings.getByLabel("Utilisables ici uniquement", { exact: true }).check();
  assert.equal(await mobileSettings.getByRole("button", { name: "Git", exact: true }).count(), 0);
  await mobileSettings.getByLabel("Utilisables ici uniquement", { exact: true }).uncheck();
  await mobileSettings.getByRole("button", { name: "Git", exact: true }).waitFor();
  await mobileSettings.getByRole("button", { name: "Apparence", exact: true }).click();
  assert.equal(
    await mobileSettings
      .getByRole("heading", { name: "Apparence", exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  assert.equal(await mobileSettings.getByRole("complementary").isVisible(), false);
  const mobileSettingsContent = await mobileSettings.locator("main").boundingBox();
  assert.ok(mobileSettingsContent && mobileSettingsContent.width >= 370);
  for (const label of ["Barre latérale compacte", "Réduire les mouvements"]) {
    const row = mobileSettings.locator("label.codex-setting-row").filter({ hasText: label });
    const textBox = await row.locator("span").boundingBox();
    const controlBox = await row.locator("input").boundingBox();
    assert.ok(textBox && controlBox && textBox.x + textBox.width <= controlBox.x);
    assert.ok((await row.boundingBox()).height >= 44);
  }
  assert.equal(
    await mobileSettings.getByLabel("Taille du texte des messages", { exact: true }).inputValue(),
    "16",
  );
  const mobileSettingsBox = await mobileSettings.boundingBox();
  assert.ok(mobileSettingsBox && mobileSettingsBox.width <= 375 && mobileSettingsBox.height <= 812);
  await page.screenshot({
    path: join(evidence, "optivos-codex-settings-mobile.png"),
    fullPage: true,
  });
  await mobileSettings.getByRole("button", { name: "Toutes les rubriques", exact: true }).click();
  assert.equal(
    await mobileSettings
      .getByRole("button", { name: "Apparence", exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.screenshot({
    path: join(evidence, "optivos-codex-settings-navigation-mobile.png"),
    fullPage: true,
  });
  await mobileSettings.getByRole("button", { name: "Général", exact: true }).click();
  await mobileSettings.getByText("0 € — contrôle côté serveur", { exact: true }).waitFor();
  checks.push(
    "mobile settings: full-width detail, focus and return to selected category, non-overlapping touch controls, accent-insensitive search and reversible availability filter",
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  assert.ok(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth &&
        document.documentElement.scrollHeight <= innerHeight + 1,
    ),
  );
  assert.equal(pilotWrites, 6);
  checks.push(
    "mobile application popup stays in viewport; full settings dialog and saved appearance work at375px without page overflow",
  );
  checks.push(
    "local search filters loaded history; model/location/permission menus preserve fixed free-only server policy",
  );
  checks.push(
    "three company creation modes, small-team cap, configuration-only save, independent then linked, refreshed registry, responsive layouts; backend mocked",
  );

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
        mockedConfigurationMutations: teamWrites,
        mockedMissionMutationRequests: pilotWrites,
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
