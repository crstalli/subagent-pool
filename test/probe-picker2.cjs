#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const log = fs.readFileSync('/tmp/pwtest4.log', 'utf8');
  const tm = log.match(/http:\/\/127\.0\.0\.1:3088\/\?token=\S+/);
  await p.goto(tm[0], { waitUntil: 'domcontentloaded' }); await sleep(2000);
  await p.goto('http://127.0.0.1:3088/', { waitUntil: 'domcontentloaded' }); await sleep(6000);
  await p.locator('body').getByText('nemotron', { exact: false }).first().click();
  await sleep(2000);
  // popover has a 'Model' row; click it
  await p.locator('[role="menu"], [role="dialog"], .popover, div').filter({ hasText: 'Model' }).last().locator('text=Model').first().click().catch(async () => {
    await p.getByText('Model', { exact: true }).first().click();
  });
  await sleep(2500);
  console.log('has arc text:', await p.locator('body').getByText('arc', { exact: false }).count());
  const txt = (await p.locator('body').innerText()).slice(-900).replace(/\n/g, '|');
  console.log('tail:', txt);
  await p.screenshot({ path: 'probe-picker2.png', fullPage: true });
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
