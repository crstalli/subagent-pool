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
  const info = await p.evaluate(() => {
    const btn = document.querySelector('button[title="Remove route"]');
    const keys = Object.keys(btn);
    const propsKey = keys.find((k) => k.startsWith('__reactProps$'));
    const fiberKey = keys.find((k) => k.startsWith('__reactFiber$'));
    const contKey = keys.find((k) => k.startsWith('__reactContainer$'));
    let propsHasOnClick = false;
    if (propsKey) propsHasOnClick = typeof btn[propsKey].onClick === 'function';
    // find nearest ancestor with __reactContainer$
    let anc = btn, rootKey = null;
    while (anc) { const k = Object.keys(anc).find((x) => x.startsWith('__reactContainer$')); if (k) { rootKey = k; break; } anc = anc.parentElement; }
    return { propsKey, fiberKey, contKey, propsHasOnClick, rootKey, title: btn.title };
  });
  console.log('button react keys:', JSON.stringify(info));
  // synthetic click via el.click()
  const before = await p.locator('button[title="Remove route"]').count();
  await p.evaluate(() => document.querySelector('button[title="Remove route"]').click());
  await sleep(1500);
  const after = await p.locator('button[title="Remove route"]').count();
  console.log('synthetic click:', before, '->', after);
  // compare react identity: window react seed vs app
  const reactInfo = await p.evaluate(() => {
    const l = window.__ModuleLoader__;
    return { hasLoader: !!l, keys: l ? Object.keys(l).slice(0, 10) : [] };
  });
  console.log('loader:', JSON.stringify(reactInfo));
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
