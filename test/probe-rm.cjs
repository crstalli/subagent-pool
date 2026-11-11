#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  await p.route('**/subagent-pool/models', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'x' }) }));
  p.on('pageerror', (e) => console.log('[pageerror]', String(e).split('\n')[0]));
  const log = fs.readFileSync('/tmp/pwtest2.log', 'utf8');
  const tm = log.match(/http:\/\/127\.0\.0\.1:3088\/\?token=\S+/);
  await p.goto(tm[0], { waitUntil: 'domcontentloaded' }); await sleep(1500);
  await p.goto('http://127.0.0.1:3088/', { waitUntil: 'domcontentloaded' }); await sleep(4000);
  await p.getByText('Plugins', { exact: true }).first().click(); await sleep(5000);
  for (let i = 0; i < 150; i++) { if ((await p.locator('body').innerText()).includes('dsh-subagent-pool')) break; await sleep(2000); }
  await p.locator('body').getByText('dsh-subagent-pool', { exact: true }).first().click();
  for (let i = 0; i < 30; i++) { await sleep(1000); if (await p.locator('button[title="Remove route"]').count() >= 2) break; }
  console.log('rows:', await p.locator('button[title="Remove route"]').count());
  // direct onClick on LAST remove button
  let r = await p.evaluate(() => {
    const btns = [...document.querySelectorAll('button[title="Remove route"]')];
    const btn = btns[btns.length - 1];
    const k = Object.keys(btn).find((x) => x.startsWith('__reactProps$'));
    try { btn[k].onClick({ target: btn }); return 'called, n=' + btns.length; } catch (e) { return 'threw: ' + String(e).split('\n')[0]; }
  });
  console.log('direct rm onClick:', r);
  await sleep(2000);
  console.log('rows after direct rm:', await p.locator('button[title="Remove route"]').count());
  // real click on first remove
  await p.locator('button[title="Remove route"]').first().click();
  await sleep(2000);
  console.log('rows after real click rm:', await p.locator('button[title="Remove route"]').count());
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
