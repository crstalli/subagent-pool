#!/usr/bin/env node
// Screenshot the configured route cards. Usage: node routes-shot.cjs [logfile] [outprefix]
const { chromium } = require('playwright');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const logFile = process.argv[2] || '/tmp/final11.log';
  const out = process.argv[3] || 'routes';
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 1250 } });
  const log = fs.readFileSync(logFile, 'utf8');
  const tm = log.match(/http:\/\/127\.0\.0\.1:3088\/\?token=\S+/);
  await p.goto(tm[0], { waitUntil: 'domcontentloaded' }); await sleep(2000);
  await p.goto('http://127.0.0.1:3088/', { waitUntil: 'domcontentloaded' }); await sleep(6000);
  await p.locator('button[aria-label="Account menu"]').click(); await sleep(1500);
  await p.locator('body').getByText('Settings', { exact: true }).first().click(); await sleep(6000);
  await p.locator('body').getByText('Built-in plugins', { exact: true }).first().click(); await sleep(5000);
  await p.locator('body').getByText('Subagent Pool', { exact: true }).first().click();
  await p.waitForSelector('.dsp-card', { timeout: 30000 }); await sleep(1500);
  await p.screenshot({ path: out + '-configured.png', fullPage: true });
  // expand the arc (nsfw-labeled) route to show its profile labels
  await p.locator('button[aria-label*="route details"]').last().click(); await sleep(800);
  await p.screenshot({ path: out + '-labeled.png', fullPage: true });
  await b.close();
  console.log('saved', out + '-configured.png', out + '-labeled.png');
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
