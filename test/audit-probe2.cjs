#!/usr/bin/env node
// Explore the settings UI: find where the pool card renders. Usage: node audit-probe2.cjs <port> <outPrefix>
const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const PORT = parseInt(process.argv[2] || '3087', 10);
const PREFIX = process.argv[3] || ('audit-p' + PORT);
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
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await context.addCookies([Object.assign(cookie(PORT, secret()), { domain: '127.0.0.1', path: '/', secure: false })]);
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(5000);
  const dump = async (name) => {
    const body = await page.evaluate(() => document.body.innerText);
    fs.writeFileSync(path.join(OUT, PREFIX + '-' + name + '.txt'), body);
    await page.screenshot({ path: path.join(OUT, PREFIX + '-' + name + '.png'), fullPage: true });
    return body;
  };
  let body = await dump('1-home');
  console.log('home buttons:', await page.locator('button, a').allInnerTexts().then(t => t.map(s => s.trim()).filter(Boolean).slice(0, 40)));

  // find a settings entry point
  let opened = false;
  for (const sel of ['[aria-label*="Settings" i]', 'button:has-text("Settings")', 'a:has-text("Settings")', 'button:has-text("⚙")']) {
    const el = page.locator(sel).first();
    if (await el.count()) { await el.click(); opened = true; await sleep(3000); break; }
  }
  if (!opened) {
    const more = page.locator('button:has-text("More")').first();
    if (await more.count()) { await more.click(); await sleep(1500); body = await dump('2-more-menu'); console.log('More menu:', body.split('\n').slice(-15).join(' | ')); }
    for (const sel of ['[aria-label*="Settings" i]', 'button:has-text("Settings")', 'a:has-text("Settings")']) {
      const el = page.locator(sel).first();
      if (await el.count()) { await el.click(); opened = true; await sleep(3000); break; }
    }
  }
  console.log('settings opened:', opened, 'url:', page.url());
  body = await dump('3-settings');
  console.log('settings tabs/buttons:', await page.locator('[role="tab"], nav button, button').allInnerTexts().then(t => t.map(s => s.trim()).filter(Boolean).slice(0, 50)));

  // click each plausible tab and look for pool text
  for (const tabName of ['Models', 'Plugins', 'Agent presets', 'Presets', 'General']) {
    const tab = page.locator(`[role="tab"]:has-text("${tabName}"), button:has-text("${tabName}"), a:has-text("${tabName}")`).first();
    if (await tab.count()) {
      await tab.click(); await sleep(2500);
      const b = await dump('4-tab-' + tabName.replace(/\s+/g, ''));
      const hit = /Subagent Pool|subagent-model-selection|subagent-pool/i.test(b);
      console.log(`tab ${tabName}: pool text present = ${hit}`);
      if (hit) {
        console.log('--- context around hit ---');
        const lines = b.split('\n'); lines.forEach((l, i) => { if (/subagent/i.test(l)) console.log(i + ': ' + l); });
      }
    } else {
      console.log(`tab ${tabName}: not found`);
    }
  }
  console.log('page errors:', errs.slice(0, 6));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
