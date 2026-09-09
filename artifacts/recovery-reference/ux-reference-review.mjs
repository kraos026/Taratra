import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = 'http://localhost:3001';
const company = '5dd6ebf3-6764-46ab-95ff-998e1414ea48';
const output = `artifacts/ux-reference-${process.env.UX_PASS || 'before'}`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const context = await browser.newContext({ baseURL: base });
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(process.env.AUTOMATEX_STAGING_TENANT_A_EMAIL);
  await page.getByLabel(/password|mot de passe/i).fill(process.env.AUTOMATEX_STAGING_TENANT_A_PASSWORD);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await page.waitForURL(u => u.pathname !== '/login', { timeout: 60000 });
  const runtime = { pageErrors: 0, failedResponses: [], codes: [] };
  page.on('pageerror', () => runtime.pageErrors++);
  page.on('console', message => { for (const code of ['P1000','P2028','INVALID_INPUT']) if (message.text().includes(code)) runtime.codes.push(code); });
  page.on('response', response => { if(response.status() >= 400) runtime.failedResponses.push({path:new URL(response.url()).pathname,status:response.status()}); });
  const discoveryBefore = (await (await context.request.get(`/api/companies/${company}/discovery`)).json()).data;
  const routes = [['Overview','/'],['Company',`/companies/${company}`],['Audit',`/companies/${company}/automation-audit`],['Discovery',`/companies/${company}/discovery`],['Interview',`/companies/${company}/interview`]];
  for (const [name,resource] of [['Opportunities','automation-opportunities'],['ROI','roi'],['Plan','recommendations']]) {
    const r = await context.request.get(`/api/companies/${company}/${resource}?status=published`);
    if (!r.ok()) throw Error(`Cannot resolve ${name}: ${r.status()}`);
    const p=await r.json(), rows=p.data?.items??p.data;
    const row=rows.find(x=>x.status==='published');
    if(!row) throw Error(`No published ${name}`);
    routes.push([name,`/${resource}/${row.id}`]);
  }
  routes.push(['Decision',`/companies/${company}/automation-audit/decision-center`],['Results',`/companies/${company}/automation-audit/results`],['Feedback','/']);
  const all=[];
  for(const [name,url] of routes) {
    await page.setViewportSize({width:1440,height:900});
    const r=await page.goto(url,{timeout:60000,waitUntil:'networkidle'});
    if(name==='Feedback') { const trigger=page.locator('.pilot-feedback-trigger'); await trigger.waitFor(); await trigger.click(); }
    if(process.env.UX_PASS && process.env.UX_PASS !== 'before') {
      if(name==='Interview') {
        await page.getByRole('heading',{name:'Entretien guidé'}).waitFor();
        assert.equal(await page.getByRole('button',{name:'Modifier',exact:true}).count(),0);
        assert.equal(await page.getByRole('button',{name:'Terminer l’entretien',exact:true}).count(),0);
      }
      if(name==='Discovery') {
        await page.getByText('Informations validées').waitFor();
        await page.getByRole('button',{name:/1 Entreprise/}).click();
        await page.getByRole('button',{name:/2 Activité/}).click();
        const finance = page.locator('details');
        assert.equal(await finance.count(),1);
        assert.equal(await finance.getAttribute('open'),null);
        await finance.locator('summary').click();
        assert.notEqual(await finance.getAttribute('open'),null);
        await page.reload({waitUntil:'networkidle'});
        await page.getByText('Informations validées').waitFor();
      }
      if(['Opportunities','ROI','Plan'].includes(name)) {
        await page.getByRole('navigation',{name:'Navigation principale',exact:true}).waitFor();
        assert.equal(await page.getByRole('navigation',{name:'Navigation principale',exact:true}).getByRole('link',{name:'Mon entreprise',exact:true}).getAttribute('href'),`/companies/${company}`);
      }
      if(name==='Results') {
        const trigger=page.locator('.pilot-feedback-trigger');
        await trigger.click();
        await page.getByRole('dialog').waitFor();
        await page.getByRole('button',{name:'Fermer',exact:true}).click();
        assert.equal(await page.locator('dialog').count(),1);
        assert.equal(await page.locator('dialog').isVisible(),false);
      }
    }
    const content=await page.locator(name==='Feedback'?'dialog[open]':'body').innerText();
    await writeFile(`${output}/${name}.txt`,content);
    const sizes=[];
    for(const width of [390,430,768,900,1024,1440]) {
      await page.setViewportSize({width,height:900});
      await page.evaluate(()=>window.scrollTo(0,0));
      const metrics=await page.evaluate(()=>{
        const visible=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
        const controls=[...document.querySelectorAll('input:not([type=hidden]),textarea,select')].filter(visible);
        return {overflow:document.documentElement.scrollWidth>innerWidth,clippedText:[...document.querySelectorAll('p,dt,dd,h1,h2,h3')].filter(visible).filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent.trim().slice(0,55)),headings:[...document.querySelectorAll('h1,h2')].filter(visible).map(e=>e.textContent.trim()),unlabelled:controls.filter(e=>!e.labels?.length&&!e.getAttribute('aria-label')&&!e.getAttribute('aria-labelledby')).length,buttons:[...document.querySelectorAll('button')].filter(visible).map(e=>e.textContent.trim()).slice(0,14)};
      });
      sizes.push({width,...metrics});
      await page.screenshot({path:`${output}/${name}-${width}.png`,fullPage:true});
      if(width===390||width===1440) await page.screenshot({path:`${output}/${name}-${width}-viewport.png`});
    }
    await page.keyboard.press('Tab');
    const focus=await page.evaluate(()=>({tag:document.activeElement?.tagName,visible:!!document.activeElement?.getClientRects().length}));
    const row={name,url,http:r?.status(),sizes,focus,error:/Cette page n’a pas pu se charger|Internal Server Error/.test(content)};
    all.push(row);
    await writeFile(`${output}/review.json`,JSON.stringify(all,null,2));
    console.log(JSON.stringify(row));
  }
  await writeFile(`${output}/review.json`,JSON.stringify(all,null,2));
  const discoveryAfter = (await (await context.request.get(`/api/companies/${company}/discovery`)).json()).data;
  assert.deepEqual(discoveryAfter,discoveryBefore,'Read-only navigation must not change discovery or create a draft');
  await page.keyboard.press('Escape');
  const legacy=[];
  for(const route of ['/audits','/reports','/questionnaires','/settings','/recommendations']) {
    const response=await page.goto(route,{waitUntil:'networkidle'});
    legacy.push({route,http:response.status(),url:new URL(page.url()).pathname,headings:await page.locator('h1').allTextContents()});
  }
  await writeFile(`${output}/additional-checks.json`,JSON.stringify({runtime,legacy,discoveryUnchanged:true},null,2));
  console.log(JSON.stringify({runtime,legacy,discoveryUnchanged:true}));
} finally {await browser.close();}
