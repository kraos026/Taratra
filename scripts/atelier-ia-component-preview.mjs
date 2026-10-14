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
  `export const usePathname = () => '/companies/${companyId}/atelier-ia';`,
);
writeFileSync(
  join(fixture, "entry.tsx"),
  `import {createRoot} from 'react-dom/client';
import {CompanyShell} from '@/components/dashboard/company-shell';
import {AgentWorkspacePanel} from '@/modules/agent-workspace/presentation/agent-workspace-panel';
import './style.css';
createRoot(document.getElementById('root')!).render(<CompanyShell verifiedCompanyId='${companyId}'><AgentWorkspacePanel company={{id:'${companyId}',name:'Entreprise de démonstration',canSimulate:true}}/></CompanyShell>);`,
);
// Preview only: avoid remote font requests and restrict Tailwind scanning.
const css = readFileSync(join(root, "src/app/globals.css"), "utf8")
  .replace(/^@import url\([^\r\n]+\);\r?\n/m, "")
  .replace(
    '@import "tailwindcss";',
    `@import "tailwindcss" source(none);\n@source "${unix(join(root, "src/modules/agent-workspace/presentation"))}";\n@source "${unix(join(root, "src/components/dashboard/company-shell.tsx"))}";\n@source "${unix(join(root, "src/components/brand"))}";\n@source "${unix(join(root, "src/components/ui/button.tsx"))}";`,
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
