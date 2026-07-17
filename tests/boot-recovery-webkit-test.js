'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { webkit, devices } = require('playwright');
const rc = require('../release-candidate.json');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.env.IPHONE_WEBKIT_ARTIFACT_DIR || path.join(ROOT, 'artifacts', 'iphone-webkit-smoke'));
const save = JSON.stringify({ saveVersion: rc.save.version, configured: true, week: 12, companyName: 'Boot Recovery Co', companyCash: 5000000 });

function server() {
  return http.createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname);
      if (pathname.endsWith('/js/runtime.js')) {
        res.writeHead(404, { 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8' });
        res.end('intentional boot recovery probe');
        return;
      }
      const file = path.resolve(ROOT, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
      assert.ok(file.startsWith(ROOT + path.sep));
      const body = fs.readFileSync(file);
      res.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html'
      });
      res.end(body);
    } catch (error) {
      res.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'content-type': 'text/plain; charset=utf-8' });
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
    const context = await browser.newContext({ ...devices['iPhone 13'], acceptDownloads: true, locale: 'ja-JP', serviceWorkers: 'block' });
    await context.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: rc.save.key, value: save });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'load', timeout: 30_000 });

    const panel = page.locator('#boot-recovery-root [role="dialog"]');
    await panel.waitFor({ state: 'visible', timeout: 20_000 });
    const text = await panel.innerText();
    assert.match(text, /起動エラーから復旧/);
    assert.match(text, /端末内のセーブは削除していません/);
    assert.equal(await page.locator('#runtime-recovery-root [role="dialog"]').count(), 0,
      'full runtime recovery cannot be required when runtime.js failed');
    assert.equal(await page.evaluate(key => localStorage.getItem(key), rc.save.key), save,
      'boot recovery must not mutate the save');

    const downloadPromise = page.waitForEvent('download');
    await panel.locator('[data-boot-recovery-action="backup"]').click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'capitalism-tycoon-boot-recovery-week-12.json');
    const backupPath = path.join(OUT, 'boot-recovery-save.json');
    await download.saveAs(backupPath);
    assert.equal(fs.readFileSync(backupPath, 'utf8'), save);

    await page.screenshot({ path: path.join(OUT, 'boot-recovery-webkit.png'), fullPage: true });
    const reload = panel.locator('[data-boot-recovery-action="reload"]');
    await reload.click();
    await page.waitForURL(target => target.pathname.endsWith('/play.html') && target.searchParams.has('reload'), { timeout: 20_000 });
    assert.equal(await page.evaluate(key => localStorage.getItem(key), rc.save.key), save,
      'cache-safe restart must preserve the save');

    fs.writeFileSync(path.join(OUT, 'boot-recovery-webkit.json'), JSON.stringify({
      status: 'passed',
      device: 'iPhone 13',
      week: 12,
      entrypoint: new URL(page.url()).pathname
    }, null, 2) + '\n');
    console.log('boot recovery WebKit test passed');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => appServer.close(resolve));
  }
}

main().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
