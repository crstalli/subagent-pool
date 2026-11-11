#!/usr/bin/env node
// Probe v4: capture console + check where the pool card/client lands. Usage: node audit-probe4.cjs <port> <prefix>
const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const PORT = parseInt(process.argv[2] || '3087', 10);
const PREFIX = process.argv[3] || ('p4-' + PORT);
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
  const mods = await page.evaluate(() => {
    const ml = window.__ModuleLoader__;
    return ml ? (Object.keys(ml.modules || ml._modules || {})).slice(0, 50) : 'no __ModuleLoader__';
  }).catch(e => 'eval err ' + e.message);
  console.log('modules:', JSON.stringify(mods).slice(0, 600));
  console.log('--- console logs mentioning pool/subagent/react/slots ---');
  for (const l of logs) if (/pool|subagent|react|slot|module/i.test(l)) console.log(' ', l.slice(0, 220));
  console.log('--- all logs (' + logs.length + ') first 15 ---');
  logs.slice(0, 15).forEach(l => console.log(' ', l.slice(0, 200)));

  // open settings modal
  const mores = page.locator('button:has-text("More")');
  await mores.nth(await mores.count() - 1).click(); await sleep(1500);
  await page.locator('button:has-text("Settings"), [role="menuitem"]:has-text("Settings"), a:has-text("Settings")').first().click();
  await sleep(4000);
  for (const tabName of ['Models', 'Built-in plugins', 'Agent presets', 'General']) {
    const tab = page.locator(`[role="tab"]:has-text("${tabName}"), button:has-text("${tabName}")`).first();
    if (!(await tab.count())) { console.log('tab missing:', tabName); continue; }
    await tab.click(); await sleep(3000);
    const info = await page.evaluate(() => {
      const html = document.body.innerHTML;
      return {
        textHasPool: /Subagent Pool/i.test(document.body.innerText),
        htmlHasPool: /Subagent Pool/i.test(html),
        htmlHasKey: /subagent-model-selection/.test(html),
        htmlLen: html.length
      };
    });
    console.log(`tab ${tabName}:`, JSON.stringify(info));
    await page.screenshot({ path: path.join(OUT, PREFIX + '-tab-' + tabName.replace(/\s+/g, '') + '.png'), fullPage: false });
    const body = await page.evaluate(() => document.body.innerText);
    fs.writeFileSync(path.join(OUT, PREFIX + '-tab-' + tabName.replace(/\s+/g, '') + '.txt'), body);
  }
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
