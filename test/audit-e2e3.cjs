#!/usr/bin/env node
// Audit E2E v3 (final): fresh pwtest-audit profile on 3087, plugin installed FROM GIT.
// 1) Playwright: Plugins page -> dsh-subagent-pool bundle detail -> does the card render?
// 2) Settings modal -> Built-in plugins tab -> does anything pool-related render?
// 3) Configure via the plugin's own HTTP API (same call the card's Save makes),
//    verify /status + persisted JSON + server-side validation (negative test).
const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const PORT = parseInt(process.argv[2] || '3087', 10);
const PREFIX = process.argv[3] || 'e2e3';
const BASE = 'http://127.0.0.1:' + PORT;
const DSH_HOME = path.join(require('os').homedir(), '.dsh');
const OUT = __dirname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[e2e3]', ...a);
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
const mainText = (page) => page.evaluate(() => { const m = document.querySelector('main'); return m ? m.innerText : document.body.innerText; });

(async () => {
  let status0;
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(BASE + '/subagent-pool/status', { signal: AbortSignal.timeout(3000) }); if (r.ok) { status0 = await r.json(); break; } } catch (e) {}
    await sleep(1000);
  }
  if (!status0) throw new Error('no server on ' + BASE);
  log('host up on', BASE, '| routes:', JSON.stringify((status0.routes || []).map(r => r.provider + '/' + r.model + ' cap=' + r.cap)));

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  await context.addCookies([Object.assign(cookie(PORT, secret()), { domain: '127.0.0.1', path: '/', secure: false })]);
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { const t = m.text(); if (/pool|slot|module/i.test(t)) errs.push(m.type() + ': ' + t); });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(6000);
  const entries = await page.evaluate(() => JSON.stringify((window.__DSH_BOOT__ || {}).entries || []));
  log('boot entries mention dsh-subagent-pool:', /dsh-subagent-pool/.test(entries));
  log('boot entries snippet:', entries.slice(0, 400));

  // --- Plugins page ---
  await page.locator('button[aria-label="Plugins"], button:has-text("Plugins")').first().click();
  await sleep(3000);
  const refresh = page.locator('button:has-text("Refresh")').first();
  if (await refresh.count()) await refresh.click();
  let rowFound = false;
  try {
    await page.waitForFunction(() => {
      const m = document.querySelector('main');
      return /dsh-subagent-pool/.test(m ? m.innerText : '');
    }, { timeout: 300000, polling: 2000 });
    rowFound = true;
  } catch (e) {}
  log('bundle row listed on Plugins page:', rowFound);
  await sleep(2000);
  fs.writeFileSync(path.join(OUT, PREFIX + '-plugins.txt'), await mainText(page));
  await page.screenshot({ path: path.join(OUT, PREFIX + '-plugins.png') });

  let cardInBundlePage = false;
  if (rowFound) {
    await page.locator('main').getByText('dsh-subagent-pool', { exact: true }).first().click({ timeout: 15000 }).catch(async () => {
      await page.locator('main').locator('*:has-text("dsh-subagent-pool")').last().click({ timeout: 15000 });
    });
    await sleep(6000);
    const t = await mainText(page);
    fs.writeFileSync(path.join(OUT, PREFIX + '-bundle-detail.txt'), t);
    await page.screenshot({ path: path.join(OUT, PREFIX + '-bundle-detail.png') });
    cardInBundlePage = /Add route/.test(t) && /Total cap/.test(t);
    log('bundle detail page: card form present (Add route/Total cap):', cardInBundlePage);
    log('bundle detail tail:', t.split('\n').filter(Boolean).slice(-18).join(' | '));
  }

  // --- Settings modal -> Built-in plugins tab ---
  await page.keyboard.press('Escape'); await sleep(1000);
  const mores = page.locator('button:has-text("More")');
  await mores.nth(await mores.count() - 1).click(); await sleep(1500);
  await page.locator('button:has-text("Settings"), [role="menuitem"]:has-text("Settings"), a:has-text("Settings")').first().click();
  await sleep(4000);
  const bpTab = page.locator('[role="tab"]:has-text("Built-in plugins"), button:has-text("Built-in plugins")').first();
  if (await bpTab.count()) {
    await bpTab.click(); await sleep(3000);
    const t = await page.evaluate(() => document.body.innerText);
    fs.writeFileSync(path.join(OUT, PREFIX + '-settings-builtinplugins.txt'), t);
    await page.screenshot({ path: path.join(OUT, PREFIX + '-settings-builtinplugins.png') });
    log('settings Built-in plugins tab: has Subagent Pool card form:', /Add route/.test(t), '| mentions subagent-pool:', /subagent-pool/i.test(t));
  }
  await page.keyboard.press('Escape'); await sleep(800);

  // --- configure via the plugin HTTP API (the card's Save calls exactly this) ---
  const next = {
    version: 3, enabled: true, totalCap: 2, queueMaxWaitSec: 300, queueMaxLen: 20,
    routes: [
      { provider: 'arc', model: 'qwen3.8-27b-k4_xl-thinking', cap: 1, tier: 'deep', maxThinking: 'high',
        profile: { thinking: 'high', speed: 'medium', instructions: 'high-level ok', bestFor: 'deep reasoning', avoidFor: 'trivial tasks', notes: 'Arc GPU 27B' } },
      { provider: 'bonzai-rtx', model: 'rtx-bonzi', cap: 1, tier: 'deep', maxThinking: 'medium',
        profile: { thinking: '', speed: '', instructions: '', bestFor: '', avoidFor: '', notes: '' } },
      { provider: 'ollama-local', model: 'rtx', cap: 1, tier: 'easy', maxThinking: '',
        profile: { thinking: 'off', speed: 'fast', instructions: 'explicit', bestFor: 'extraction, formatting, lookups, mechanical transforms', avoidFor: 'open-ended reasoning', notes: 'RTX 3080 9B' } }
    ]
  };
  const cfgRes = await (await fetch(BASE + '/subagent-pool/configure?config=' + encodeURIComponent(Buffer.from(JSON.stringify(next)).toString('base64')))).json();
  log('configure API result ok=', cfgRes.ok, cfgRes.error ? ('err=' + cfgRes.error) : '');
  const status1 = await (await fetch(BASE + '/subagent-pool/status')).json();
  const routes = (status1.routes || []).map(r => r.provider + '/' + r.model + ' cap=' + r.cap + ' tier=' + (r.tier || '-') + ' maxThinking=' + (r.maxThinking || '-'));
  log('status after configure: enabled=' + status1.enabled, 'totalCap=' + status1.totalCap, 'queue=' + status1.queueMaxWaitSec + 's/' + status1.queueMaxLen);
  log('routes:', routes.join(' | '));

  const cfgPath = path.join(DSH_HOME, 'profiles/pwtest-audit/node_modules/dsh-subagent-pool/subagent_pool_config.json');
  let persisted = null;
  if (fs.existsSync(cfgPath)) { persisted = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); }
  log('persisted file:', cfgPath, 'exists=', !!persisted,
    persisted ? 'routes=' + persisted.routes.map(r => r.provider + '/' + r.model + ' cap=' + r.cap).join(' | ') + ' queue=' + persisted.queueMaxWaitSec + 's/' + persisted.queueMaxLen : '');

  const bad = { enabled: true, totalCap: 2, routes: [{ provider: 'no-such-provider', model: 'x', cap: 1 }] };
  const badRes = await (await fetch(BASE + '/subagent-pool/configure?config=' + encodeURIComponent(Buffer.from(JSON.stringify(bad)).toString('base64')))).json();
  log('negative configure (unknown provider):', JSON.stringify(badRes));
  // confirm the bad write did not stick
  const status2 = await (await fetch(BASE + '/subagent-pool/status')).json();
  log('status unchanged after negative test:', JSON.stringify((status2.routes || []).map(r => r.provider + '/' + r.model)) === JSON.stringify((status1.routes || []).map(r => r.provider + '/' + r.model)));

  log('pool-related console/page errors:', errs.slice(0, 10));
  await browser.close();

  const pass = cfgRes.ok === true && status1.enabled === true &&
    (status1.routes || []).some(r => r.provider === 'arc' && r.cap === 1) &&
    (status1.routes || []).some(r => r.provider === 'ollama-local' && r.model === 'rtx' && r.cap === 1) &&
    !!persisted && persisted.routes.some(r => r.provider === 'ollama-local' && r.cap === 1) &&
    badRes.ok === false;
  log('E2E RESULT pass =', pass);
  console.log(JSON.stringify({ pass, rowFound, cardInBundlePage, routes, badRes, cfgPath }, null, 1));
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error('[e2e3] FATAL', e); process.exit(2); });
