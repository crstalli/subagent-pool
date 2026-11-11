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
  let found = false;
  for (let i = 0; i < 150 && !found; i++) {
    if ((await p.locator('body').innerText()).includes('dsh-subagent-pool')) { found = true; break; }
    await sleep(2000);
  }
  console.log('row found:', found);
  await p.locator('body').getByText('dsh-subagent-pool', { exact: true }).first().click();
  let card = null;
  for (let i = 0; i < 60 && !card; i++) {
    if (await p.locator('h3', { hasText: 'Subagent Pool' }).count()) { card = p.locator('h3', { hasText: 'Subagent Pool' }).locator('..'); break; }
    await sleep(2000);
  }
  console.log('card:', !!card);
  await sleep(4000); // let catalog load
  // remove existing routes
  const rm = card.locator('button[title="Remove route"]');
  while (await rm.count() > 0) { await rm.first().click(); await sleep(400); }
  await card.getByText('+ Add route').click();
  await sleep(2000);
  async function dump(tag) {
    const n = await card.locator('select').count();
    console.log('[' + tag + '] selects=' + n);
    for (let i = 0; i < n; i++) {
      const s = card.locator('select').nth(i);
      const opts = await s.locator('option').allTextContents();
      const val = await s.inputValue().catch(() => '?');
      console.log('  select[' + i + '] value=' + JSON.stringify(val) + ' options=' + JSON.stringify(opts).slice(0, 220));
    }
    const inputs = await card.locator('input').count();
    const ph = [];
    for (let i = 0; i < inputs; i++) ph.push(await card.locator('input').nth(i).getAttribute('placeholder') + '|' + await card.locator('input').nth(i).getAttribute('type'));
    console.log('  inputs=' + JSON.stringify(ph));
  }
  await dump('after add route');
  await card.locator('select').nth(0).selectOption('nvidia').catch(e => console.log('pv selectOption err:', String(e).split('\n')[0]));
  await sleep(2500);
  await dump('after provider=nvidia');
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
