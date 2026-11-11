#!/usr/bin/env node
// Probe v5: check client module loading + wait (long) for Plugins page rows + open bundle detail. Usage: node audit-probe5.cjs <port> <prefix>
const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const PORT = parseInt(process.argv[2] || '3087', 10);
const PREFIX = process.argv[3] || ('p5-' + PORT);
const BASE = 'http://127.0.0.1:' + PORT;
const DSH_HOME = path.join(require('os').homedir(), '.dsh');
const OUT = __dirname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function decodeBase64Url(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Buffer.from(s, 'base64'); }
function enc(b) { return b.toString('base64url'); }
function cookie(port, secretB64) {
  const secret = decodeBase64Url(secretB64);
  const authority = '127.0.0.1:' + port;
  const payload = JSON.stringify({ version: 1, authority, issuedAt: Date.now(), expiresAt: Date.now() + 30 * 864e5 });
  const body = enc(Buffer.from(payload));
  const sig = crypto.createHmac('sha256', secret).update(body).digest();
  return { name: 'dsh-auth-' + enc(crypto.createHash('sha256').update(authority).digest()), value: 'v1.' + body + '.' + enc(sig) };
}
function secret() {
  const c = fs.readFileSync(path.join(DSH_HOME, '.credentials.yaml'), 'utf-8');
  const m = c.match(/browser-session[^\n]*\n(?:\s+kind: grant\n\s+payload:\n\s+version: \d+\n\s+secret: (\S+))/);
  if (m) return m[1];
  for (const l of c.split('\n')) if (l.trim().startsWith('secret:')) { const v = l.trim().replace('secret:', '').trim().replace(/"/g, ''); if (v.length > 20) return v; }
}
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  await context.addCookies([Object.assign(cookie(PORT, secret()), { domain: '127.0.0.1', path: '/', secure: false })]);
  const page = await context.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(6000);
  const boot = await page.evaluate(() => {
    const out = { bootKeys: Object.keys(window.__DSH_BOOT__ || {}), mlKeys: [], mlProto: [] };
    const ml = window.__ModuleLoader__;
    if (ml) {
      out.mlKeys = Object.getOwnPropertyNames(ml);
      out.mlProto = Object.getOwnPropertyNames(Object.getPrototypeOf(ml) || {});
      for (const k of out.mlKeys) {
        try { const v = ml[k]; if (typeof v === 'object' && v) out[k + '_keys'] = Object.keys(v).slice(0, 80); } catch (e) {}
      }
    }
    return out;
  }).catch(e => ({ err: e.message }));
  console.log('BOOT:', JSON.stringify(boot).slice(0, 1500));
  const bootStr = JSON.stringify(boot);
  console.log('boot mentions subagent-pool client:', /subagent-pool/.test(bootStr));

  // go to Plugins page (sidebar)
  await page.locator('button[aria-label="Plugins"], button:has-text("Plugins")').first().click();
  await sleep(3000);
  const refresh = page.locator('button:has-text("Refresh")').first();
  if (await refresh.count()) { await refresh.click(); console.log('clicked Refresh on Plugins page'); }
  // wait up to 300s for the main panel to list the bundle
  let found = false;
  try {
    await page.waitForFunction(() => {
      const main = document.querySelector('main');
      const t = main ? main.innerText : document.body.innerText;
      return /dsh-subagent-pool/.test(t);
    }, { timeout: 300000, polling: 2000 });
    found = true;
  } catch (e) { console.log('bundle row never appeared in 300s'); }
  await sleep(2000);
  const mainText = await page.evaluate(() => { const m = document.querySelector('main'); return m ? m.innerText : document.body.innerText; });
  fs.writeFileSync(path.join(OUT, PREFIX + '-plugins-main.txt'), mainText);
  console.log('--- main panel tail after wait (found=' + found + ') ---');
  console.log(mainText.split('\n').filter(Boolean).slice(-40).join('\n'));
  await page.screenshot({ path: path.join(OUT, PREFIX + '-plugins-page.png'), fullPage: false });
  if (found) {
    // click the bundle row/card
    const row = page.locator('main *').filter({ hasText: /dsh-subagent-pool/ }).last();
    await row.click().catch(e => console.log('row click failed:', e.message.split('\n')[0]));
    await sleep(5000);
    const t2 = await page.evaluate(() => { const m = document.querySelector('main'); return m ? m.innerText : document.body.innerText; });
    fs.writeFileSync(path.join(OUT, PREFIX + '-bundle-detail.txt'), t2);
    console.log('--- bundle detail page (has Subagent Pool card:', /Subagent Pool/.test(t2), ') ---');
    console.log(t2.split('\n').filter(Boolean).slice(-45).join('\n'));
    await page.screenshot({ path: path.join(OUT, PREFIX + '-bundle-detail.png'), fullPage: false });
  }
  console.log('--- console logs with pool/module/slot (' + logs.length + ' total) ---');
  logs.filter(l => /pool|module|slot|subagent/i.test(l)).slice(0, 15).forEach(l => console.log(' ', l.slice(0, 200)));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
