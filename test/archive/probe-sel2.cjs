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
  for (let i = 0; i < 30; i++) { await sleep(1000); if (await card.locator('button[title="Remove route"]').count() >= 2) break; }
  for (let i = 0; i < 40; i++) { await sleep(500); if (await card.locator('select').nth(0).locator('option[value="nvidia"]').count() > 0) break; }
  const sel = card.locator('select').nth(0);
  console.log('trying selectOption...');
  try {
    await sel.selectOption('nvidia', { timeout: 8000 });
    console.log('selectOption ok, value=', await sel.inputValue());
  } catch (e) { console.log('selectOption err:', String(e).split('\n')[0]); }
  await sleep(2000);
  console.log('after 2s: value=', await sel.inputValue().catch(() => '?'));
  const mopts = await card.locator('select').nth(1).locator('option').allTextContents();
  console.log('model options:', JSON.stringify(mopts).slice(0, 160));
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
