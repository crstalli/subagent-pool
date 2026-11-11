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
  for (let i = 0; i < 30; i++) { await sleep(1000); if (await p.locator('button[title="Remove route"]').count() >= 2) break; }
  const pv = p.locator('input[placeholder="provider"]').first();
  await pv.fill('nvidia');
  console.log('t=0 filled, value=', await p.locator('input[placeholder="provider"]').first().inputValue().catch(() => '?'));
  // keep a JS handle to the original DOM node to detect replacement
  await p.evaluate(() => { window.__node = document.querySelector('input[placeholder="provider"]'); });
  for (let t = 1; t <= 9; t++) {
    await sleep(1000);
    const val = await p.locator('input[placeholder="provider"]').first().inputValue().catch(() => '?');
    const same = await p.evaluate(() => window.__node && window.__node.isConnected && document.querySelector('input[placeholder="provider"]') === window.__node);
    console.log('t=' + t + 's value=' + JSON.stringify(val) + ' sameNode=' + same + ' rows=' + await p.locator('button[title="Remove route"]').count());
  }
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
