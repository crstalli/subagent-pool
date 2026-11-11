#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  p.on('console', (m) => console.log('[console.' + m.type() + ']', m.text().slice(0, 160)));
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
  console.log('--- test 1: remove row 1 ---');
  const rm = card.locator('button[title="Remove route"]');
  console.log('before:', await rm.count());
  await rm.nth(1).click(); await sleep(1200);
  console.log('after remove click:', await card.locator('button[title="Remove route"]').count());
  console.log('--- test 2: fill cap input of row 0 ---');
  const cap = card.locator('input[type=number]').nth(1);
  console.log('cap value before:', await cap.inputValue());
  await cap.fill('5'); await sleep(1200);
  console.log('cap value after fill 5:', await card.locator('input[type=number]').nth(1).inputValue());
  console.log('--- test 3: provider select via selectOption ---');
  const sel = card.locator('select').nth(0);
  await sel.selectOption('nvidia', { timeout: 8000 }).catch(e => console.log('sel err', String(e).split('\n')[0]));
  await sleep(1500);
  console.log('provider value now:', await card.locator('select').nth(0).inputValue());
  console.log('model options now:', JSON.stringify(await card.locator('select').nth(1).locator('option').allTextContents()).slice(0, 160));
  await p.screenshot({ path: 'probe-evts.png', fullPage: true });
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
