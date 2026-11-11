#!/usr/bin/env node
// Audit E2E: fresh pwtest-audit profile (git-installed dsh-subagent-pool), drive the
// Settings UI with Playwright, configure the pool, verify persistence + guard API.
// Usage: node test/audit-e2e.cjs [port]   (default 3087)
const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.argv[2] || '3087', 10);
const BASE = 'http://127.0.0.1:' + PORT;
const DSH_HOME = path.join(require('os').homedir(), '.dsh');
const OUT = __dirname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[audit-e2e]', ...a);

// --- auth cookie helpers (same scheme as test/e2e.js) ---
function decodeBase64Url(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}
function encodeBase64Url(buf) { return buf.toString('base64url'); }
function createDSHAuthCookie(port, secretB64) {
  const secret = decodeBase64Url(secretB64);
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 30 * 24 * 60 * 60 * 1000;
  const authority = '127.0.0.1:' + port;
  const payload = JSON.stringify({ version: 1, authority, issuedAt, expiresAt });
  const body = encodeBase64Url(Buffer.from(payload));
  const sig = crypto.createHmac('sha256', secret).update(body).digest();
  const cookieValue = 'v1.' + body + '.' + encodeBase64Url(sig);
  const cookieName = 'dsh-auth-' + encodeBase64Url(crypto.createHash('sha256').update(authority).digest());
  return { name: cookieName, value: cookieValue };
}
function getStoredSecret() {
  const credFile = path.join(DSH_HOME, '.credentials.yaml');
  const content = fs.readFileSync(credFile, 'utf-8');
  const m = content.match(/browser-session[^\n]*\n(?:\s+kind: grant\n\s+payload:\n\s+version: \d+\n\s+secret: (\S+))/);
  if (m) return m[1];
  for (const line of content.split('\n')) {
    if (line.trim().startsWith('secret:')) {
      const v = line.trim().replace('secret:', '').trim().replace(/"/g, '');
      if (v && v.length > 20) return v;
    }
  }
  return null;
}

async function waitServer() {
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(BASE + '/subagent-pool/status', { signal: AbortSignal.timeout(3000) });
      if (r.ok) return await r.json();
    } catch (e) {}
    await sleep(1000);
  }
  throw new Error('server on ' + BASE + ' never answered /subagent-pool/status');
}

