#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const log = fs.readFileSync('/tmp/pwtest4.log', 'utf8');
  const tm = log.match(/http:\/\/127\.0\.0\.1:3088\/\?token=\S+/);
  await p.goto(tm[0], { waitUntil: 'domcontentloaded' }); await sleep(2000);
  await p.goto('http://127.0.0.1:3088/', { waitUntil: 'domcontentloaded' }); await sleep(6000);
  const ce = p.locator('[contenteditable="true"]').first();
  console.log('composer found:', await ce.count());
  // find the model selector near the composer: look for text nemotron
  const modelBtn = p.locator('body').getByText('nemotron-3-ultra-550b-a55b', { exact: false }).first();
  console.log('model label count:', await p.locator('body').getByText('nemotron').count());
  await modelBtn.click().catch(e => console.log('click err', String(e).split('\n')[0]));
  await sleep(2500);
  const txt = (await p.locator('body').innerText()).slice(-1200).replace(/\n/g, '|');
  console.log('after click tail:', txt);
  await p.screenshot({ path: 'probe-picker.png', fullPage: true });
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
