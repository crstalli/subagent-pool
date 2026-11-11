#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 1150 } });
  p.on('pageerror', (e) => console.log('PAGE-ERR:', String(e).slice(0, 160)));
  const log = fs.readFileSync('/tmp/final10.log', 'utf8');
  const tm = log.match(/http:\/\/127\.0\.0\.1:3088\/\?token=\S+/);
  await p.goto(tm[0], { waitUntil: 'domcontentloaded' }); await sleep(2000);
  await p.goto('http://127.0.0.1:3088/', { waitUntil: 'domcontentloaded' }); await sleep(6000);
  await p.locator('button[aria-label="Account menu"]').click(); await sleep(1500);
  await p.locator('body').getByText('Settings', { exact: true }).first().click(); await sleep(6000);
  await p.locator('body').getByText('Built-in plugins', { exact: true }).first().click(); await sleep(5000);
  await p.locator('body').getByText('Subagent Pool', { exact: true }).first().click(); await sleep(10000);
  // computed style sanity: input bg should be bg-layer-3 (#353638), switch on = brand (#f9fafb)
  const probe = await p.evaluate(() => {
    const inp = document.querySelector('.dsp-input');
    const sw = document.querySelector('button[role="switch"]');
    const card = document.querySelector('.dsp-card');
    const g = (el, prop) => el ? getComputedStyle(el).getPropertyValue(prop) : null;
    return {
      inputBg: g(inp, 'background-color'), inputColor: g(inp, 'color'), inputBorder: g(inp, 'border'),
      inputRadius: g(inp, 'border-radius'), inputHeight: g(inp, 'height'),
      swBg: g(sw, 'background-color'), swW: g(sw, 'width'), swH: g(sw, 'height'), swChecked: sw && sw.getAttribute('aria-checked'),
      cardBg: g(card, 'background-color'), cardBorder: g(card, 'border'), cardRadius: g(card, 'border-radius')
    };
  });
  console.log(JSON.stringify(probe, null, 1));
  await p.screenshot({ path: 'theme-collapsed.png', fullPage: true });
  await p.locator('button[aria-label*="route details"]').first().click(); await sleep(800);
  await p.screenshot({ path: 'theme-expanded.png', fullPage: true });
  // functional: toggle route 2 off + save + verify
  await p.locator('button[role="switch"]').nth(1).click(); await sleep(400);
  await p.getByText('Save', { exact: true }).first().click(); await sleep(5000);
  const st = await p.evaluate(() => fetch('/subagent-pool/status').then((r) => r.json()));
  console.log('caps after toggle+save:', st.routes.map((r) => r.model + ' cap=' + r.cap).join(' | '));
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