(async () => {
  const status0 = await waitServer();
  log('server up. initial status routes:', JSON.stringify((status0.routes || []).map(r => r.provider + '/' + r.model + ' cap=' + r.cap)));
  log('initial enabled:', status0.enabled, 'totalCap:', status0.totalCap);

  const secret = getStoredSecret();
  if (!secret) throw new Error('no stored secret');
  const cookie = createDSHAuthCookie(PORT, secret);

  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  } catch (e) {
    log('bundled chromium failed (' + e.message.split('\n')[0] + '), trying /usr/bin/chromium-browser');
    browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  }
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await context.addCookies([{ name: cookie.name, value: cookie.value, domain: '127.0.0.1', path: '/', secure: false }]);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(5000);
  log('page title:', await page.title());
  await page.screenshot({ path: path.join(OUT, 'audit-01-home.png'), fullPage: false });

  // open Settings
  let clicked = false;
  const settingsBtn = page.locator('button:has-text("Settings"), [aria-label*="Settings" i], a:has-text("Settings")').first();
  if (await settingsBtn.count()) { await settingsBtn.click(); clicked = true; await sleep(3000); }
  log('clicked Settings button:', clicked);
  // try Plugins tab
  const pluginsTab = page.locator('[role="tab"]:has-text("Plugins"), button:has-text("Plugins"), a:has-text("Plugins")').first();
  if (await pluginsTab.count()) { await pluginsTab.click(); await sleep(2000); log('clicked Plugins tab'); }
  let body = await page.evaluate(() => document.body.innerText);
  fs.writeFileSync(path.join(OUT, 'audit-02-settings.txt'), body);
  log('settings page has "Plugins":', /Plugins/.test(body), '| has "Subagent Pool":', /Subagent Pool/.test(body), '| has subagent-model-selection:', /subagent-model-selection/.test(body));
  await page.screenshot({ path: path.join(OUT, 'audit-03-settings.png'), fullPage: true });

  // expand the pool item if it is a collapsed entry
  const itemLabel = page.getByText('subagent-model-selection', { exact: false }).first();
  if (await itemLabel.count()) { await itemLabel.click().catch(() => {}); await sleep(1500); }
  const poolHeading = page.getByText('Subagent Pool', { exact: false }).first();
  log('pool heading count:', await page.getByText('Subagent Pool', { exact: false }).count());
  if (await poolHeading.count()) { await poolHeading.click().catch(() => {}); await sleep(1500); }

  body = await page.evaluate(() => document.body.innerText);
  fs.writeFileSync(path.join(OUT, 'audit-04-pool-visible.txt'), body);
  log('after open: ACTIVE badge:', /\bACTIVE\b/.test(body), 'INACTIVE:', /\bINACTIVE\b/.test(body), 'Save btn:', /Save/.test(body), 'Add route:', /Add route/.test(body));
  await page.screenshot({ path: path.join(OUT, 'audit-05-pool-card.png'), fullPage: true });

  const saveBtn = page.locator('button:has-text("Save")').first();
  const addBtn = page.locator('button:has-text("Add route")').first();
  if (!(await saveBtn.count()) || !(await addBtn.count())) throw new Error('pool card form not found (save/add missing)');

  // route blocks = dashed-border divs
  let blocks = page.locator('div[style*="dashed"]');
  log('route blocks:', await blocks.count());

  // route 0 (arc/...): cap 0 -> 1
  const b0 = blocks.nth(0);
  const cap0 = b0.locator('input[type="number"]').first();
  log('route0 provider/model text:', (await b0.innerText()).split('\n').slice(0, 2).join(' | '));
  log('route0 cap before:', await cap0.inputValue());
  await cap0.fill('1');

  // ensure total cap = 2
  const totalCap = page.locator('label:has-text("Total cap") input[type="number"]').first();
  if (await totalCap.count()) { log('totalCap before:', await totalCap.inputValue()); await totalCap.fill('2'); }
  // ensure enabled checkbox checked
  const en = page.locator('label:has-text("Enabled") input[type="checkbox"]').first();
  if (await en.count() && !(await en.isChecked())) await en.check();

  // add route: ollama-local / rtx, cap 1
  await addBtn.click(); await sleep(600);
  blocks = page.locator('div[style*="dashed"]');
  const n = await blocks.count();
  const bn = blocks.nth(n - 1);
  const sels = bn.locator('select');
  log('new route block selects:', await sels.count());
  await sels.nth(0).selectOption('ollama-local');
  await sleep(500);
  await sels.nth(1).selectOption('rtx');
  await bn.locator('input[type="number"]').first().fill('1');
  if (await sels.count() >= 6) {
    await sels.nth(3).selectOption('off').catch(() => {});      // profile.thinking
    await sels.nth(4).selectOption('fast').catch(() => {});     // profile.speed
    await sels.nth(5).selectOption('explicit').catch(() => {}); // profile.instructions
  }
  const texts = bn.locator('input[type="text"]');
  if (await texts.count() >= 2) {
    await texts.nth(0).fill('extraction, formatting, lookups, mechanical transforms');
    await texts.nth(1).fill('open-ended reasoning');
  }
  await page.screenshot({ path: path.join(OUT, 'audit-06-form-filled.png'), fullPage: true });

  // save
  await saveBtn.click();
  await sleep(3000);
  body = await page.evaluate(() => document.body.innerText);
  fs.writeFileSync(path.join(OUT, 'audit-07-after-save.txt'), body);
  await page.screenshot({ path: path.join(OUT, 'audit-08-after-save.png'), fullPage: true });
  log('after save: ACTIVE:', /\bACTIVE\b/.test(body), '| arc cap1 row:', /arc\/qwen3\.8-27b-k4_xl-thinking[\s\S]{0,80}cap 1/.test(body), '| ollama route shown:', /ollama-local\/rtx/.test(body));

  // verify via host API
  const status1 = await (await fetch(BASE + '/subagent-pool/status')).json();
  const routes = (status1.routes || []).map((r) => r.provider + '/' + r.model + ' cap=' + r.cap + ' tier=' + (r.tier || ''));
  log('STATUS AFTER SAVE: enabled=' + status1.enabled + ' totalCap=' + status1.totalCap + ' routes: ' + routes.join(' | '));

  // persisted file in the git-installed copy
  const cfgPath = path.join(DSH_HOME, 'profiles/pwtest-audit/node_modules/dsh-subagent-pool/subagent_pool_config.json');
  log('persisted config exists:', fs.existsSync(cfgPath));
  if (fs.existsSync(cfgPath)) {
    const persisted = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    log('persisted routes:', persisted.routes.map((r) => r.provider + '/' + r.model + ' cap=' + r.cap).join(' | '));
  }

  // negative validation: unknown provider must be rejected
  const bad = { enabled: true, totalCap: 2, routes: [{ provider: 'no-such-provider', model: 'x', cap: 1 }] };
  const badRes = await (await fetch(BASE + '/subagent-pool/configure?config=' + encodeURIComponent(Buffer.from(JSON.stringify(bad)).toString('base64')))).json();
  log('negative configure (unknown provider):', JSON.stringify(badRes));

  log('console errors (' + consoleErrors.length + '):', consoleErrors.slice(0, 8));
  await browser.close();

  const pass = status1.enabled === true &&
    (status1.routes || []).some((r) => r.provider === 'arc' && r.cap === 1) &&
    (status1.routes || []).some((r) => r.provider === 'ollama-local' && r.model === 'rtx' && r.cap === 1) &&
    badRes.ok === false;
  log('E2E RESULT pass =', pass);
  console.log(JSON.stringify({ pass, routes, badRes }, null, 1));
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error('[audit-e2e] FATAL', e); process.exit(2); });
