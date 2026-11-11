#!/usr/bin/env node
// Audit E2E v2: pwtest-audit profile (git-installed dsh-subagent-pool) on port 3087.
// Path: bottom "… More" -> Settings -> Agent presets / Built-in plugins -> pool card -> configure -> Save -> verify.
const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const PORT = parseInt(process.argv[2] || '3087', 10);
const PREFIX = process.argv[3] || 'e2e';
const BASE = 'http://127.0.0.1:' + PORT;
const DSH_HOME = path.join(require('os').homedir(), '.dsh');
const OUT = __dirname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[e2e]', ...a);
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
  // wait for host endpoint
  let status0;
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(BASE + '/subagent-pool/status', { signal: AbortSignal.timeout(3000) }); if (r.ok) { status0 = await r.json(); break; } } catch (e) {}
    await sleep(1000);
  }
  if (!status0) throw new Error('no server on ' + BASE);
  log('host up. routes:', JSON.stringify((status0.routes || []).map(r => r.provider + '/' + r.model + ' cap=' + r.cap)), 'enabled:', status0.enabled, 'totalCap:', status0.totalCap);

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  await context.addCookies([Object.assign(cookie(PORT, secret()), { domain: '127.0.0.1', path: '/', secure: false })]);
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const dump = async (name) => {
    const body = await page.evaluate(() => document.body.innerText);
    fs.writeFileSync(path.join(OUT, PREFIX + '-' + name + '.txt'), body);
    await page.screenshot({ path: path.join(OUT, PREFIX + '-' + name + '.png'), fullPage: false });
    return body;
  };

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(5000);
  // bottom "… More" -> Settings
  const mores = page.locator('button:has-text("More")');
  await mores.nth(await mores.count() - 1).click(); await sleep(2000);
  await page.locator('button:has-text("Settings"), [role="menuitem"]:has-text("Settings"), a:has-text("Settings")').first().click();
  await sleep(4000);
  let b = await dump('1-settings');
  log('settings modal open. tabs visible:', /Agent presets/.test(b), /Built-in plugins/.test(b), /Models/.test(b));

  // try Agent presets tab first
  let cardFound = false;
  for (const tabName of ['Agent presets', 'Built-in plugins', 'Models']) {
    const tab = page.locator(`[role="tab"]:has-text("${tabName}"), button:has-text("${tabName}")`).first();
    if (!(await tab.count())) { log('tab not found:', tabName); continue; }
    await tab.click(); await sleep(3000);
    b = await dump('2-tab-' + tabName.replace(/\s+/g, ''));
    const hasCard = /Subagent Pool/.test(b);
    const hasKey = /subagent-model-selection/.test(b);
    log(`tab ${tabName}: SubagentPool=${hasCard} key=${hasKey}`);
    if (hasCard || hasKey) {
      // if the card is behind an item row, click the key label
      if (!hasCard && hasKey) {
        await page.getByText('subagent-model-selection', { exact: false }).first().click().catch(() => {});
        await sleep(2500);
        b = await dump('3-tab-' + tabName.replace(/\s+/g, '') + '-expanded');
        log('after expanding item: SubagentPool =', /Subagent Pool/.test(b));
      }
      if (/Subagent Pool/.test(b)) { cardFound = true; log('card visible in tab:', tabName); break; }
    }
  }
  if (!cardFound) throw new Error('pool card not found in any settings tab');

  b = await dump('4-card');
  log('card state: ACTIVE=', /\bACTIVE\b/.test(b), 'INACTIVE=', /\bINACTIVE\b/.test(b), 'Running=', /Running:/.test(b), 'Save=', /\bSave\b/.test(b), 'AddRoute=', /Add route/.test(b));

  const saveBtn = page.locator('button:has-text("Save")').first();
  const addBtn = page.locator('button:has-text("Add route")').first();
  if (!(await saveBtn.count()) || !(await addBtn.count())) throw new Error('card form controls missing');

  let blocks = page.locator('div[style*="dashed"]');
  log('route blocks:', await blocks.count());
  // route 0: arc cap 0 -> 1
  const b0 = blocks.nth(0);
  const cap0 = b0.locator('input[type="number"]').first();
  log('route0 cap before:', await cap0.inputValue(), '| route0 text:', (await b0.innerText()).split('\n').slice(0, 3).join(' / '));
  await cap0.fill('1');
  // total cap = 2
  const totalCap = page.locator('label:has-text("Total cap") input[type="number"]').first();
  if (await totalCap.count()) { log('totalCap before:', await totalCap.inputValue()); await totalCap.fill('2'); }
  const en = page.locator('label:has-text("Enabled") input[type="checkbox"]').first();
  if (await en.count() && !(await en.isChecked())) await en.check();
  // add ollama-local/rtx cap 1
  await addBtn.click(); await sleep(700);
  blocks = page.locator('div[style*="dashed"]');
  const bn = blocks.nth(await blocks.count() - 1);
  const sels = bn.locator('select');
  log('new route selects:', await sels.count());
  await sels.nth(0).selectOption('ollama-local');
  await sleep(600);
  await sels.nth(1).selectOption('rtx');
  await bn.locator('input[type="number"]').first().fill('1');
  if (await sels.count() >= 6) {
    await sels.nth(2).selectOption('').catch(() => {});       // maxThinking: no cap
    await sels.nth(3).selectOption('off').catch(() => {});      // profile.thinking
    await sels.nth(4).selectOption('fast').catch(() => {});     // profile.speed
    await sels.nth(5).selectOption('explicit').catch(() => {}); // profile.instructions
  }
  const texts = bn.locator('input[type="text"]');
  if (await texts.count() >= 2) {
    await texts.nth(0).fill('extraction, formatting, lookups, mechanical transforms');
    await texts.nth(1).fill('open-ended reasoning');
  }
  await dump('5-form-filled');
  await saveBtn.click();
  await sleep(3500);
  b = await dump('6-after-save');
  log('after save: ACTIVE=', /\bACTIVE\b/.test(b), 'ollama-local/rtx shown=', /ollama-local\/rtx/.test(b));

  // host-side verification
  const status1 = await (await fetch(BASE + '/subagent-pool/status')).json();
  const routes = (status1.routes || []).map(r => r.provider + '/' + r.model + ' cap=' + r.cap + ' tier=' + (r.tier || '-'));
  log('STATUS: enabled=' + status1.enabled, 'totalCap=' + status1.totalCap, 'routes:', routes.join(' | '));

  const cfgPath = path.join(DSH_HOME, 'profiles/pwtest-audit/node_modules/dsh-subagent-pool/subagent_pool_config.json');
  let persisted = null;
  if (fs.existsSync(cfgPath)) { persisted = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); log('persisted routes:', persisted.routes.map(r => r.provider + '/' + r.model + ' cap=' + r.cap).join(' | '), 'queue:', persisted.queueMaxWaitSec + 's/' + persisted.queueMaxLen); }

  const bad = { enabled: true, totalCap: 2, routes: [{ provider: 'no-such-provider', model: 'x', cap: 1 }] };
  const badRes = await (await fetch(BASE + '/subagent-pool/configure?config=' + encodeURIComponent(Buffer.from(JSON.stringify(bad)).toString('base64')))).json();
  log('negative configure:', JSON.stringify(badRes));

  log('page errors:', errs.slice(0, 8));
  await browser.close();

  const pass = status1.enabled === true &&
    (status1.routes || []).some(r => r.provider === 'arc' && r.cap === 1) &&
    (status1.routes || []).some(r => r.provider === 'ollama-local' && r.model === 'rtx' && r.cap === 1) &&
    persisted && persisted.routes.some(r => r.provider === 'ollama-local' && r.cap === 1) &&
    badRes.ok === false;
  log('E2E RESULT pass =', pass);
  console.log(JSON.stringify({ pass, routes, persistedRoutes: persisted && persisted.routes.map(r => r.provider + '/' + r.model + ' cap=' + r.cap), badRes }));
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error('[e2e] FATAL', e); process.exit(2); });
