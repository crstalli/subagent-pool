#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 1150 } });
  p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text().slice(0, 200)); });
  p.on('pageerror', (e) => console.log('PAGE-ERR:', String(e).slice(0, 200)));
  p.on('requestfailed', (r) => console.log('REQ-FAIL:', r.url().slice(0, 120), r.failure() && r.failure().errorText));
  const log = fs.readFileSync('/tmp/final10.log', 'utf8');
  const tm = log.match(/http:\/\/127\.0\.0\.1:3088\/\?token=\S+/);
  await p.goto(tm[0], { waitUntil: 'domcontentloaded' }); await sleep(2000);
  await p.goto('http://127.0.0.1:3088/', { waitUntil: 'domcontentloaded' }); await sleep(6000);
  await p.locator('button[aria-label="Account menu"]').click(); await sleep(1500);
  await p.locator('body').getByText('Settings', { exact: true }).first().click(); await sleep(6000);
  await p.locator('body').getByText('Built-in plugins', { exact: true }).first().click(); await sleep(5000);
  await p.locator('body').getByText('Subagent Pool', { exact: true }).first().click(); await sleep(10000);
  const r = await p.evaluate(async () => {
    let fr; try { const resp = await fetch('/subagent-pool/status'); fr = resp.status + ' ' + (await resp.text()).slice(0, 60); } catch (e) { fr = 'THREW ' + e; }
    return { fetch: fr, bodyHas: document.body.textContent.includes('Loading configuration'), hasDsp: !!document.querySelector('.dsp-card') };
  });
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
