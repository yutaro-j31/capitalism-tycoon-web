'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { webkit, devices } = require('playwright');
const rc = require('../release-candidate.json');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.env.IPHONE_WEBKIT_ARTIFACT_DIR || path.join(ROOT, 'artifacts', 'iphone-webkit-smoke'));

function server() {
  return http.createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname);
      const file = path.resolve(ROOT, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
      assert.ok(file.startsWith(ROOT + path.sep));
      const body = fs.readFileSync(file);
      res.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html'
      });
      res.end(body);
    } catch (error) {
      res.writeHead(error.code === 'ENOENT' ? 404 : 500);
      res.end(String(error.message || error));
    }
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const appServer = server();
  await new Promise((resolve, reject) => {
    appServer.once('error', reject);
    appServer.listen(0, '127.0.0.1', resolve);
  });

  const url = `http://127.0.0.1:${appServer.address().port}/`;
  let browser;
  try {
    browser = await webkit.launch();
    const context = await browser.newContext({ ...devices['iPhone 13'], locale: 'ja-JP', serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.locator('#setup-form input[name="companyName"]').fill('Recovery Holdings');
    await page.locator('#setup-form').evaluate(form => form.requestSubmit());
    await page.locator('.topbar').waitFor();

    const beforeRaw = await page.evaluate(key => localStorage.getItem(key), rc.save.key);
    assert.ok(beforeRaw, 'save must exist before runtime error');
    const before = JSON.parse(beforeRaw);

    await page.evaluate(() => {
      setTimeout(() => {
        throw new Error('<webkit recovery probe>');
      }, 0);
    });

    const panel = page.locator('#runtime-recovery-root [role="dialog"]');
    await panel.waitFor();
    const text = await panel.innerText();
    assert.match(text, /エラーから復旧/);
    assert.match(text, /<webkit recovery probe>/);
    assert.match(text, /端末内のセーブは削除していません/);

    const afterRaw = await page.evaluate(key => localStorage.getItem(key), rc.save.key);
    assert.equal(afterRaw, beforeRaw, 'runtime recovery must not mutate save storage');

    const payload = await page.evaluate(() => {
      const modules = globalThis.__capitalismTycoonModules;
      const root = document.getElementById(modules.runtimeRecoveryUI.ROOT_ID);
      return modules.runtimeRecoveryUI.supportPayload(root.__runtimeRecoveryRecord);
    });
    assert.equal(payload.runtimeError.message, '<webkit recovery probe>');
    for (const key of ['companyCash', 'personalCash', 'companyName', 'playerName', 'stores']) {
      assert.equal(key in payload, false, `diagnostics payload leaked ${key}`);
    }

    await panel.locator('[data-runtime-recovery-action="close"]').click();
    await page.locator('#runtime-recovery-root').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('.topbar').isVisible(), true, 'game UI must remain available after closing recovery');

    await page.screenshot({ path: path.join(OUT, 'runtime-recovery-webkit.png'), fullPage: true });
    fs.writeFileSync(path.join(OUT, 'runtime-recovery-webkit.json'), JSON.stringify({
      status: 'passed',
      version: rc.version,
      week: before.week,
      runtimeError: payload.runtimeError
    }, null, 2) + '\n');
    console.log('runtime recovery WebKit test passed');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => appServer.close(resolve));
  }
}

main().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
