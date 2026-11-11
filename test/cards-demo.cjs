#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 1100 } });
  p.on('pageerror', (e) => console.log('PAGE-ERR:', String(e).slice(0, 140)));
  const log = fs.readFileSync('/tmp/final7.log', 'utf8');
  const tm = log.match(/http:\/\/127\.0\.0\.1:3088\/\?token=\S+/);
  await p.goto(tm[0], { waitUntil: 'domcontentloaded' }); await sleep(2000);
  await p.goto('http://127.0.0.1:3088/', { waitUntil: 'domcontentloaded' }); await sleep(6000);
  await p.locator('button[aria-label="Account menu"]').click(); await sleep(2000);
  await p.locator('body').getByText('Settings', { exact: true }).first().click(); await sleep(7000);
  await p.locator('body').getByText('Built-in plugins', { exact: true }).first().click(); await sleep(6000);
  await p.locator('body').getByText('Subagent Pool', { exact: true }).first().click(); await sleep(12000);
  const sw = p.locator('button[role="switch"]');
  const chev = p.locator('button[aria-label*="route details"]');
  console.log('switches:', await sw.count(), '| chevrons:', await chev.count());
  await p.screenshot({ path: 'cards-1-collapsed.png', fullPage: true });
  // expand first route
  await chev.first().click(); await sleep(800);
  await p.screenshot({ path: 'cards-2-expanded.png', fullPage: true });
  console.log('details visible after expand:', await p.locator('input[placeholder="good for…"]').count());
  // toggle second route off (cap -> 0)
  await sw.nth(1).click(); await sleep(500);
  const capInputs = p.locator('label', { hasText: 'Total cap' }); // noop
  await p.getByText('Save', { exact: true }).first().click(); await sleep(5000);
  const st = await p.evaluate(() => fetch('/subagent-pool/status').then((r) => r.json()));
  console.log('after save caps:', st.routes.map((r) => r.provider + '/' + r.model + ' cap=' + r.cap).join(' | '));
  await p.screenshot({ path: 'cards-3-saved.png', fullPage: true });
  // toggle back on and save again
  await sw.nth(1).click(); await sleep(500);
  await p.getByText('Save', { exact: true }).first().click(); await sleep(5000);
  const st2 = await p.evaluate(() => fetch('/subagent-pool/status').then((r) => r.json()));
  console.log('after re-enable save caps:', st2.routes.map((r) => r.provider + '/' + r.model + ' cap=' + r.cap).join(' | '));
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
