#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  p.on('pageerror', (e) => console.log('PAGE-ERR:', String(e).slice(0, 120)));
  const log = fs.readFileSync('/tmp/final1.log', 'utf8');
  const tm = log.match(/http:\/\/127\.0\.0\.1:3088\/\?token=\S+/);
  await p.goto(tm[0], { waitUntil: 'domcontentloaded' }); await sleep(2000);
  await p.goto('http://127.0.0.1:3088/', { waitUntil: 'domcontentloaded' }); await sleep(6000);
  const out = [];
  const status = () => p.evaluate(() => fetch('/subagent-pool/status').then((r) => r.json()).catch(() => null));

  // (a) Settings -> Built-in plugins -> Subagent Pool tab
  await p.locator('button[aria-label="Account menu"]').click(); await sleep(2000);
  await p.locator('body').getByText('Settings', { exact: true }).first().click(); await sleep(7000);
  await p.locator('body').getByText('Built-in plugins', { exact: true }).first().click(); await sleep(6000);
  let hasTab = (await p.locator('body').innerText()).includes('Subagent Pool');
  out.push('settings tab present: ' + hasTab);
  if (hasTab) {
    await p.locator('body').getByText('Subagent Pool', { exact: true }).first().click(); await sleep(9000);
    const h3 = await p.locator('h3', { hasText: 'Subagent Pool' }).count();
    const txt = await p.locator('body').innerText();
    out.push('settings card h3: ' + h3 + ', ACTIVE badge: ' + /ACTIVE/.test(txt) + ', rows: ' + (await p.locator('button[title="Remove route"]').count()));
    await p.screenshot({ path: 'final-settings-tab.png', fullPage: true });
  }
  // (b) Plugins -> bundle page card
  await p.keyboard.press('Escape'); await sleep(1500);
  await p.locator('body').getByText('Plugins', { exact: true }).first().click(); await sleep(8000);
  await p.locator('body').getByText('dsh-subagent-pool', { exact: true }).first().click(); await sleep(6000);
  out.push('bundle page card h3: ' + (await p.locator('h3', { hasText: 'Subagent Pool' }).count()));
  await p.screenshot({ path: 'final-bundle.png', fullPage: true });
  // (c) row page + form save: open the subagent-pool row
  const rowBtn = p.locator('button, [role="button"], a, [data-plugin-row]').filter({ hasText: 'subagent-pool' });
  if (await rowBtn.count()) { await rowBtn.first().click(); await sleep(6000); }
  out.push('row page card h3: ' + (await p.locator('h3', { hasText: 'Subagent Pool' }).count()));
  const cap = p.locator('label', { hasText: 'Total cap' }).locator('input[type=number]');
  if (await cap.count()) {
    await cap.first().fill('4'); await sleep(400);
    await p.getByText('Save', { exact: true }).last().click(); await sleep(4000);
    const st = await status();
    out.push('after row-form save, status totalCap: ' + (st && st.totalCap));
    await p.screenshot({ path: 'final-row.png', fullPage: true });
  }
  // (d) bundle-page card HTTP save: remove one route via bundle card, save, verify persisted
  console.log(out.join('\n'));
  fs.writeFileSync('final-gui.txt', out.join('\n'));
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
