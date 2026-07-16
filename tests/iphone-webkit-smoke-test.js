'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { webkit, devices } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT_DIR = path.resolve(process.env.IPHONE_WEBKIT_ARTIFACT_DIR || path.join(ROOT, 'artifacts', 'iphone-webkit-smoke'));
const SAVE_KEY = 'capitalism_tycoon_web_v1';
const DEVICE_NAME = 'iPhone 13';
assert.ok(devices[DEVICE_NAME], `Playwright device descriptor is unavailable: ${DEVICE_NAME}`);

const MIME = new Map([
  ['.css', 'text/css; charset=utf-8'], ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'], ['.svg', 'image/svg+xml'], ['.webp', 'image/webp']
]);

function writeResult(value) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'result.json'), `${JSON.stringify(value, null, 2)}\n`);
}

function requestPath(rawUrl) {
  const pathname = decodeURIComponent(new URL(rawUrl, 'http://127.0.0.1').pathname);
  const resolved = path.resolve(ROOT, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
  assert.ok(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `request escaped repository root: ${pathname}`);
  return resolved;
}

function staticServer() {
  return http.createServer((request, response) => {
    try {
      const requested = requestPath(request.url || '/');
      const target = fs.statSync(requested).isDirectory() ? path.join(requested, 'index.html') : requested;
      const body = fs.readFileSync(target);
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-length': String(body.length),
        'content-type': MIME.get(path.extname(target).toLowerCase()) || 'application/octet-stream'
      });
      response.end(body);
    } catch (error) {
      response.writeHead(error?.code === 'ENOENT' ? 404 : 500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(error?.code === 'ENOENT' ? 'Not found' : String(error?.message || error));
    }
  });
}

async function startServer(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return `http://127.0.0.1:${address.port}/`;
}

async function stopServer(server) {
  await new Promise(resolve => server.close(resolve));
}

async function weeklySummary(page, action) {
  await page.locator(`button[data-action="${action}"]`).click();
  const modal = page.locator('#modal-root .summary-modal');
  await modal.waitFor({ state: 'visible', timeout: 30_000 });
  const text = await modal.innerText();
  assert.match(text, /週間経営レポート/);
  assert.match(text, /売上/);
  assert.match(text, /利益/);
  assert.match(text, /会社現金/);
  await page.locator('#modal-root button[data-action="close-modal"]').click();
  await modal.waitFor({ state: 'detached', timeout: 10_000 });
}

