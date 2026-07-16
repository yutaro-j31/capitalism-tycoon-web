'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { webkit, devices } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const SAVE_KEY = 'capitalism_tycoon_web_v1';
const DEVICE_NAME = 'iPhone 13';
const ARTIFACT_DIR = path.resolve(process.env.GAME_OVER_SETTINGS_ARTIFACT_DIR || path.join(ROOT, 'artifacts', 'game-over-settings-webkit'));
const MIME = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8']
]);

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

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const server = staticServer();
  const baseUrl = await startServer(server);
  let browser;
  let page;
  const diagnostics = { consoleErrors: [], pageErrors: [], failedRequests: [] };

  try {
    browser = await webkit.launch();
    const context = await browser.newContext({
      ...devices[DEVICE_NAME],
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
    await page.locator('#setup-form input[name="playerName"]').fill('Bankruptcy Tester');
    await page.locator('#setup-form input[name="companyName"]').fill('Recovery Holdings');
    await page.locator('#setup-form').evaluate(form => form.requestSubmit());
    await page.locator('.topbar').waitFor({ state: 'visible', timeout: 20_000 });

    await page.evaluate(key => {
      const state = JSON.parse(localStorage.getItem(key));
      state.gameOver = true;
      state.gameOverReason = '会社現金が2週連続でマイナスになりました。';
      state.selectedTab = 'home';
      localStorage.setItem(key, JSON.stringify(state));
    }, SAVE_KEY);
    await page.reload({ waitUntil: 'networkidle', timeout: 30_000 });

    const gameOver = page.locator('.game-over');
    await gameOver.waitFor({ state: 'visible', timeout: 20_000 });
    assert.match(await gameOver.innerText(), /倒産/);
    const settingsButton = gameOver.locator('button[data-action="tab"][data-tab="settings"]');
    await settingsButton.waitFor({ state: 'visible' });
    await settingsButton.click();

    await gameOver.waitFor({ state: 'detached', timeout: 10_000 });
    await page.locator('button[data-action="save-now"]').waitFor({ state: 'visible', timeout: 10_000 });
    assert.equal(await page.locator('.game-over').count(), 0, 'bankruptcy overlay must not cover settings');

    const saved = JSON.parse(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY));
    assert.equal(saved.gameOver, true, 'opening settings must not clear bankruptcy state');
    assert.equal(saved.selectedTab, 'settings', 'settings tab must be persisted');

    const reducedMotion = page.locator('[data-setting="reducedMotion"]');
    await reducedMotion.check();
    await page.locator('button[data-action="save-now"]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.game-over').count(), 0, 'settings rerender must not restore the blocking overlay');

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'game-over-settings-recovered.png'), fullPage: true });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'result.json'), `${JSON.stringify({
      status: 'passed',
      device: DEVICE_NAME,
      selectedTab: saved.selectedTab,
      gameOverPreserved: saved.gameOver,
      diagnostics
    }, null, 2)}\n`);
    assert.deepEqual(diagnostics, { consoleErrors: [], pageErrors: [], failedRequests: [] });
    console.log('game-over settings WebKit recovery passed');
  } catch (error) {
    if (page) {
      try { await page.screenshot({ path: path.join(ARTIFACT_DIR, 'game-over-settings-failure.png'), fullPage: true }); } catch (_) {}
    }
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'result.json'), `${JSON.stringify({
      status: 'failed',
      error: error?.stack || String(error),
      diagnostics
    }, null, 2)}\n`);
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
