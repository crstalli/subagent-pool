#!/usr/bin/env node
// Fix E2E on a fresh git-installed profile: card renders on bundle detail page,
// configure via the card, then spawn a subagent on a configured route (allow)
// and on an unconfigured route (deny). Usage: node fix-e2e.cjs <port>
const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const PORT = parseInt(process.argv[2] || '3088', 10);
const BASE = 'http://127.0.0.1:' + PORT;
const DSH_HOME = path.join(require('os').homedir(), '.dsh');
const OUT = __dirname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function decodeBase64Url(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Buffer.from(s, 'base64'); }
function enc(b) { return b.toString('base64url'); }
function cookieFor(port) {
  const creds = fs.readFileSync(path.join(DSH_HOME, '.credentials.yaml'), 'utf8');
  const m = creds.match(/browser-session[^\n]*\n[^\n]*secret:\s*(\S+)/) || creds.match(/secret:\s*(\S+)/);
  const secret = decodeBase64Url(m[1]);
  const authority = '127.0.0.1:' + port;
  const payload = JSON.stringify({ version: 1, authority, issuedAt: Date.now(), expiresAt: Date.now() + 30 * 864e5 });
  const body = enc(Buffer.from(payload));
  const sig = crypto.createHmac('sha256', secret).update(body).digest();
  return { name: 'dsh-auth-' + crypto.createHash('sha256').update(authority).digest('base64url'), value: 'v1.' + body + '.' + enc(sig) };
}
const ROUTE_PROVIDER = 'arc';
const ROUTE_MODEL = 'qwen3.8-27b-k4_xl-thinking';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const ck = cookieFor(PORT);
  await page.context().addCookies([{ name: ck.name, value: ck.value, url: BASE }]);
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  // Force the card's text-input mode (deterministic Playwright fills; the select
  // dropdowns re-render on the card's 3s status poll and race with locators).
  await page.route('**/subagent-pool/models', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'blocked-for-test' }) }));

  // 1. home — this boot requires the one-time token URL first (it 303-sets the auth cookie)
  const bootLog = ['/tmp/final6.log', '/tmp/pwtest6.log', '/tmp/pwtest5.log', '/tmp/pwtest4.log', '/tmp/pwtest3.log', '/tmp/pwtest2.log'].map((f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } }).join('\n');
  const tm = bootLog.match(/http:\/\/127\.0\.0\.1:3088\/\?token=\S+/);
  if (tm) { await page.goto(tm[0], { waitUntil: 'domcontentloaded' }); await sleep(1500); }
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  const homeText = await page.locator('body').innerText().catch(() => '');
  fs.writeFileSync(path.join(OUT, 'fix-' + PORT + '-1-home.txt'), homeText.slice(0, 2000));
  await page.screenshot({ path: path.join(OUT, 'fix-' + PORT + '-1-home.png'), fullPage: false });
  console.log('home has New Session:', /New Session/i.test(homeText));

  // 2. Plugins page
  await page.getByText('Plugins', { exact: true }).first().click().catch(async () => {
    await page.locator('button:has-text("Plugins")').first().click();
  });
  await sleep(5000);
  const refreshBtn = page.locator('button:has-text("Refresh")').first();
  try {
    if (await refreshBtn.count()) {
      await refreshBtn.waitFor({ state: 'visible', timeout: 10000 });
      if (await refreshBtn.isEnabled()) { await refreshBtn.click(); console.log('clicked Refresh'); }
      else console.log('Refresh disabled (still loading); skipping click');
    }
  } catch (e) { console.log('refresh click skipped:', String(e.message).split('\n')[0]); }
  let found = false;
  for (let i = 0; i < 150 && !found; i++) {
    const t = await page.locator('body').innerText().catch(() => '');
    if (t.includes('dsh-subagent-pool')) { found = true; console.log('plugin row appeared after ~' + (i * 2) + 's'); break; }
    await sleep(2000);
  }
  if (!found) { console.log('PLUGIN ROW NOT FOUND'); fs.writeFileSync(path.join(OUT, 'fix-' + PORT + '-plugins.txt'), await page.locator('body').innerText().catch(() => '')); await browser.close(); return; }
  fs.writeFileSync(path.join(OUT, 'fix-' + PORT + '-2-plugins.txt'), (await page.locator('body').innerText().catch(() => '')).slice(0, 3000));

  // 3. open bundle detail
  await page.locator('body').getByText('dsh-subagent-pool', { exact: true }).first().click();
  let card = null;
  for (let i = 0; i < 60 && !card; i++) {
    card = await page.locator('h3', { hasText: 'Subagent Pool' }).count() ? page.locator('h3', { hasText: 'Subagent Pool' }).locator('..') : null;
    if (!card) await sleep(2000);
  }
  if (!card) { console.log('CARD NOT FOUND on bundle detail'); fs.writeFileSync(path.join(OUT, 'fix-' + PORT + '-3-detail.txt'), (await page.locator('body').innerText().catch(() => '')).slice(0, 4000)); await page.screenshot({ path: path.join(OUT, 'fix-' + PORT + '-3-detail.png') }); await browser.close(); return; }
  console.log('CARD FOUND');
  await sleep(3000);
  await page.screenshot({ path: path.join(OUT, 'fix-' + PORT + '-4-card.png'), fullPage: true });
  fs.writeFileSync(path.join(OUT, 'fix-' + PORT + '-4-card.txt'), (await card.innerText().catch(() => '')).slice(0, 2500));

  // 4. configure via the card (text-input mode): add a fresh nvidia route cap 1,
  //    remove the pre-existing rows, totalCap 1, enabled, save.
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    if (await card.locator('button[title="Remove route"]').count() >= 1) break;
  }
  await card.getByText('+ Add route').click();
  // locate the new row by its empty provider input
  let pvIdx = -1;
  for (let i = 0; i < 20 && pvIdx < 0; i++) {
    await sleep(500);
    const pvs = card.locator('input[placeholder="provider"]');
    const n = await pvs.count();
    for (let k = 0; k < n; k++) { if ((await pvs.nth(k).inputValue()) === '') { pvIdx = k; break; } }
  }
  console.log('new row provider input idx:', pvIdx, 'of', await card.locator('input[placeholder="provider"]').count());
  if (pvIdx < 0) throw new Error('new empty route row not found');
  const pv = card.locator('input[placeholder="provider"]').nth(pvIdx);
  await pv.fill(ROUTE_PROVIDER);
  await card.locator('input[placeholder="model"]').nth(pvIdx).fill(ROUTE_MODEL);
  await pv.locator('xpath=../input[@type="number"]').fill('1');
  console.log('new row set to', ROUTE_PROVIDER + '/' + ROUTE_MODEL, 'cap 1');
  // remove every row whose provider is not our new route
  for (let i = 0; i < 15; i++) {
    const rm = card.locator('button[title="Remove route"]');
    const n = await rm.count();
    if (n <= 1) break;
    let clicked = false;
    for (let k = 0; k < n && !clicked; k++) {
      const rowPv = await rm.nth(k).locator('xpath=../input[@placeholder="provider"]').inputValue().catch(() => '');
      if (rowPv !== ROUTE_PROVIDER) { await rm.nth(k).click(); clicked = true; }
    }
    if (!clicked) break;
    await sleep(800);
  }
  console.log('rows left:', await card.locator('button[title="Remove route"]').count());
  await card.locator('label', { hasText: 'Total cap' }).locator('input[type=number]').fill('1');
  const cb = card.locator('label', { hasText: 'Enabled' }).locator('input[type=checkbox]');
  if (!(await cb.isChecked())) await cb.check();
  await sleep(400);
  await page.screenshot({ path: path.join(OUT, 'fix-' + PORT + '-5-before-save.png'), fullPage: true });
  await card.getByText('Save', { exact: true }).click();
  // wait for save: poll status endpoint from node side is easier; wait for busy to clear / error text
  let saved = false;
  for (let i = 0; i < 30 && !saved; i++) {
    await sleep(1000);
    const st = await page.evaluate(() => fetch('/subagent-pool/status').then((r) => r.json()).catch(() => null));
    if (st && Array.isArray(st.routes) && st.routes.some((r) => r.provider === ROUTE_PROVIDER && r.model === ROUTE_MODEL && r.cap === 1)) saved = true;
  }
  console.log('SAVED via card:', saved);
  const errText = await card.locator('div').allTextContents().catch(() => []);
  const lastErr = errText.find((t) => /failed|error/i.test(t));
  console.log('card error shown:', lastErr || 'none');
  await page.screenshot({ path: path.join(OUT, 'fix-' + PORT + '-6-after-save.png'), fullPage: true });
  fs.writeFileSync(path.join(OUT, 'fix-' + PORT + '-6-card.txt'), (await card.innerText().catch(() => '')).slice(0, 2500));

  // 5. spawn test: home composer (contenteditable) starts a new session, targeted subagent call (allow)
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  const ta = page.locator('[contenteditable="true"]').first();
  await ta.waitFor({ timeout: 60000 });
  // switch the session model to the local arc provider (works without a real API key)
  await page.locator('body').getByText('nemotron', { exact: false }).first().click();
  await sleep(1500);
  await page.getByText('Model', { exact: true }).first().click();
  await sleep(1500);
  await page.getByText('Qwen3.8-27B-Q4_K_M-Thinking', { exact: true }).first().click();
  await sleep(1500);
  console.log('session model switched to arc');
  await ta.fill('Call the subagent tool exactly once with provider "' + ROUTE_PROVIDER + '", model "' + ROUTE_MODEL + '", and prompt "Reply with exactly: PONG-POOL-OK". Then tell me what the subagent returned.');
  await page.keyboard.press('Enter');
  let pong = false;
  for (let i = 0; i < 120 && !pong; i++) {
    const t = await page.locator('body').innerText().catch(() => '');
    if ((t.split('PONG-POOL-OK').length - 1) >= 2) { pong = true; console.log('SUBAGENT ALLOW+RESULT OK after ~' + (i * 2) + 's'); break; }
    await sleep(2000);
  }
  if (!pong) console.log('PONG not seen yet');
  await page.screenshot({ path: path.join(OUT, 'fix-' + PORT + '-7-spawn-allow.png'), fullPage: true });
  fs.writeFileSync(path.join(OUT, 'fix-' + PORT + '-7-spawn-allow.txt'), (await page.locator('body').innerText().catch(() => '')).slice(-6000));

  // 6. deny test: unconfigured route arc
  await sleep(3000);
  const ta2 = page.locator('[contenteditable="true"]').first();
  await ta2.waitFor({ timeout: 30000 });
  await ta2.fill('Now call the subagent tool once with provider "nvidia", model "nvidia/nemotron-3-ultra-550b-a55b", prompt "hi". Report the exact error.');
  await page.keyboard.press('Enter');
  let denied = false;
  for (let i = 0; i < 90 && !denied; i++) {
    const t = await page.locator('body').innerText().catch(() => '');
    if (t.includes('Subagent pool:') || t.includes('is not allowed')) { denied = true; console.log('DENY path OK after ~' + (i * 2) + 's'); break; }
    await sleep(2000);
  }
  if (!denied) console.log('deny text not seen');
  fs.writeFileSync(path.join(OUT, 'fix-' + PORT + '-8-spawn-deny.txt'), (await page.locator('body').innerText().catch(() => '')).slice(-6000));
  await page.screenshot({ path: path.join(OUT, 'fix-' + PORT + '-8-spawn-deny.png'), fullPage: true });

  console.log('console errors (first 5):', errors.slice(0, 5));
  await browser.close();
})().catch((e) => { console.error('E2E FAILED:', e); process.exit(1); });
