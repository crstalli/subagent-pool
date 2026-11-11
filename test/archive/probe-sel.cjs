#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const log = fs.readFileSync('/tmp/pwtest2.log', 'utf8');
  const tm = log.match(/http:\/\/127\.0\.0\.1:3088\/\?token=\S+/);
  await p.goto(tm[0], { waitUntil: 'domcontentloaded' }); await sleep(1500);
  await p.goto('http://127.0.0.1:3088/', { waitUntil: 'domcontentloaded' }); await sleep(4000);
  await p.getByText('Plugins', { exact: true }).first().click(); await sleep(5000);
  for (let i = 0; i < 150; i++) { if ((await p.locator('body').innerText()).includes('dsh-subagent-pool')) break; await sleep(2000); }
  await p.locator('body').getByText('dsh-subagent-pool', { exact: true }).first().click();
  let card = null;
  for (let i = 0; i < 60 && !card; i++) {
    if (await p.locator('h3', { hasText: 'Subagent Pool' }).count()) { card = p.locator('h3', { hasText: 'Subagent Pool' }).locator('..'); break; }
    await sleep(2000);
  }
  console.log('card:', !!card);
  for (let i = 0; i < 30; i++) { await sleep(1000); if (await card.locator('button[title="Remove route"]').count() >= 2) break; }
  console.log('remove buttons:', await card.locator('button[title="Remove route"]').count());
  for (let i = 0; i < 40; i++) { await sleep(500); if (await card.locator('select').nth(0).locator('option[value="nvidia"]').count() > 0) break; }
  const sel = card.locator('select').nth(0);
  console.log('select count:', await card.locator('select').count(), 'sel0 options has nvidia:', await sel.locator('option[value="nvidia"]').count());
  // instrument: log change events on this select
  await sel.evaluate((el) => {
    window.__evts = [];
    el.addEventListener('change', () => window.__evts.push('change:' + el.value));
    el.addEventListener('input', () => window.__evts.push('input:' + el.value));
  });
  await sel.evaluate((el) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    s.call(el, 'nvidia');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await sleep(1500);
  console.log('after set: value=', await sel.inputValue().catch(() => '?'), 'evts=', await p.evaluate(() => window.__evts));
  const mopts = await card.locator('select').nth(1).locator('option').allTextContents();
  console.log('model select options now:', JSON.stringify(mopts).slice(0, 200));
  // try clicking the option via mouse instead
  await sel.click();
  await sleep(500);
  const opt = sel.locator('option[value="nvidia"]');
  if (await opt.count()) { await opt.click(); await sleep(1200); }
  console.log('after option click: value=', await sel.inputValue().catch(() => '?'), 'evts=', await p.evaluate(() => window.__evts));
  const mopts2 = await card.locator('select').nth(1).locator('option').allTextContents();
  console.log('model options after click:', JSON.stringify(mopts2).slice(0, 200));
  await p.screenshot({ path: 'probe-sel.png', fullPage: true });
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
