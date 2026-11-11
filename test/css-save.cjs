#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 1100 } });
  p.on('pageerror', (e) => console.log('PAGE-ERR:', String(e).slice(0, 120)));
  const log = fs.readFileSync('/tmp/final6.log', 'utf8');
  const tm = log.match(/http:\/\/127\.0\.0\.1:3088\/\?token=\S+/);
  await p.goto(tm[0], { waitUntil: 'domcontentloaded' }); await sleep(2000);
  await p.goto('http://127.0.0.1:3088/', { waitUntil: 'domcontentloaded' }); await sleep(6000);
  await p.locator('body').getByText('Plugins', { exact: true }).first().click(); await sleep(8000);
  await p.locator('body').getByText('dsh-subagent-pool', { exact: true }).first().click(); await sleep(6000);
  await p.locator('[data-plugin-row], button, a, [role=button]').filter({ hasText: 'subagent-pool' }).first().click(); await sleep(8000);
  console.log('row card h3:', await p.locator('h3', { hasText: 'Subagent Pool' }).count());
  const cap = p.locator('label', { hasText: 'Total cap' }).locator('input[type=number]').first();
  await cap.waitFor({ timeout: 20000 });
  await cap.fill('5'); await sleep(500);
  await p.getByText('Save', { exact: true }).first().click(); await sleep(5000);
  const st = await p.evaluate(() => fetch('/subagent-pool/status').then((r) => r.json()).catch(() => null));
  console.log('row-form save -> totalCap:', st && st.totalCap);
  await p.screenshot({ path: 'css-row-save.png', fullPage: true });
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
