#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 1100 } });
  p.on('pageerror', (e) => console.log('PAGE-ERR:', String(e).slice(0, 140)));
  const log = fs.readFileSync('/tmp/final8.log', 'utf8');
  const tm = log.match(/http:\/\/127\.0\.0\.1:3088\/\?token=\S+/);
  await p.goto(tm[0], { waitUntil: 'domcontentloaded' }); await sleep(2000);
  await p.goto('http://127.0.0.1:3088/', { waitUntil: 'domcontentloaded' }); await sleep(6000);
  await p.locator('button[aria-label="Account menu"]').click(); await sleep(2000);
  await p.locator('body').getByText('Settings', { exact: true }).first().click(); await sleep(7000);
  await p.locator('body').getByText('Built-in plugins', { exact: true }).first().click(); await sleep(6000);
  await p.locator('body').getByText('Subagent Pool', { exact: true }).first().click(); await sleep(12000);
  const mdTitle = await p.locator('select[title]').first().getAttribute('title');
  console.log('model select tooltip:', mdTitle);
  await p.screenshot({ path: 'cards-final-collapsed.png', fullPage: true });
  await p.locator('button[aria-label*="route details"]').first().click(); await sleep(800);
  await p.screenshot({ path: 'cards-final-expanded.png', fullPage: true });
  console.log('detail inputs:', await p.locator('input[placeholder="good for…"]').count());
  // functional re-check: toggle route 2 off, save, read status
  await p.locator('button[role="switch"]').nth(1).click(); await sleep(400);
  await p.getByText('Save', { exact: true }).first().click(); await sleep(5000);
  const st = await p.evaluate(() => fetch('/subagent-pool/status').then((r) => r.json()));
  console.log('caps after toggle+save:', st.routes.map((r) => r.model + ' cap=' + r.cap).join(' | '));
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
