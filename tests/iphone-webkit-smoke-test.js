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

const MIME_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp']
]);

function writeJson(name, value) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(path.join(ARTIFACT_DIR, name), `${JSON.stringify(value, null, 2)}\n`);
}

function resolveRequestPath(rawUrl) {
  const pathname = decodeURIComponent(new URL(rawUrl, 'http://127.0.0.1').pathname);
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const resolved = path.resolve(ROOT, relative);
  assert.ok(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `request escaped repository root: ${pathname}`);
  return resolved;
}

function createStaticServer() {
  return http.createServer((request, response) => {
    try {
      const filePath = resolveRequestPath(request.url || '/');
      const stat = fs.statSync(filePath);
      const target = stat.isDirectory() ? path.join(filePath, 'index.html') : filePath;
      const body = fs.readFileSync(target);
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-length': String(body.length),
        'content-type': MIME_TYPES.get(path.extname(target).toLowerCase()) || 'application/octet-stream'
      });
      response.end(body);
    } catch (error) {
      response.writeHead(error && error.code === 'ENOENT' ? 404 : 500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(error && error.code === 'ENOENT' ? 'Not found' : String(error && error.message || error));
    }
  });
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return `http://127.0.0.1:${address.port}/`;
}

async function closeServer(server) {
  await new Promise(resolve => server.close(resolve));
}

async function clickAndWaitForSummary(page, action) {
  await page.locator(`button[data-action="${action}"]`).click();
  const heading = page.locator('#modal-root .summary-modal h2');
  await heading.waitFor({ state: 'visible', timeout: 30_000 });
  assert.equal((await heading.textContent()).trim(), '週間経営レポート');
  const summaryText = await page.locator('#modal-root .summary-modal').innerText();
  assert.match(summaryText, /売上/);
  assert.match(summaryText, /利益/);
  assert.match(summaryText, /会社現金/);
  await page.locator('#modal-root button[data-action="close-modal"]').click();
  await page.locator('#modal-root .summary-modal').waitFor({ state: 'detached', timeout: 10_000 });
}

