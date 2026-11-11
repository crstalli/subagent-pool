#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 1150 } });
  p.on('pageerror', (e) => console.log('PAGE-ERR:', String(e).slice(0, 200)));
  const log = fs.readFileSync(process.argv[2] || '/tmp/final11.log', 'utf8');
  const tm = log.match(/http:\/\/127\.0\.0\.1:3088\/\?token=\S+/);
  await p.goto(tm[0], { waitUntil: 'domcontentloaded' }); await sleep(2000);
  await p.goto('http://127.0.0.1:3088/', { waitUntil: 'domcontentloaded' }); await sleep(6000);
  await p.locator('button[aria-label="Account menu"]').click(); await sleep(1500);
  await p.locator('body').getByText('Settings', { exact: true }).first().click(); await sleep(6000);
  await p.locator('body').getByText('Built-in plugins', { exact: true }).first().click(); await sleep(5000);
  await p.locator('body').getByText('Subagent Pool', { exact: true }).first().click();
  await p.waitForSelector('.dsp-card', { timeout: 30000 }); await sleep(1500);
  const status = () => p.evaluate(() => fetch('/subagent-pool/status').then((r) => r.json()));
  const save = async () => { await p.getByRole('button', { name: 'Save' }).click(); await sleep(5000); };
  const swState = async (frag) => p.locator('button[aria-label*="' + frag + '"]').getAttribute('aria-checked');
  // current: bonzai off, arc on (from dbg9), pool on, auto on
  let st = await status();
  console.log('start:', 'enabled', st.enabled, 'auto', st.totalCapAuto, 'totalCap', st.totalCap, 'caps', st.routes.map((r) => r.model.slice(0, 10) + '=' + r.cap).join(' '));
  await save();
  st = await status();
  console.log('after save: totalCap', st.totalCap, '(expect 1 = arc cap 1)  caps', st.routes.map((r) => r.cap).join('+'));
  // turn bonzai back on -> auto sum = 2
  if ((await swState('rtx-bonzi')) !== 'true') { await p.locator('button[aria-label*="rtx-bonzi"]').click(); await sleep(600); }
  await save();
  st = await status();
  console.log('bonzai on: totalCap', st.totalCap, '(expect 2)  caps', st.routes.map((r) => r.cap).join('+'));
  await p.screenshot({ path: 'autocap-final.png', fullPage: true });
  // turn auto OFF -> stored totalCap (was written as 2 by last auto save) applies
  if ((await swState('Total cap auto')) === 'true') { await p.locator('button[aria-label="Total cap auto"]').click(); await sleep(600); }
  await save();
  st = await status();
  console.log('auto off: totalCap', st.totalCap, 'auto', st.totalCapAuto, 'stored', st.totalCapStored);
  // cleanup: arc off, bonzai on, auto back on
  if ((await swState('qwen3.8')) === 'true') { await p.locator('button[aria-label*="qwen3.8"]').click(); await sleep(600); }
  if ((await swState('rtx-bonzi')) !== 'true') { await p.locator('button[aria-label*="rtx-bonzi"]').click(); await sleep(600); }
  if ((await swState('Total cap auto')) !== 'true') { await p.locator('button[aria-label="Total cap auto"]').click(); await sleep(600); }
  await save();
  st = await status();
  console.log('final: enabled', st.enabled, 'auto', st.totalCapAuto, 'totalCap', st.totalCap, 'caps', st.routes.map((r) => r.model.slice(0, 10) + '=' + r.cap).join(' '));
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
