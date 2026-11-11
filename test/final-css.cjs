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
  await p.locator('button[aria-label="Account menu"]').click(); await sleep(2000);
  await p.locator('body').getByText('Settings', { exact: true }).first().click(); await sleep(7000);
  await p.locator('body').getByText('Built-in plugins', { exact: true }).first().click(); await sleep(6000);
  await p.locator('body').getByText('Subagent Pool', { exact: true }).first().click(); await sleep(12000);
  const txt = await p.locator('body').innerText();
  console.log('ACTIVE:', /ACTIVE/.test(txt), '| rows:', await p.locator('button[title="Remove route"]').count());
  await p.screenshot({ path: 'css-settings-tab.png', fullPage: true });
  // bundle page too
  await p.keyboard.press('Escape'); await sleep(1500);
  await p.locator('body').getByText('Plugins', { exact: true }).first().click(); await sleep(8000);
  await p.locator('body').getByText('dsh-subagent-pool', { exact: true }).first().click(); await sleep(8000);
  console.log('bundle card h3:', await p.locator('h3', { hasText: 'Subagent Pool' }).count());
  await p.screenshot({ path: 'css-bundle.png', fullPage: true });
  // quick save via bundle card (HTTP fallback path): set total cap 5
  const cap = p.locator('label', { hasText: 'Total cap' }).locator('input[type=number]');
  await cap.first().fill('5'); await sleep(400);
  await p.getByText('Save', { exact: true }).last().click(); await sleep(4000);
  const st = await p.evaluate(() => fetch('/subagent-pool/status').then((r) => r.json()).catch(() => null));
  console.log('after save, totalCap:', st && st.totalCap);
  await p.screenshot({ path: 'css-after-save.png', fullPage: true });
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
