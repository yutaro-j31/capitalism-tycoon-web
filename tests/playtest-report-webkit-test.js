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

  const base = `http://127.0.0.1:${appServer.address().port}/`;
  let browser;
  try {
    browser = await webkit.launch();
    const context = await browser.newContext({ ...devices['iPhone 13'], locale: 'ja-JP', serviceWorkers: 'block', acceptDownloads: true });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error.message || error)));
    await page.goto(`${base}play.html`, { waitUntil: 'networkidle' });

    const playerLabel = 'Test Founder 9284';
    const companyLabel = 'Test Company 7319';
    await page.locator('#setup-form input[name="playerName"]').fill(playerLabel);
    await page.locator('#setup-form input[name="companyName"]').fill(companyLabel);
    await page.locator('#setup-form').evaluate(form => form.requestSubmit());
    await page.locator('.topbar').waitFor();

    const beforeRaw = await page.evaluate(key => localStorage.getItem(key), rc.save.key);
    assert.ok(beforeRaw, 'save must exist before report download');
    await page.locator('.tabs button[data-tab="map"]').click();
    await page.locator('.tabs button[data-tab="home"]').click();
    await page.locator('.tabs button[data-tab="settings"]').click();

    const reportButton = page.locator('[data-playtest-report-action="download"]');
    await reportButton.waitFor();
    const downloadPromise = page.waitForEvent('download');
    await reportButton.click();
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /^capitalism-tycoon-playtest-week-\d+-/);
    const downloadPath = await download.path();
    assert.ok(downloadPath, 'download path missing');
    const reportText = fs.readFileSync(downloadPath, 'utf8');
    const report = JSON.parse(reportText);

    assert.equal(report.schemaVersion, 1);
    assert.equal(report.kind, 'capitalism-tycoon-playtest-report');
    assert.equal(report.diagnostics.gameVersion, rc.version);
    assert.equal(report.diagnostics.saveVersion, rc.save.version);
    assert.equal(report.activeTab, 'settings');
    assert.equal(report.save.present, true);
    assert.equal(report.save.readable, true);
    assert.match(report.save.checksum, /^fnv1a32-[0-9a-f]{8}$/);
    assert.ok(report.save.bytes > 0);
    assert.ok(report.recentActions.some(item => item.action === 'tab' && item.tab === 'map'));
    assert.ok(report.recentActions.some(item => item.action === 'tab' && item.tab === 'settings'));
    assert.equal(report.recentActions.at(-1).action, 'playtest-report-download');

    for (const forbidden of [playerLabel, companyLabel, 'companyName', 'playerName', 'companyCash', 'personalCash', 'stores']) {
      assert.equal(reportText.includes(forbidden), false, `playtest report leaked ${forbidden}`);
    }
    const afterRaw = await page.evaluate(key => localStorage.getItem(key), rc.save.key);
    assert.equal(afterRaw, beforeRaw, 'report download must not mutate save storage');
    assert.deepEqual(pageErrors, []);

    await page.screenshot({ path: path.join(OUT, 'playtest-report-webkit.png'), fullPage: true });
    fs.writeFileSync(path.join(OUT, 'playtest-report-webkit.json'), JSON.stringify({
      status: 'passed', version: rc.version, week: report.diagnostics.week,
      actionCount: report.recentActions.length, saveBytes: report.save.bytes,
      checksum: report.save.checksum
    }, null, 2) + '\n');
    console.log('playtest report WebKit test passed');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => appServer.close(resolve));
  }
}

main().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
