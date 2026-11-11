#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const log = fs.readFileSync('/tmp/final2.log', 'utf8');
  const tm = log.match(/http:\/\/127\.0\.0\.1:3088\/\?token=\S+/);
  await p.goto(tm[0], { waitUntil: 'domcontentloaded' }); await sleep(2000);
  await p.goto('http://127.0.0.1:3088/', { waitUntil: 'domcontentloaded' }); await sleep(6000);
  const ta = p.locator('[contenteditable="true"]').first();
  await ta.waitFor({ timeout: 60000 });
  const body0 = await p.locator('body').innerText();
  if (body0.includes('nemotron')) {
    await p.locator('body').getByText('nemotron', { exact: false }).first().click(); await sleep(1500);
    await p.getByText('Model', { exact: true }).first().click(); await sleep(1500);
    await p.getByText('Qwen3.8-27B-Q4_K_M-Thinking', { exact: true }).first().click(); await sleep(1500);
    console.log('model switched to arc');
  } else { console.log('composer default already arc (or nemotron absent)'); }
  await ta.fill('Call the subagent tool exactly once with provider "arc", model "qwen3.8-27b-k4_xl-thinking", and prompt "Reply with exactly: PONG-POOL-OK". Then quote the subagent result.');
  await p.keyboard.press('Enter');
  for (let i = 0; i < 100; i++) {
    await sleep(3000);
    const t = await p.locator('body').innerText().catch(() => '');
    if (t.includes('PONG-POOL-OK') && t.includes('not allowed')) { console.log('DENIED+pong-literal at ' + i * 3 + 's'); }
    if ((t.split('PONG-POOL-OK').length - 1) >= 2 && !t.includes('not allowed')) { console.log('ALLOWED+PONG at ~' + i * 3 + 's'); break; }
    if (t.includes('not allowed') && i > 10) { console.log('DENIED at ~' + i * 3 + 's'); break; }
  }
  fs.writeFileSync('spawn-only.txt', (await p.locator('body').innerText()).slice(-5000));
  await p.screenshot({ path: 'spawn-only.png', fullPage: true });
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
