#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const log = fs.readFileSync('/tmp/pwtest2.log', 'utf8');
  const tm = log.match(/http:\/\/127\.0\.0\.1:3088\/\?token=\S+/);
  console.log('token url found:', !!tm);
  await p.goto(tm ? tm[0] : 'http://127.0.0.1:3088/', { waitUntil: 'domcontentloaded' }); await sleep(2000);
  await p.goto('http://127.0.0.1:3088/', { waitUntil: 'domcontentloaded' }); await sleep(5000);
  await p.getByText('New Session', { exact: true }).first().click();
  for (let t = 1; t <= 10; t++) {
    await sleep(2000);
    const ta = await p.locator('textarea').count();
    const bodyHas = (await p.locator('body').innerText()).slice(0, 120).replace(/\n/g, '|');
    console.log('t=' + t * 2 + 's textareas=' + ta + ' body=' + bodyHas);
    if (ta > 0) break;
  }
  await p.screenshot({ path: 'probe-session.png', fullPage: true });
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
