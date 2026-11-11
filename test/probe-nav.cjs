#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const log = fs.readFileSync('/tmp/pwtest7.log', 'utf8');
  const tm = log.match(/http:\/\/127\.0\.0\.1:3088\/\?token=\S+/);
  await p.goto(tm[0], { waitUntil: 'domcontentloaded' }); await sleep(2000);
  await p.goto('http://127.0.0.1:3088/', { waitUntil: 'domcontentloaded' }); await sleep(6000);
  const labels = await p.locator('button[aria-label], a[aria-label], [role="button"][aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') || e.textContent?.trim().slice(0, 30)).filter(Boolean));
  console.log(JSON.stringify(labels, null, 0).slice(0, 1200));
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
