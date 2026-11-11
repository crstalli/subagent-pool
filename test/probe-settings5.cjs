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
  await p.locator('button[aria-label="Account menu"]').click(); await sleep(2000);
  await p.locator('body').getByText('Settings', { exact: true }).first().click(); await sleep(8000);
  console.log('URL now:', p.url());
  const body = await p.locator('body').innerText();
  console.log('has Subagent Pool:', body.includes('Subagent Pool'));
  console.log('snippet:', body.slice(0, 500).replace(/\n/g, '|'));
  await p.screenshot({ path: 'probe-settings5.png', fullPage: true });
  fs.writeFileSync('probe-settings5.txt', body.slice(0, 4000));
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
