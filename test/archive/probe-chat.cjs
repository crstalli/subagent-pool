#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const log = fs.readFileSync('/tmp/pwtest3.log', 'utf8');
  const tm = log.match(/http:\/\/127\.0\.0\.1:3088\/\?token=\S+/);
  await p.goto(tm[0], { waitUntil: 'domcontentloaded' }); await sleep(2000);
  await p.goto('http://127.0.0.1:3088/', { waitUntil: 'domcontentloaded' }); await sleep(5000);
  await p.getByText('New Session', { exact: true }).first().click();
  for (let t = 1; t <= 8; t++) {
    await sleep(2500);
    const ta = await p.locator('textarea').count();
    const ce = await p.locator('[contenteditable="true"]').count();
    console.log('t=' + t * 2.5 + 's textareas=' + ta + ' contenteditable=' + ce + ' url=' + p.url());
    if (ta || ce) break;
  }
  const body = (await p.locator('body').innerText()).slice(0, 400).replace(/\n/g, '|');
  console.log('BODY:', body);
  await p.screenshot({ path: 'probe-chat.png', fullPage: true });
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
