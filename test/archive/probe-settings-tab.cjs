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
  // open Settings via the nav: look for 'Settings' text
  const nav = p.locator('body').getByText('Settings', { exact: true });
  console.log('settings nav count:', await nav.count());
  if (await nav.count()) { await nav.first().click(); await sleep(6000); }
  const body = await p.locator('body').innerText();
  console.log('has Subagent Pool tab:', body.includes('Subagent Pool'));
  console.log('body snippet:', body.slice(0, 200).replace(/\n/g, '|'));
  await p.screenshot({ path: 'probe-settings.png', fullPage: true });
  if (body.includes('Subagent Pool')) {
    await p.locator('body').getByText('Subagent Pool', { exact: true }).first().click();
    await sleep(5000);
    const card = await p.locator('h3', { hasText: 'Subagent Pool' }).count();
    console.log('card h3 in settings tab:', card);
    await p.screenshot({ path: 'probe-settings-tab.png', fullPage: true });
    fs.writeFileSync('probe-settings-tab.txt', (await p.locator('body').innerText()).slice(0, 3000));
  }
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
