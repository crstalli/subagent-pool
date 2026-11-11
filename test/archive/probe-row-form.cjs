#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  p.on('pageerror', (e) => console.log('PAGE-ERR:', String(e).slice(0, 140)));
  const log = fs.readFileSync('/tmp/pwtest8.log', 'utf8');
  const tm = log.match(/http:\/\/127\.0\.0\.1:3088\/\?token=\S+/);
  await p.goto(tm[0], { waitUntil: 'domcontentloaded' }); await sleep(2000);
  await p.goto('http://127.0.0.1:3088/', { waitUntil: 'domcontentloaded' }); await sleep(6000);
  await p.locator('body').getByText('Plugins', { exact: true }).first().click(); await sleep(8000);
  await p.locator('body').getByText('dsh-subagent-pool', { exact: true }).first().click(); await sleep(6000);
  console.log('bundle page, card h3:', await p.locator('h3', { hasText: 'Subagent Pool' }).count());
  // open the row 'subagent-pool' inside the bundle
  const row = p.locator('[data-plugin-row-detail], body').getByText('subagent-pool', { exact: true });
  console.log('row candidates:', await row.count());
  const rowBtn = p.locator('button, [role="button"], a, [data-plugin-row]').filter({ hasText: 'subagent-pool' });
  console.log('row clickables:', await rowBtn.count());
  if (await rowBtn.count()) { await rowBtn.first().click(); await sleep(6000); }
  let body = await p.locator('body').innerText();
  console.log('row page has card h3:', await p.locator('h3', { hasText: 'Subagent Pool' }).count());
  console.log('has row detail marker:', await p.locator('[data-plugin-row-detail]').count());
  await p.screenshot({ path: 'probe-row-1.png', fullPage: true });
  fs.writeFileSync('probe-row-1.txt', body.slice(0, 2500));
  // set Total cap = 3 and Save via the card
  const card = p.locator('h3', { hasText: 'Subagent Pool' }).locator('xpath=ancestor::div[contains(@class,"")][1]');
  const cap = p.locator('label', { hasText: 'Total cap' }).locator('input[type=number]');
  console.log('cap inputs:', await cap.count());
  if (await cap.count()) {
    await cap.first().fill('3'); await sleep(400);
    await p.locator('h3', { hasText: 'Subagent Pool' }).locator('xpath=ancestor::div[1]').getByText('Save', { exact: true }).click();
    await sleep(4000);
    const st = await p.evaluate(() => fetch('/subagent-pool/status').then((r) => r.json()).catch(() => null));
    console.log('status totalCap after save:', st && st.totalCap, 'routes:', st && st.routes && st.routes.length);
    body = await p.locator('body').innerText();
    const i = body.lastIndexOf('Save');
    console.log('after save snippet:', body.slice(Math.max(0, i - 200), i + 60).replace(/\n/g, '|'));
    await p.screenshot({ path: 'probe-row-2.png', fullPage: true });
  }
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
