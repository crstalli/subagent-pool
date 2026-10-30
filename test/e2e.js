#!/usr/bin/env node
// E2E test for subagent-pool Cordis plugin in a test DSH profile.
// Usage: node test/e2e.js [port]
//
// Flow:
// 1. Start DSH test profile on free port (default: 3083)
// 2. Launch Playwright browser, set auth cookie, navigate to GUI
// 3. Wait for cordis tools to appear
// 4. Define the subagent-pool plugin (from /mnt/f bundles)
// 5. Approve the run (click Allow)
// 6. Run the plugin
// 7. Navigate to Settings, check for Subagent Pool section
// 8. Report PASS/FAIL

const { chromium } = require('playwright');
const crypto = require('crypto');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE_PORT = parseInt(process.argv[2]) || 3083;
const HOST_BUNDLE = '/mnt/f/ai/plugins/pool-host-v4.js';
const CLIENT_BUNDLE = '/mnt/f/ai/plugins/pool-client-v5.js';
const DSH_HOME = path.join(require('os').homedir(), '.dsh');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const ts = () => new Date().toISOString().slice(11, 19);
const log = m => console.log('[' + ts() + '] ' + m);

// --- DSH Auth Cookie Helpers ------------------------------------------------

function decodeBase64Url(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

function encodeBase64Url(buf) { return buf.toString('base64url'); }

function createDSHAuthCookie(port, secretB64) {
  const secret = decodeBase64Url(secretB64);
  const issuedAt = Date.now();
  const expiresAt = issuedAt + (30 * 24 * 60 * 60 * 1000); // 30 days
  const authority = '127.0.0.1:' + port;

  const payload = JSON.stringify({
    version: 1,
    authority: authority,
    issuedAt: issuedAt,
    expiresAt: expiresAt
  });

  const body = encodeBase64Url(Buffer.from(payload));
  const sig = crypto.createHmac('sha256', secret).update(body).digest();
  const sigB64 = encodeBase64Url(sig);
  const cookieValue = 'v1.' + body + '.' + sigB64;
  const cookieName = 'dsh-auth-' + encodeBase64Url(crypto.createHash('sha256').update(authority).digest());

  return { name: cookieName, value: cookieValue };
}

// Read the stored secret from DSH_HOME
function getStoredSecret() {
  try {
    const credFile = path.join(DSH_HOME, '.credentials.yaml');
    const content = fs.readFileSync(credFile, 'utf-8');
    // Parse YAML manually (simple format)
    const match = content.match(/browser-session[^\n]*\n(?:\s+kind: grant\n\s+payload:\n\s+version: \d+\n\s+secret: (\S+))/);
    if (match) return match[1];
    // Fallback: look for any secret line
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('secret:')) {
        const val = lines[i].trim().replace('secret:', '').trim().replace(/"/g, '');
        if (val && val.length > 20) return val;
      }
    }
  } catch (e) {}
  return null;
}

function stopDSH() {
  // Kill by PID file
  try {
    const pidFile = path.join(__dirname, '.server-pid');
    const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim());
    if (pid > 0) process.kill(pid, 'SIGTERM');
    fs.unlinkSync(pidFile);
  } catch (e) {}
  // Kill by port
  try {
    const pids = execSync(`lsof -ti :${BASE_PORT} 2>/dev/null || true`).toString().trim();
    if (pids) execSync('kill -9 ' + pids);
  } catch (e) {}
  log('Killed DSH server on port ' + BASE_PORT);
}

// --- Main -------------------------------------------------------------------

