#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  await p.route('**/subagent-pool/models', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'x' }) }));
  p.on('console', (m) => console.log('[con.' + m.type() + ']', m.text().slice(0, 200)));
  p.on('pageerror', (e) => console.log('[pageerror]', String(e).split('\n')[0]));
  const log = fs.readFileSync('/tmp/pwtest2.log', 'utf8');
  const tm = log.match(/http:\/\/127\.0\.0\.1:3088\/\?token=\S+/);
  await p.goto(tm[0], { waitUntil: 'domcontentloaded' }); await sleep(1500);
  await p.goto('http://127.0.0.1:3088/', { waitUntil: 'domcontentloaded' }); await sleep(4000);
  await p.getByText('Plugins', { exact: true }).first().click(); await sleep(5000);
  for (let i = 0; i < 150; i++) { if ((await p.locator('body').innerText()).includes('dsh-subagent-pool')) break; await sleep(2000); }
  await p.locator('body').getByText('dsh-subagent-pool', { exact: true }).first().click();
  for (let i = 0; i < 30; i++) { await sleep(1000); if (await p.locator('button[title="Remove route"]').count() >= 1) break; }
  console.log('rows initially:', await p.locator('button[title="Remove route"]').count());
  const r = await p.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const add = btns.find((x) => (x.textContent || '').includes('+ Add route'));
    if (!add) return 'no add button';
    const k = Object.keys(add).find((x) => x.startsWith('__reactProps$'));
    try { add[k].onClick({ target: add, preventDefault() {}, stopPropagation() {} }); return 'add onClick called'; } catch (e) { return 'threw: ' + String(e).split('\n')[0]; }
  });
  console.log(r);
  await sleep(2500);
  console.log('rows after direct add onClick:', await p.locator('button[title="Remove route"]').count());
  // real Playwright click on add
  await p.getByText('+ Add route').click();
  await sleep(2500);
  console.log('rows after playwright click add:', await p.locator('button[title="Remove route"]').count());
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
