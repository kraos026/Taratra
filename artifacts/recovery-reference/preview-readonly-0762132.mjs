import { chromium } from '@playwright/test';
const base = 'https://taratra-87a71r0gm-optivos.vercel.app';
const company = '5dd6ebf3-6764-46ab-95ff-998e1414ea48';
if (new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname !== 'ajvncwsazrhqjlktzojm.supabase.co') throw new Error('STAGING GUARD');
const headers = { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET };
const browser = await chromium.launch({ channel: 'chrome' });
const failures = [];
try {
  for (const tenant of ['A', 'B']) {
    const context = await browser.newContext({ baseURL: base });
    await context.route(base + '/**', route => route.continue({ headers: { ...route.request().headers(), ...headers } }));
    const page = await context.newPage();
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env[`AUTOMATEX_STAGING_TENANT_${tenant}_EMAIL`]);
    await page.getByLabel(/password|mot de passe/i).fill(process.env[`AUTOMATEX_STAGING_TENANT_${tenant}_PASSWORD`]);
    await page.getByRole('button', { name: /se connecter/i }).click();
    await page.waitForURL(url => !url.pathname.endsWith('/login'));
    if (tenant === 'B') {
      for (const suffix of ['', '/automation-audit/results', '/automation-audit/decision-center']) {
        const response = await context.request.get(`/api/companies/${company}${suffix}`, { headers });
        console.log(JSON.stringify({ tenant, isolation: suffix || 'company', http: response.status() }));
        if (response.status() !== 404) failures.push(`isolation ${suffix}`);
      }
      await context.close();
      continue;
    }
    const routes = ['/', `/companies/${company}`, `/companies/${company}/automation-audit`, `/companies/${company}/discovery`];
    for (const [resource, root] of [['automation-opportunities', 'automation-opportunities'], ['roi', 'roi'], ['recommendations', 'recommendations']]) {
      const response = await context.request.get(`/api/companies/${company}/${resource}?status=published`, { headers });
      console.log(JSON.stringify({ resource, http: response.status() }));
      if (!response.ok()) { failures.push(resource); continue; }
      const payload = await response.json();
      const items = payload.data?.items ?? payload.data ?? [];
      const row = Array.isArray(items) ? items.find(item => item.status === 'published') : null;
      if (!row?.id) { failures.push(`${resource} published missing`); continue; }
      routes.push(`/${root}/${row.id}`);
    }
    routes.push(`/companies/${company}/automation-audit/decision-center`, `/companies/${company}/automation-audit/results`, '/recommendations');
    for (const route of routes) {
      const started = Date.now();
      const response = await page.goto(route, { timeout: 60000, waitUntil: 'networkidle' });
      const text = await page.locator('body').innerText();
      const error = /Cette page n’a pas pu se charger|This page couldn.t load|Internal Server Error/.test(text);
      const login = new URL(page.url()).pathname === '/login';
      console.log(JSON.stringify({ route, http: response?.status(), ms: Date.now() - started, error, login, headings: await page.locator('h1').allTextContents() }));
      if (response?.status() !== 200 || error || login) failures.push(route);
      if (route.endsWith('/automation-audit')) console.log(JSON.stringify({ auditNavigation: await page.locator('nav a[href]').evaluateAll(es => es.map(e => ({ label: e.textContent.trim(), href: e.getAttribute('href') }))) }));
    }
    for (const width of [390, 820, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/companies/${company}/automation-audit/results`, { waitUntil: 'networkidle' });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      console.log(JSON.stringify({ width, resultsOverflow: overflow }));
      if (overflow) failures.push(`overflow ${width}`);
      await page.screenshot({ path: `artifacts/preview-results-${width}-4704089.png`, fullPage: true });
    }
    await context.close();
  }
} finally { await browser.close(); }
console.log(JSON.stringify({ failures }));
if (failures.length) process.exitCode = 1;