async function mobileLayout(page) {
  const layout = await page.evaluate(() => {
    const tabs = document.querySelector('.tabs');
    const controls = [...document.querySelectorAll('button, input, select')].map(element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        action: element.getAttribute('data-action') || '',
        displayed: style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0,
        inTabs: Boolean(element.closest('.tabs')),
        width: rect.width,
        height: rect.height,
        left: rect.left,
        right: rect.right
      };
    }).filter(control => control.displayed);
    return {
      viewportWidth: innerWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      tabs: tabs && {
        clientWidth: tabs.clientWidth,
        scrollWidth: tabs.scrollWidth,
        overflowX: getComputedStyle(tabs).overflowX
      },
      controls
    };
  });

  assert.ok(layout.documentScrollWidth <= layout.viewportWidth + 2, `document overflowed viewport: ${layout.documentScrollWidth} > ${layout.viewportWidth}`);
  assert.ok(layout.bodyScrollWidth <= layout.viewportWidth + 2, `body overflowed viewport: ${layout.bodyScrollWidth} > ${layout.viewportWidth}`);
  assert.ok(layout.tabs, 'game navigation tabs must be present');
  assert.ok(layout.tabs.scrollWidth >= layout.tabs.clientWidth, 'navigation must expose its complete horizontal strip');
  assert.match(layout.tabs.overflowX, /auto|scroll/, 'navigation must remain horizontally scrollable');
  assert.ok(layout.controls.length >= 8, 'expected interactive controls were not rendered');
  for (const control of layout.controls) {
    assert.ok(control.width >= 1 && control.height >= 1, `zero-sized control: ${JSON.stringify(control)}`);
    if (!control.inTabs) {
      assert.ok(control.right > 0 && control.left < layout.viewportWidth, `control is horizontally unreachable: ${JSON.stringify(control)}`);
    }
  }
}

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const server = staticServer();
  const baseUrl = await startServer(server);
  let browser;
  let page;
  const diagnostics = { consoleErrors: [], pageErrors: [], failedRequests: [] };
  const startedAt = new Date().toISOString();

  try {
    browser = await webkit.launch();
    const context = await browser.newContext({
      ...devices[DEVICE_NAME],
      acceptDownloads: true,
      locale: 'ja-JP',
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
      timezoneId: 'Asia/Tokyo'
    });
    page = await context.newPage();
    page.on('console', message => message.type() === 'error' && diagnostics.consoleErrors.push(message.text()));
    page.on('pageerror', error => diagnostics.pageErrors.push(error.message));
    page.on('requestfailed', request => diagnostics.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`));

    await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.locator('#setup-form').waitFor({ state: 'visible' });
    await page.locator('[data-setup-recovery]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#import-file').count(), 1);

    await page.locator('#setup-form input[name="playerName"]').fill('WebKit Tester');
    await page.locator('#setup-form input[name="companyName"]').fill('WebKit Holdings');
    await page.locator('#setup-form').evaluate(form => form.requestSubmit());
    await page.locator('.topbar').waitFor({ state: 'visible', timeout: 20_000 });
    assert.match(await page.locator('.topbar').innerText(), /WebKit Holdings/);

    const configuredSave = await page.evaluate(key => localStorage.getItem(key), SAVE_KEY);
    assert.ok(configuredSave, 'configured game must be persisted');
    assert.equal(JSON.parse(configuredSave).configured, true);

    await mobileLayout(page);
    await weeklySummary(page, 'advance-week');
    await weeklySummary(page, 'advance-4');
    const weekAfterAdvances = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).week, SAVE_KEY);
    assert.ok(Number.isFinite(weekAfterAdvances) && weekAfterAdvances >= 6, `unexpected saved week: ${weekAfterAdvances}`);

    await page.locator('button[data-action="tab"][data-tab="settings"]').click();
    await page.locator('button[data-action="save-now"]').waitFor({ state: 'visible' });
    for (const action of ['save-now', 'export-save', 'import-save', 'reset-game']) {
      assert.equal(await page.locator(`button[data-action="${action}"]`).count(), 1, `settings action missing: ${action}`);
    }
    await page.locator('button[data-action="save-now"]').click();

    const downloadPromise = page.waitForEvent('download');
    await page.locator('button[data-action="export-save"]').click();
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /^capitalism-tycoon-week-\d+\.json$/);
    const exportPath = path.join(ARTIFACT_DIR, 'exported-save.json');
    await download.saveAs(exportPath);
    const exportedSave = fs.readFileSync(exportPath, 'utf8');
    const exportedState = JSON.parse(exportedSave);
    assert.equal(exportedState.companyName, 'WebKit Holdings');

    await page.locator('button[data-action="reset-game"]').click();
    const confirmReset = page.locator('#modal-root button[data-action="confirm-reset"]');
    await confirmReset.waitFor({ state: 'visible' });
    const modal = await page.locator('#modal-root [data-modal-panel]').boundingBox();
    const viewportWidth = await page.evaluate(() => innerWidth);
    assert.ok(modal && modal.x >= -1 && modal.x + modal.width <= viewportWidth + 1, 'reset modal must fit the iPhone viewport');
    await confirmReset.click();
    await page.locator('#setup-form').waitFor({ state: 'visible', timeout: 20_000 });
    await page.locator('[data-setup-recovery]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#import-file').count(), 1);

    await page.locator('#import-file').setInputFiles({
      name: 'capitalism-tycoon-rc-save.json',
      mimeType: 'application/json',
      buffer: Buffer.from(exportedSave)
    });
    await page.locator('.topbar').waitFor({ state: 'visible', timeout: 20_000 });
    assert.match(await page.locator('.topbar').innerText(), /WebKit Holdings/);
    const restored = JSON.parse(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY));
    assert.equal(restored.week, exportedState.week);
    assert.equal(restored.companyName, exportedState.companyName);

    await mobileLayout(page);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'iphone-webkit-smoke.png'), fullPage: true });
    assert.deepEqual(diagnostics, { consoleErrors: [], pageErrors: [], failedRequests: [] });

    writeResult({
      status: 'passed', startedAt, completedAt: new Date().toISOString(),
      device: DEVICE_NAME, browser: 'WebKit', browserVersion: browser.version(),
      weekAfterAdvances, saveVersion: restored.saveVersion
    });
    console.log('iPhone WebKit smoke passed');
  } catch (error) {
    if (page) {
      try { await page.screenshot({ path: path.join(ARTIFACT_DIR, 'iphone-webkit-smoke-failure.png'), fullPage: true }); } catch (_) {}
    }
    writeResult({ status: 'failed', startedAt, completedAt: new Date().toISOString(), error: error?.stack || String(error), ...diagnostics });
    throw error;
  } finally {
    if (browser) await browser.close();
    await stopServer(server);
  }
}

main().catch(error => {
  console.error(error?.stack || error);
  process.exit(1);
});
