#!/usr/bin/env node
// Dump computed styles of standard settings-page controls (dark mode) for replication.
const { chromium } = require('playwright');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const props = ['background-color','color','border','border-radius','padding','font-size','font-family','box-shadow','cursor','width','height','gap'];
function cs(el) { const s = getComputedStyle(el); const o = {}; for (const p of props) o[p] = s.getPropertyValue(p); return o; }
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 1100 } });
  const log = fs.readFileSync('/tmp/final9.log', 'utf8');
  const tm = log.match(/http:\/\/127\.0\.0\.1:3088\/\?token=\S+/);
  await p.goto(tm[0], { waitUntil: 'domcontentloaded' }); await sleep(2000);
  await p.goto('http://127.0.0.1:3088/', { waitUntil: 'domcontentloaded' }); await sleep(6000);
  await p.locator('button[aria-label="Account menu"]').click(); await sleep(1500);
  await p.locator('body').getByText('Settings', { exact: true }).first().click(); await sleep(5000);
  const data = await p.evaluate(() => {
    const out = { rootVars: {}, selects: [], inputs: [], buttons: [], switches: [], sections: [] };
    const root = getComputedStyle(document.documentElement);
    const css = getComputedStyle(document.body);
    for (let i = 0; i < root.length; i++) {
      const n = root[i];
      if (/dsh|color|bg|fg|surface|border|accent|input|btn|button|card/.test(n)) out.rootVars[n] = root.getPropertyValue(n).trim();
    }
    const props = ['background-color','color','border','border-radius','padding','font-size','cursor','width','height'];
    const cs2 = (el) => { const s = getComputedStyle(el); const o = {}; for (const p of props) o[p] = s.getPropertyValue(p); return o; };
    out.selects = [...document.querySelectorAll('select')].slice(0,4).map((el) => ({ html: el.outerHTML.slice(0,180), style: cs2(el), cls: el.className }));
    out.inputs = [...document.querySelectorAll('input')].slice(0,6).map((el) => ({ type: el.type, html: el.outerHTML.slice(0,150), style: cs2(el), cls: el.className }));
    out.buttons = [...document.querySelectorAll('button')].filter((b) => b.offsetParent).slice(0,10).map((el) => ({ text: (el.textContent||'').trim().slice(0,30), style: cs2(el), cls: el.className, html: el.outerHTML.slice(0,200) }));
    out.switches = [...document.querySelectorAll('[role="switch"], [class*="witch"], [class*="oggle"]')].slice(0,5).map((el) => ({ html: el.outerHTML.slice(0,300), style: cs2(el) }));
    out.sections = [...document.querySelectorAll('section, [class*="card"], [class*="Card"], [class*="section"], [class*="panel"]')].filter((el) => el.offsetWidth > 400).slice(0,6).map((el) => ({ tag: el.tagName, cls: String(el.className).slice(0,80), style: cs2(el) }));
    return out;
  });
  fs.writeFileSync('probe-general.json', JSON.stringify(data, null, 2));
  console.log('rootVars:', Object.keys(data.rootVars).length, 'selects:', data.selects.length, 'inputs:', data.inputs.length, 'buttons:', data.buttons.length, 'switches:', data.switches.length, 'sections:', data.sections.length);
  console.log(JSON.stringify(data.rootVars, null, 1).slice(0, 2500));
  await p.screenshot({ path: 'general-page.png' });
  await b.close();
})().catch((e) => { console.error('FAILED:', String(e).split('\n')[0]); process.exit(1); });