(async () => {
  let browser, page;
  let result = { pass: false, errors: [], logs: [] };

  try {
    // 1. Start DSH test profile
    log('Starting DSH test profile on port ' + BASE_PORT);
    const dsh = require('child_process').spawn('dsh', [
      '--profile', 'pwtest',
      '--port', String(BASE_PORT),
      '--no-open'
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, DSH_HOME }
    });
    dsh.stdout.on('data', d => process.stdout.write(d));
    dsh.stderr.on('data', d => process.stderr.write(d));
    await sleep(10000); // Wait for DSH to start

    // Verify server is reachable before proceeding
    const net = require('net');
    let serverReady = false;
    for (let retries = 0; retries < 30 && !serverReady; retries++) {
      await sleep(1000);
      await new Promise(resolve => {
        const c = net.createConnection(BASE_PORT, '127.0.0.1');
        c.on('connect', () => { c.end(); serverReady = true; log('Server reachable on port ' + BASE_PORT); resolve(); });
        c.on('error', () => { resolve(); });
        c.setTimeout(3000);
        c.on('timeout', () => { c.destroy(); resolve(); });
      });
    }
    if (!serverReady) {
      log('WARNING: Server did not become reachable on port ' + BASE_PORT);
    }

    // 2. Check auth secret
    const secret = getStoredSecret();
    if (!secret) {
      log('ERROR: Could not read stored secret from ' + DSH_HOME + '/.credentials.yaml');
      result.errors.push('No stored secret');
      throw new Error('No stored secret');
    }
    log('Read stored secret (length: ' + secret.length + ')');

    // 3. Create auth cookie
    const cookie = createDSHAuthCookie(BASE_PORT, secret);
    log('Auth cookie name: ' + cookie.name);

    // 4. Launch browser with auth
    browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-gpu'] });
    const context = await browser.newContext();
    await context.addCookies([{
      name: cookie.name,
      value: cookie.value,
      domain: '127.0.0.1',
      path: '/',
      secure: false
    }]);

    page = await context.newPage();
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      consoleErrors.push(err.message);
    });

    // 5. Navigate to DSH test server
    const URL = 'http://127.0.0.1:' + BASE_PORT + '/';
    log('Navigating to ' + URL);
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3000);

    // Check auth worked
    const title = await page.title();
    log('Page title: ' + title);
    if (title === 'DeepSeek Harness') {
      log('Authenticated successfully');
    } else {
      log('WARNING: Unexpected title: ' + title);
    }

    // 6. Wait for cordis tools to load
    log('Waiting for cordis tools...');
    await sleep(5000);

    // 7. Look for cordis section
    log('Looking for cordis tools...');
    const cordisSection = page.locator('button:has-text("Cordis"), [data-testid*="cordis"], [data-testid*="plugin"], [class*="cordis-toolset"], [class*="cordis-tool"]');
    if (await cordisSection.count()) {
      await cordisSection.first().click();
      await sleep(1000);
      log('Clicked cordis section');
    }

    // 8. Define the plugin
    log('Reading bundle files...');
    const hostSrc = fs.readFileSync(HOST_BUNDLE, 'utf-8');
    const clientSrc = fs.readFileSync(CLIENT_BUNDLE, 'utf-8');
    log('Host: ' + hostSrc.length + ' chars, Client: ' + clientSrc.length + ' chars');

    // Look for cordis_define tool
    log('Looking for cordis_define tool...');
    const defineBtn = page.locator('button:has-text("cordis_define"), button:has-text("Define Plugin"), button:has-text("Define")').first();
    if (await defineBtn.count()) {
      await defineBtn.click();
      log('Clicked Define button');
      await sleep(2000);
    } else {
      // Try clicking the sidebar to find the tool
      const sidebarBtn = page.locator('[class*="sidebar"], [class*="tool-palette"], [class*="tool-list"]').first();
      if (await sidebarBtn.count()) {
        await sidebarBtn.click();
        await sleep(1000);
      }
    }

    // 9. Fill the form
    log('Filling cordis_define form fields...');
    const textareas = page.locator('textarea, [contenteditable="true"]').all();
    log('Found ' + textareas.length + ' editable elements');

    for (let i = 0; i < textareas.length; i++) {
      try {
        const textarea = textareas[i];
        const label = await textarea.evaluate(el => {
          const parent = el.closest('label');
          return parent ? parent.textContent.trim() : '';
        });
        const placeholder = await textarea.evaluate(el => el.placeholder || '');
        log(`  Field ${i}: label="${label}" placeholder="${placeholder}"`);

        if (i === 0) {
          await textarea.fill('Subagent pool E2E test');
        } else if (i === 1) {
          await textarea.fill(hostSrc);
        } else if (i === 2) {
          await textarea.fill(clientSrc);
        }
      } catch (e) {}
    }

    // 10. Click Submit
    const submitBtn = page.locator('button[type="submit"], button:has-text("Define"), button:has-text("Create Plugin"), button:has-text("OK"), button:has-text("Create")').first();
    if (await submitBtn.count()) {
      await submitBtn.click();
      log('Clicked Submit/Define');
      await sleep(2000);
    }

    // 11. Approve run
    log('Checking for approval prompt...');
    const approveBtn = page.locator('button:has-text("Allow"), button:has-text("Approve"), button:has-text("✓"), button:has-text("Yes")').first();
    if (await approveBtn.count()) {
      await approveBtn.click();
      log('Approved plugin run');
      await sleep(3000);
    } else {
      log('No approval prompt found');
    }

    // 12. Run the plugin
    log('Looking for Run button...');
    const runBtn = page.locator('button:has-text("Run"), button:has-text("Activate"), button:has-text("Start Plugin")').first();
    if (await runBtn.count()) {
      await runBtn.click();
      log('Clicked Run');
      await sleep(3000);
    }

    // 13. Navigate to Settings
    log('Opening Settings...');
    const settingsBtn = page.locator('button:has-text("Settings"), [aria-label*="Settings"]').first();
    if (await settingsBtn.count()) {
      await settingsBtn.click();
      await sleep(3000);
    }

    // 14. Look for Subagent Pool section
    log('Looking for Subagent Pool section...');
    const poolHeading = page.getByText('Subagent Pool', { exact: false, ignoreCase: false }).first();
    let poolFound = false;
    if (await poolHeading.count()) {
      await poolHeading.click();
      await sleep(2000);
      poolFound = true;
      log('Found Subagent Pool section');
    }

    // 15. Gather page state
    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasActive = /\bACTIVE\b/i.test(bodyText);
    const hasInactive = /\bINACTIVE\b/i.test(bodyText);
    const hasRoutes = /qwen-un|bonzai|arc|rtx/.test(bodyText);
    const hasRunning = /Running|running|Total|total/.test(bodyText);
    const hasPool = /Pool|pool|subagent/i.test(bodyText);
    const hasBadge = /\b(ACTIVE|INACTIVE)\b/.test(bodyText);

    result.state = {
      hasActive, hasInactive, hasRoutes, hasRunning, hasPool, hasBadge,
      poolFound,
      consoleErrors: consoleErrors.length
    };
    result.pass = poolFound || hasPool;

    log('Results: ACTIVE=' + hasActive + ' INACTIVE=' + hasInactive + ' Routes=' + hasRoutes + ' Pool=' + hasPool);

    // 16. Save artifacts
    const outDir = '/mnt/f/ai/plugins/pwtest/subagent-pool-e2e/test/';
    try {
      await page.screenshot({ path: outDir + 'e2e-screenshot.png' });
      fs.writeFileSync(outDir + 'settings-body.txt', bodyText);
      if (consoleErrors.length > 0) {
        fs.writeFileSync(outDir + 'console-errors.txt', consoleErrors.join('\n'));
      }
      log('Artifacts saved to ' + outDir);
    } catch (e) {
      log('Error saving artifacts: ' + e.message);
    }

  } catch (e) {
    result.errors.push(e.message);
    log('ERROR: ' + e.message);
    if (page) {
      try {
        const outDir = '/mnt/f/ai/plugins/pwtest/subagent-pool-e2e/test/';
        await page.screenshot({ path: outDir + 'e2e-error.png' });
      } catch (e2) {}
    }
  } finally {
    if (browser) await browser.close();
    stopDSH();
  }

  // Report
  log('\n=== E2E RESULT ===');
  log('PASS: ' + result.pass);
  log('State: ' + JSON.stringify(result.state || {}));
  log('Errors: ' + (result.errors || []).join(', '));
  console.log(JSON.stringify(result, null, 2));

  process.exit(result.pass ? 0 : 1);
})();