async function assertMobileLayout(page) {
  const layout = await page.evaluate(() => {
    const tabs = document.querySelector('.tabs');
    const visibleControls = [...document.querySelectorAll('button, input, select')]
      .filter(element => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      })
      .map(element => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          action: element.getAttribute('data-action') || '',
          width: rect.width,
          height: rect.height,
          left: rect.left,
          right: rect.right
        };
      });
    return {
      viewportWidth: window.innerWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      tabs: tabs ? {
        clientWidth: tabs.clientWidth,
        scrollWidth: tabs.scrollWidth,
        overflowX: getComputedStyle(tabs).overflowX
      } : null,
      visibleControls
    };
  });

  assert.ok(layout.documentScrollWidth <= layout.viewportWidth + 2, `document overflowed viewport: ${layout.documentScrollWidth} > ${layout.viewportWidth}`);
  assert.ok(layout.bodyScrollWidth <= layout.viewportWidth + 2, `body overflowed viewport: ${layout.bodyScrollWidth} > ${layout.viewportWidth}`);
  assert.ok(layout.tabs, 'game navigation tabs must be present');
  assert.ok(layout.tabs.scrollWidth >= layout.tabs.clientWidth, 'navigation must expose its complete horizontal strip');
  assert.match(layout.tabs.overflowX, /auto|scroll/, 'navigation overflow must remain horizontally scrollable');
  assert.ok(layout.visibleControls.length >= 8, 'expected interactive controls were not rendered');
  for (const control of layout.visibleControls) {
    assert.ok(control.width >= 1 && control.height >= 1, `zero-sized interactive control: ${JSON.stringify(control)}`);
    assert.ok(control.right > 0 && control.left < layout.viewportWidth, `interactive control is completely off-screen: ${JSON.stringify(control)}`);
  }
}

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const server = createStaticServer();
  const baseUrl = await listen(server);
  let browser;
  let page;
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
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
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('requestfailed', request => failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`));

    await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.locator('#setup-form').waitFor({ state: 'visible' });
    await page.locator('[data-setup-recovery]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#import-file').count(), 1, 'fresh setup must expose one JSON import input');
    assert.equal(await page.locator('#setup-form button[type="submit"]').isEnabled(), true, 'founder setup submit must be enabled');

    await page.locator('#setup-form input[name="playerName"]').fill('WebKit Tester');
    await page.locator('#setup-form input[name="companyName"]').fill('WebKit Holdings');
    await page.locator('#setup-form').evaluate(form => form.requestSubmit());
    await page.locator('.topbar').waitFor({ state: 'visible', timeout: 20_000 });
    assert.match(await page.locator('.topbar').innerText(), /WebKit Holdings/);

    const configuredSave = await page.evaluate(key => localStorage.getItem(key), SAVE_KEY);
    assert.ok(configuredSave, 'configured game must be persisted to localStorage');
    assert.equal(JSON.parse(configuredSave).configured, true, 'configured save must remain loadable JSON');

    await assertMobileLayout(page);
    await clickAndWaitForSummary(page, 'advance-week');
    await clickAndWaitForSummary(page, 'advance-4');

    const weekAfterAdvances = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).week, SAVE_KEY);
    assert.ok(Number.isFinite(weekAfterAdvances) && weekAfterAdvances >= 6, `unexpected saved week after advances: ${weekAfterAdvances}`);

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
    assert.equal(exportedState.configured, true);
    assert.equal(exportedState.companyName, 'WebKit Holdings');

    await page.locator('button[data-action="reset-game"]').click();
    await page.locator('#modal-root button[data-action="confirm-reset"]').waitFor({ state: 'visible' });
    const modalBounds = await page.locator('#modal-root [data-modal-panel]').boundingBox();
    assert.ok(modalBounds, 'reset confirmation modal must have bounds');
    assert.ok(modalBounds.x >= -1 && modalBounds.x + modalBounds.width <= (await page.evaluate(() => innerWidth)) + 1, 'modal must fit the iPhone viewport width');
    await page.locator('#modal-root button[data-action="confirm-reset"]').click();
    await page.locator('#setup-form').waitFor({ state: 'visible', timeout: 20_000 });
    await page.locator('[data-setup-recovery]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#import-file').count(), 1, 'reset setup must expose one canonical import input');

    await page.locator('#import-file').setInputFiles({
      name: 'capitalism-tycoon-rc-save.json',
      mimeType: 'application/json',
      buffer: Buffer.from(exportedSave)
    });
    await page.locator('.topbar').waitFor({ state: 'visible', timeout: 20_000 });
    assert.match(await page.locator('.topbar').innerText(), /WebKit Holdings/);
    const restored = JSON.parse(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY));
    assert.equal(restored.companyName, 'WebKit Holdings');
    assert.equal(restored.week, exportedState.week);

    await assertMobileLayout(page);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'iphone-webkit-smoke.png'), fullPage: true });

    assert.deepEqual(pageErrors, [], `page errors detected: ${pageErrors.join(' | ')}`);
    assert.deepEqual(consoleErrors, [], `console errors detected: ${consoleErrors.join(' | ')}`);
    assert.deepEqual(failedRequests, [], `failed requests detected: ${failedRequests.join(' | ')}`);

    writeJson('result.json', {
      status: 'passed',
      startedAt,
      completedAt: new Date().toISOString(),
      device: DEVICE_NAME,
      browser: 'WebKit',
      browserVersion: browser.version(),
      baseUrl,
      weekAfterAdvances,
      saveVersion: restored.saveVersion
    });
    console.log('iPhone WebKit smoke passed');
  } catch (error) {
    if (page) {
      try {
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'iphone-webkit-smoke-failure.png'), fullPage: true });
      } catch (_) {
        // Best-effort failure artifact only.
      }
    }
    writeJson('result.json', {
      status: 'failed',
      startedAt,
      completedAt: new Date().toISOString(),
      device: DEVICE_NAME,
      error: error && error.stack || String(error),
      consoleErrors,
      pageErrors,
      failedRequests
    });
    throw error;
  } finally {
    if (browser) await browser.close();
    await closeServer(server);
  }
}

main().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
