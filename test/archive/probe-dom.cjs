#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  await p.route('**/subagent-pool/models', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'x' }) }));
  const log = fs.readFileSync('/tmp/pwtest2.log', 'utf8');
  const tm = log.match(/http:\/\/127\.0\.0\.1:3088\/\?token=\S+/);
  await p.goto(tm[0], { waitUntil: 'domcontentloaded' }); await sleep(1500);
  await p.goto('http://127.0.0.1:3088/', { waitUntil: 'domcontentloaded' }); await sleep(4000);
  await p.getByText('Plugins', { exact: true }).first().click(); await sleep(5000);
  for (let i = 0; i < 150; i++) { if ((await p.locator('body').innerText()).includes('dsh-subagent-pool')) break; await sleep(2000); }
  await p.locator('body').getByText('dsh-subagent-pool', { exact: true }).first().click();
  await sleep(6000);
  console.log('h3 Subagent Pool count:', await p.locator('h3', { hasText: 'Subagent Pool' }).count());
  console.log('remove buttons total:', await p.locator('button[title="Remove route"]').count());
  console.log('provider inputs total:', await p.locator('input[placeholder="provider"]').count());
  console.log('add-route buttons:', await p.getByText('+ Add route').count());
  // click the FIRST remove button and watch counts
  const rm = p.locator('button[title="Remove route"]');
  console.log('before click:', await rm.count());
  await rm.first().click();
  for (let i = 0; i < 6; i++) { await sleep(1000); console.log('t+' + (i + 1) + 's remove buttons:', await p.locator('button[title="Remove route"]').count(), 'provider inputs:', await p.locator('input[placeholder="provider"]').count()); }
  // per-h3-parent breakdown
  const h3s = p.locator('h3', { hasText: 'Subagent Pool' });
  const n = await h3s.count();
  for (let k = 0; k < n; k++) {
    const par = h3s.nth(k).locator('..');
    console.log('card#' + k, 'h3 text:', (await h3s.nth(k).innerText()).slice(0, 30), '| remove:', await par.locator('button[title="Remove route"]').count(), '| pv inputs:', await par.locator('input[placeholder="provider"]').count());
  }
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
