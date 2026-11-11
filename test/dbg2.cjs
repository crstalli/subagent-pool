#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 1150 } });
  const log = fs.readFileSync('/tmp/final10.log', 'utf8');
  const tm = log.match(/http:\/\/127\.0\.0\.1:3088\/\?token=\S+/);
  await p.goto(tm[0], { waitUntil: 'domcontentloaded' }); await sleep(2000);
  await p.goto('http://127.0.0.1:3088/', { waitUntil: 'domcontentloaded' }); await sleep(6000);
  await p.locator('button[aria-label="Account menu"]').click(); await sleep(1500);
  await p.locator('body').getByText('Settings', { exact: true }).first().click(); await sleep(6000);
  await p.locator('body').getByText('Built-in plugins', { exact: true }).first().click(); await sleep(5000);
  await p.locator('body').getByText('Subagent Pool', { exact: true }).first().click();
  await p.waitForSelector('.dsp-card', { timeout: 30000 }); await sleep(1500);
  const r = await p.evaluate(async () => {
    const sws = [...document.querySelectorAll('button[role="switch"]')].map((s) => ({ label: s.getAttribute('aria-label'), checked: s.getAttribute('aria-checked'), bg: getComputedStyle(s).backgroundColor }));
    const st = await fetch('/subagent-pool/status').then((r) => r.json());
    return { switches: sws, statusEnabled: st.enabled };
  });
  console.log(JSON.stringify(r, null, 1));
  // zoomed shot of the Enabled row
  const el = await p.locator('text=Enabled').first();
  await el.scrollIntoViewIfNeeded();
  await p.screenshot({ path: 'theme2-enabled-zoom.png', clip: { x: 400, y: 560, width: 500, height: 120 } });
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
