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
  const before = await p.locator('button[title="Remove route"]').count();
  // call the react onClick prop directly
  const r = await p.evaluate(() => {
    const btn = document.querySelector('button[title="Remove route"]');
    const k = Object.keys(btn).find((x) => x.startsWith('__reactProps$'));
    try { btn[k].onClick({ target: btn }); return 'called ok'; } catch (e) { return 'threw: ' + String(e).split('\n')[0]; }
  });
  console.log('direct onClick:', r, 'rows:', before, '->', await p.locator('button[title="Remove route"]').count());
  await sleep(2000);
  console.log('after 2s rows:', await p.locator('button[title="Remove route"]').count());
  // now try dispatching a full MouseEvent
  await p.evaluate(() => {
    const btn = document.querySelectorAll('button[title="Remove route"]')[1];
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  });
  await sleep(2000);
  console.log('after MouseEvent dispatch rows:', await p.locator('button[title="Remove route"]').count());
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
