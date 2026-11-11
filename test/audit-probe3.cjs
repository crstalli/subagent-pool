#!/usr/bin/env node
// Probe v3: find Settings entry + wait for plugin rows after Refresh. Usage: node audit-probe3.cjs <port> <prefix>
const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const PORT = parseInt(process.argv[2] || '3087', 10);
const PREFIX = process.argv[3] || ('p3-' + PORT);
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
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const dump = async (name) => {
    const body = await page.evaluate(() => document.body.innerText);
    fs.writeFileSync(path.join(OUT, PREFIX + '-' + name + '.txt'), body);
    await page.screenshot({ path: path.join(OUT, PREFIX + '-' + name + '.png'), fullPage: true });
    return body;
  };
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(5000);

  // 1) bottom "… More" menu (last More button)
  const mores = page.locator('button:has-text("More")');
  const nMore = await mores.count();
  console.log('More buttons:', nMore);
  if (nMore > 0) { await mores.nth(nMore - 1).click(); await sleep(2000); const b = await dump('1-bottom-more'); console.log('bottom More menu items:', b.split('\n').slice(-20).join(' | ')); }

  // look for Settings in the open menu
  let settingsEl = page.locator('button:has-text("Settings"), a:has-text("Settings"), [role="menuitem"]:has-text("Settings")').first();
  if (await settingsEl.count()) {
    await settingsEl.click(); await sleep(4000);
    const b = await dump('2-settings');
    console.log('SETTINGS PAGE opened. url:', page.url());
    console.log('settings page texts:', b.split('\n').filter(Boolean).slice(-40).join(' | '));
  } else {
    console.log('no Settings item in bottom menu; pressing Escape and going to Plugins page');
    await page.keyboard.press('Escape'); await sleep(800);
  }

  // 2) Plugins page + Refresh + wait for rows
  await page.locator('button:has-text("Plugins")').first().click(); await sleep(2500);
  const refresh = page.locator('button:has-text("Refresh")').first();
  if (await refresh.count()) { await refresh.click(); console.log('clicked Refresh'); }
  // wait for rows: any text matching dsh- or subagent that is NOT a session title — heuristic: wait for skeleton to be replaced
  try {
    await page.waitForFunction(() => {
      const t = document.body.innerText;
      return /(dsh-subagent-pool|subagent-pool|dsh-base|dsh-web-app|Installed|Enabled|disabled)/i.test(t) && !/skeleton/i.test(t);
    }, { timeout: 300000 });
    console.log('plugin rows appeared');
  } catch (e) { console.log('rows did NOT appear within 300s'); }
  await sleep(2000);
  let b = await dump('3-plugins-loaded');
  console.log('--- plugins page tail ---');
  console.log(b.split('\n').filter(Boolean).slice(-45).join('\n'));
  // click a row mentioning subagent-pool
  const row = page.locator('[class], div, li, button, a').filter({ hasText: /subagent-pool/i }).last();
  if (await row.count()) {
    await row.click(); await sleep(4000);
    b = await dump('4-plugin-detail');
    console.log('--- after clicking subagent-pool row ---');
    console.log('has Subagent Pool:', /Subagent Pool/.test(b), '| has Save:', /\bSave\b/.test(b), '| has ACTIVE:', /\bACTIVE\b/.test(b));
    console.log(b.split('\n').filter(Boolean).slice(-50).join('\n'));
  } else console.log('no subagent-pool row element found');
  console.log('page errors:', errs.slice(0, 8));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
