#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 1100 } });
  const log = fs.readFileSync('/tmp/final9.log', 'utf8');
  const tm = log.match(/http:\/\/127\.0\.0\.1:3088\/\?token=\S+/);
  await p.goto(tm[0], { waitUntil: 'domcontentloaded' }); await sleep(1500);
  await p.goto('http://127.0.0.1:3088/', { waitUntil: 'domcontentloaded' }); await sleep(6000);
  const toks = await p.evaluate(() => {
    const out = {};
    for (const el of [document.documentElement, document.body]) {
      const s = getComputedStyle(el);
      for (let i = 0; i < s.length; i++) {
        const n = s[i];
        if (n.startsWith('--dsw-')) out[n] = s.getPropertyValue(n).trim();
      }
    }
    return out;
  });
  fs.writeFileSync('dsw-tokens.json', JSON.stringify(toks, null, 1));
  console.log(Object.keys(toks).length, 'tokens captured');
  const want = ['--dsw-alias-border-l1','--dsw-alias-border-l2','--dsw-alias-border-l3','--dsw-alias-border-l4','--dsw-alias-bg-layer-1','--dsw-alias-bg-layer-2','--dsw-alias-bg-layer-3','--dsw-alias-label-primary','--dsw-alias-label-secondary','--dsw-alias-brand-primary','--dsw-alias-switch-thumb','--dsw-alias-state-business-primary','--dsw-alias-interactive-bg-hover','--dsw-alias-markdown-code-block','--dsw-radius-md','--dsw-radius-lg','--dsw-focus-ring-width','--dsw-focus-ring-color','--dsw-alias-bg-base','--dsw-alias-label-primary-foreground'];
  for (const w of want) console.log(w, '=', toks[w] || '(not found)');
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
