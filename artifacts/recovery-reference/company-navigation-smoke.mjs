import { chromium, expect } from '@playwright/test';
const base = process.env.OPTIVOS_NAV_PREVIEW === '1' ? 'https://taratra-87a71r0gm-optivos.vercel.app' : 'http://localhost:3001';
const company = '5dd6ebf3-6764-46ab-95ff-998e1414ea48';
if (new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname !== 'ajvncwsazrhqjlktzojm.supabase.co') throw new Error('STAGING GUARD');
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const context = await browser.newContext({ baseURL: base });
  const headers = base.startsWith('https:') ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET } : {};
  if (base.startsWith('https:')) await context.route(base + '/**', route => route.continue({ headers: { ...route.request().headers(), ...headers } }));
  const page = await context.newPage();
  const failures = [];
  page.on('pageerror', () => failures.push('pageerror'));
  page.on('response', response => { if (response.status() >= 500) failures.push(`HTTP ${response.status()}`); });
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(process.env.AUTOMATEX_STAGING_TENANT_A_EMAIL);
  await page.getByLabel(/password|mot de passe/i).fill(process.env.AUTOMATEX_STAGING_TENANT_A_PASSWORD);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await page.waitForURL(url => !url.pathname.endsWith('/login'), { timeout: 60000 });
  const response = await context.request.get(`/api/companies/${company}/automation-audit`, { headers });
  expect(response.status()).toBe(200);
  const { data: model } = await response.json();
  expect(model.company.id).toBe(company);
  const expected = {};
  for (const [label, stage, root] of [['Opportunités', 'AUTOMATION_OPPORTUNITIES', 'automation-opportunities'], ['ROI', 'ROI', 'roi'], ['Plan d’action', 'RECOMMENDATIONS', 'recommendations']]) {
    const artifact = model.stages.find(item => item.stage === stage)?.artifact;
    expect(artifact?.status).toBe('published');
    expected[label] = `/${root}/${artifact.id}`;
  }
  for (const width of [1440, 820, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/companies/${company}/automation-audit`, { timeout: 60000 });
    const nav = page.getByRole('navigation', { name: width >= 1024 ? 'Navigation principale' : 'Navigation principale mobile', exact: true });
    await expect(nav).toBeVisible();
    for (const [label, href] of Object.entries(expected)) {
      await expect(nav.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', href, { timeout: 60000 });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: `artifacts/company-navigation-${width}.png`, fullPage: true });
    console.log(JSON.stringify({ width, navigation: 'PASS', overflow: false }));
  }
  for (const [label, href] of Object.entries(expected)) {
    await page.goto(`/companies/${company}/automation-audit`, { timeout: 60000 });
    const link = page.getByRole('navigation', { name: 'Navigation principale mobile', exact: true }).getByRole('link', { name: label, exact: true });
    await expect(link).toHaveAttribute('href', href, { timeout: 60000 });
    await link.click();
    await page.waitForURL(url => url.pathname === href, { timeout: 60000 });
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.getByText('Cette page n’a pas pu se charger', { exact: true })).toHaveCount(0);
    console.log(JSON.stringify({ label, destination: href, clicked: 'PASS' }));
  }
  await page.goto('/companies/new', { timeout: 60000 });
  expect(await page.locator('nav a[href*="/companies/new/"]').count()).toBe(0);
  expect(failures).toEqual([]);
  console.log(JSON.stringify({ newCompanyRoutes: 'PASS', runtimeErrors: failures }));
} finally { await browser.close(); }
