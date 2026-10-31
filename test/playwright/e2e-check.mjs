import { chromium } from 'playwright';

const DISPLAY = ':0';

async function main() {
  const browser = await chromium.launch({
    headless: false,
    executablePath: '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    env: { DISPLAY: DISPLAY, LD_LIBRARY_PATH: '/home/cztl/pwlibs/usr/lib/x86_64-linux-gnu/' }
  });

  const context = await browser.newContext({
    viewport: { width: 1200, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    console.log('[E2E] Opening DSH Web GUI...');
    await page.goto('http://127.0.0.1:3080', { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('[E2E] Page loaded. URL:', page.url());

    // Wait for the page to be ready
    await page.waitForTimeout(8000);
    console.log('[E2E] Page settled. Checking for DSH UI...');

    // Check if the DSH GUI is showing
    const title = await page.title().catch(() => 'unknown');
    console.log('[E2E] Page title:', title);

    // Check for sidebar - look for the DSH sidebar element
    const sidebarEl = await page.$('[id*="sidebar"], [class*="sidebar"], [data-testid*="sidebar"]');
    if (sidebarEl) {
      console.log('[E2E] Sidebar found:', await page.evaluate(el => el.tagName, sidebarEl));
    } else {
      // Try a broader search
      const sidebarHTML = await page.$eval('body', el => el.innerHTML.substring(0, 500));
      console.log('[E2E] No sidebar element found. Body start:', sidebarHTML);
    }

    // Look for the subagent indicator in sidebar footer
    const indicatorBtn = await page.$('button:has-text("Subagents:"), button:has-text("Idle"), button:has-text("active")');
    if (indicatorBtn) {
      const text = await page.evaluate(el => el.textContent, indicatorBtn);
      console.log('[E2E] ✅ Subagent indicator found:', text);
    } else {
      console.log('[E2E] ⚠️  Subagent indicator NOT found. Checking for other sidebar content...');
      // Try to find any button in the sidebar area
      const buttons = await page.$$eval('button', els => els.map(el => el.textContent || '').slice(0, 20));
      console.log('[E2E] Available buttons:', buttons);
    }

    // Check the URL and page state
    console.log('[E2E] Page status: ready');
    console.log('[E2E] E2E test completed.');
  } catch (e) {
    console.error('[E2E] ERROR:', e.message);
    await page.screenshot({ path: '/tmp/e2e-error.png' }).catch(() => {});
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch(console.error);
