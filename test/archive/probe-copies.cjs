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
  for (let i = 0; i < 30; i++) { await sleep(1000); if (await p.locator('button[title="Remove route"]').count() >= 1) break; }
  const info = await p.evaluate(() => {
    function suffixes(el) {
      const out = [];
      for (const k of Object.keys(el)) {
        if (k.startsWith('__reactFiber$')) out.push('fiber:' + k.slice(13));
        if (k.startsWith('__reactProps$')) out.push('props:' + k.slice(13));
        if (k.startsWith('__reactContainer$')) out.push('container:' + k.slice(17));
      }
      return out;
    }
    const appBtn = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('New Session')) || document.querySelector('aside button, nav button');
    const cardBtn = document.querySelector('button[title="Remove route"]');
    const h3 = document.querySelector('h3');
    // walk up from cardBtn to find its react container
    let anc = cardBtn, cont = null;
    while (anc) { const k = Object.keys(anc).find((x) => x.startsWith('__reactContainer$')); if (k) { cont = k; break; } anc = anc.parentElement; }
    let anc2 = appBtn, cont2 = null;
    while (anc2) { const k = Object.keys(anc2).find((x) => x.startsWith('__reactContainer$')); if (k) { cont2 = k; break; } anc2 = anc2.parentElement; }
    return {
      appBtn: appBtn ? { text: (appBtn.textContent || '').slice(0, 20), keys: suffixes(appBtn), container: cont2 } : null,
      cardBtn: { keys: suffixes(cardBtn), container: cont },
      bodyContainer: Object.keys(document.body).filter((k) => k.startsWith('__reactContainer$')),
    };
  });
  console.log(JSON.stringify(info, null, 1));
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
