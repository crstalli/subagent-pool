#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 1150 } });
  p.on('pageerror', (e) => console.log('PAGE-ERR:', String(e).slice(0, 160)));
  const log = fs.readFileSync(process.argv[2] || '/tmp/final10.log', 'utf8');
  const tm = log.match(/http:\/\/127\.0\.0\.1:3088\/\?token=\S+/);
  await p.goto(tm[0], { waitUntil: 'domcontentloaded' }); await sleep(2000);
  await p.goto('http://127.0.0.1:3088/', { waitUntil: 'domcontentloaded' }); await sleep(6000);
  await p.locator('button[aria-label="Account menu"]').click(); await sleep(1500);
  await p.locator('body').getByText('Settings', { exact: true }).first().click(); await sleep(6000);
  await p.locator('body').getByText('Built-in plugins', { exact: true }).first().click(); await sleep(5000);
  await p.locator('body').getByText('Subagent Pool', { exact: true }).first().click();
  await p.waitForSelector('.dsp-card', { timeout: 30000 }); await sleep(1500);
  const probe = await p.evaluate(() => {
    const g = (el, prop) => el ? getComputedStyle(el).getPropertyValue(prop) : null;
    const inp = document.querySelector('.dsp-input');
    const sws = [...document.querySelectorAll('button[role="switch"]')];
    const card = document.querySelector('.dsp-card');
    return {
      switches: sws.length,
      sw0: { bg: g(sws[1], 'background-color'), w: g(sws[1], 'width'), h: g(sws[1], 'height'), checked: sws[1].getAttribute('aria-checked') },
      inputBg: g(inp, 'background-color'), inputColor: g(inp, 'color'), inputH: g(inp, 'height'), inputRadius: g(inp, 'border-radius'),
      cardBg: g(card, 'background-color'), cardBorder: g(card, 'border-top-color') + ' ' + g(card, 'border-top-width'), cardRadius: g(card, 'border-radius')
    };
  });
  console.log(JSON.stringify(probe));
  await p.screenshot({ path: 'theme2-collapsed.png', fullPage: true });
  await p.locator('button[aria-label*="route details"]').first().click(); await sleep(800);
  await p.screenshot({ path: 'theme2-expanded.png', fullPage: true });
  // toggle bonzai (route 1 => switch index 2) off, save, verify
  await p.locator('button[role="switch"]').nth(2).click(); await sleep(400);
  await p.getByRole('button', { name: 'Save' }).click(); await sleep(5000);
  const st = await p.evaluate(() => fetch('/subagent-pool/status').then((r) => r.json()));
  console.log('caps after toggle+save:', st.routes.map((r) => r.model + ' cap=' + r.cap).join(' | '));
  // re-enable, save, verify restore
  await p.locator('button[role="switch"]').nth(2).click(); await sleep(400);
  await p.getByRole('button', { name: 'Save' }).click(); await sleep(5000);
  const st2 = await p.evaluate(() => fetch('/subagent-pool/status').then((r) => r.json()));
  console.log('caps after re-enable+save:', st2.routes.map((r) => r.model + ' cap=' + r.cap).join(' | '));
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
