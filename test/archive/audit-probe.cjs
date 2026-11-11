#!/usr/bin/env node
// Probe: open Plugins page on pwtest-audit, dump structure around the pool plugin.
const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const PORT = parseInt(process.argv[2] || '3087', 10);
const BASE = 'http://127.0.0.1:' + PORT;
const DSH_HOME = path.join(require('os').homedir(), '.dsh');
const OUT = __dirname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function decodeBase64Url(str) { let s = str.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Buffer.from(s, 'base64'); }
function encodeBase64Url(buf) { return buf.toString('base64url'); }
function createDSHAuthCookie(port, secretB64) {
  const secret = decodeBase64Url(secretB64);
  const issuedAt = Date.now(); const expiresAt = issuedAt + 30 * 24 * 60 * 60 * 1000;
  const authority = '127.0.0.1:' + port;
  const payload = JSON.stringify({ version: 1, authority, issuedAt, expiresAt });
  const body = encodeBase64Url(Buffer.from(payload));
  const sig = crypto.createHmac('sha256', secret).update(body).digest();
  return { name: 'dsh-auth-' + encodeBase64Url(crypto.createHash('sha256').update(authority).digest()), value: 'v1.' + body + '.' + encodeBase64Url(sig) };
}
function getStoredSecret() {
  const content = fs.readFileSync(path.join(DSH_HOME, '.credentials.yaml'), 'utf-8');
  const m = content.match(/browser-session[^\n]*\n(?:\s+kind: grant\n\s+payload:\n\s+version: \d+\n\s+secret: (\S+))/);
  if (m) return m[1];
  for (const line of content.split('\n')) if (line.trim().startsWith('secret:')) { const v = line.trim().replace('secret:', '').trim().replace(/"/g, ''); if (v.length > 20) return v; }
  return null;
}
(async () => {
  const secret = getStoredSecret();
  const cookie = createDSHAuthCookie(PORT, secret);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await context.addCookies([{ name: cookie.name, value: cookie.value, domain: '127.0.0.1', path: '/', secure: false }]);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(4000);
  await page.locator('button:has-text("Plugins"), a:has-text("Plugins")').first().click();
  await sleep(2000);
  // wait for the plugin list to finish loading
  try { await page.waitForSelector('text=dsh-subagent-pool', { timeout: 30000 }); console.log('found dsh-subagent-pool row'); }
  catch (e) { console.log('dsh-subagent-pool row NOT found within 30s'); }
  let body = await page.evaluate(() => document.body.innerText);
  fs.writeFileSync(path.join(OUT, 'audit-probe-1-plugins.txt'), body);
  console.log('--- plugins page body (first 60 lines) ---');
  console.log(body.split('\n').slice(0, 60).join('\n'));
  await page.screenshot({ path: path.join(OUT, 'audit-probe-1-plugins.png'), fullPage: true });
  // click the pool plugin row
  const row = page.locator('text=dsh-subagent-pool').first();
  if (await row.count()) {
    await row.click(); await sleep(3000);
    body = await page.evaluate(() => document.body.innerText);
    fs.writeFileSync(path.join(OUT, 'audit-probe-2-plugin-detail.txt'), body);
    console.log('--- after clicking dsh-subagent-pool ---');
    console.log(body.split('\n').slice(0, 80).join('\n'));
    console.log('has Subagent Pool:', /Subagent Pool/.test(body), '| has subagent-model-selection:', /subagent-model-selection/.test(body), '| has Save:', /\bSave\b/.test(body));
    await page.screenshot({ path: path.join(OUT, 'audit-probe-2-plugin-detail.png'), fullPage: true });
    // try clicking the item key
    const item = page.getByText('subagent-model-selection', { exact: false }).first();
    if (await item.count()) { await item.click().catch(() => {}); await sleep(2500); }
    const h = page.getByText('Subagent Pool', { exact: false }).first();
    if (await h.count()) { await h.click().catch(() => {}); await sleep(2000); }
    body = await page.evaluate(() => document.body.innerText);
    fs.writeFileSync(path.join(OUT, 'audit-probe-3-after-item.txt'), body);
    console.log('--- after item click --- has Subagent Pool:', /Subagent Pool/.test(body), '| has Save:', /\bSave\b/.test(body), '| ACTIVE:', /\bACTIVE\b/.test(body));
    await page.screenshot({ path: path.join(OUT, 'audit-probe-3-after-item.png'), fullPage: true });
  }
  console.log('console errors:', consoleErrors.slice(0, 10));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
