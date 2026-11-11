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
  // click the user avatar area 'cztl'
  const av = p.locator('body').getByText('cztl', { exact: true });
  console.log('cztl count:', await av.count());
  if (await av.count()) { await av.first().click(); await sleep(2500); }
  let body = await p.locator('body').innerText();
  console.log('after avatar:', body.slice(-300).replace(/\n/g, '|'));
  const st = p.locator('body').getByText('Settings', { exact: true });
  if (await st.count()) {
    await st.first().click(); await sleep(7000);
    body = await p.locator('body').innerText();
    console.log('settings page has Subagent Pool:', body.includes('Subagent Pool'));
    await p.screenshot({ path: 'probe-settings3.png', fullPage: true });
  } else {
    // try gear icon buttons
    const btns = await p.locator('button[aria-label], [role="button"]').all();
    console.log('clickable count:', btns.length);
    await p.screenshot({ path: 'probe-home.png', fullPage: true });
  }
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
