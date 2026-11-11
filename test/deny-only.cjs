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
  await ta.fill('Call the subagent tool exactly once with provider "nvidia", model "nvidia/nemotron-3-ultra-550b-a55b", and prompt "hi". Quote the exact error returned.');
  await p.keyboard.press('Enter');
  let seen = '';
  for (let i = 0; i < 60; i++) {
    await sleep(3000);
    const t = await p.locator('body').innerText().catch(() => '');
    const m = t.match(/Subagent pool:[^|\n]*|child LLM route[^|\n]*/g);
    if (m && m.length) { seen = m[m.length - 1].slice(0, 220); console.log('DENY at ~' + i * 3 + 's:', seen); break; }
  }
  if (!seen) console.log('no denial text seen');
  fs.writeFileSync('deny-only.txt', (await p.locator('body').innerText()).slice(-5000));
  await p.screenshot({ path: 'deny-only.png', fullPage: true });
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
