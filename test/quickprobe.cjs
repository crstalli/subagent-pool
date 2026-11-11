const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox','--disable-dev-shm-usage'] });
  const p = await b.newPage();
  const log = fs.readFileSync('/tmp/pwtest2.log','utf8');
  const tm = log.match(/http:\/\/127\.0\.0\.1:3088\/\?token=\S+/);
  await p.goto(tm[0], { waitUntil: 'domcontentloaded' });
  await new Promise(r=>setTimeout(r,2000));
  console.log('url after token:', p.url());
  console.log('cookies:', (await p.context().cookies()).map(c=>c.name).join(','));
  await p.goto('http://127.0.0.1:3088/', { waitUntil: 'domcontentloaded' });
  await new Promise(r=>setTimeout(r,6000));
  console.log('url now:', p.url());
  console.log('body text:', (await p.locator('body').innerText().catch(()=>'<none>')).slice(0,600));
  console.log('main count:', await p.locator('main').count());
  await p.screenshot({ path: '/tmp/quick-3088.png' });
  await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
