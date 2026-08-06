'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { webkit, devices } = require('playwright');
const releaseCandidate = require('../release-candidate.json');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT_DIR = path.resolve(process.env.IPHONE_WEBKIT_ARTIFACT_DIR || path.join(ROOT, 'artifacts', 'iphone-webkit-smoke'));
const SAVE_KEY = 'capitalism_tycoon_web_v1';
const DEVICE_NAME = 'iPhone 13';
const TARGET_ENV = 'IPHONE_WEBKIT_TARGET_URL';
const MIME = new Map([
  ['.css','text/css; charset=utf-8'],['.html','text/html; charset=utf-8'],
  ['.js','text/javascript; charset=utf-8'],['.json','application/json; charset=utf-8'],
  ['.png','image/png'],['.svg','image/svg+xml'],['.webp','image/webp']
]);

assert.ok(devices[DEVICE_NAME], `Playwright device descriptor is unavailable: ${DEVICE_NAME}`);

function writeResult(value) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'result.json'), `${JSON.stringify(value, null, 2)}\n`);
}

function normalizedDirectoryPath(pathname) {
  return `${pathname.replace(/\/+$/, '')}/`;
}

function publishedTargetUrl(env = process.env) {
  const raw = String(env[TARGET_ENV] || '').trim();
  if (!raw) return null;
  const expected = new URL(releaseCandidate.deployment.url);
  const supplied = new URL(raw);
  assert.equal(supplied.protocol, 'https:', `${TARGET_ENV} must use HTTPS`);
  assert.equal(supplied.username, '', `${TARGET_ENV} must not include credentials`);
  assert.equal(supplied.password, '', `${TARGET_ENV} must not include credentials`);
  assert.equal(supplied.origin, expected.origin, `${TARGET_ENV} must use the release-candidate deployment origin`);
  assert.equal(normalizedDirectoryPath(supplied.pathname), normalizedDirectoryPath(expected.pathname), `${TARGET_ENV} must use the release-candidate deployment path`);
  assert.equal(supplied.search, '', `${TARGET_ENV} must not include a query string`);
  assert.equal(supplied.hash, '', `${TARGET_ENV} must not include a fragment`);
  supplied.pathname = normalizedDirectoryPath(supplied.pathname);
  return supplied;
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
  return new URL(`http://127.0.0.1:${address.port}/`);
}

async function stopServer(server) {
  await new Promise(resolve => server.close(resolve));
}

function deadline(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms); })
  ]).finally(() => clearTimeout(timer));
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

async function persistFailureEvidence(page, diagnostics) {
  if (!page) return;
  try {
    diagnostics.boot = await deadline(page.evaluate(() => globalThis.__capitalismTycoonBootDiagnostics || null), 3000, 'boot diagnostics');
  } catch (error) {
    diagnostics.bootReadError = String(error?.message || error);
  }
  try {
    const html = await deadline(page.content(), 3000, 'page content');
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'page.html'), html);
  } catch (error) {
    diagnostics.contentError = String(error?.message || error);
  }
  try {
    await deadline(page.screenshot({ path: path.join(ARTIFACT_DIR, 'iphone-webkit-smoke-failure.png'), fullPage: true }), 5000, 'failure screenshot');
  } catch (error) {
    diagnostics.screenshotError = String(error?.message || error);
  }
}

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const publishedUrl = publishedTargetUrl();
  const server = publishedUrl ? null : staticServer();
  const baseUrl = publishedUrl || await startServer(server);
  const targetMode = publishedUrl ? 'published-pages' : 'local-static';
  const targetUrl = new URL(baseUrl.toString());
  targetUrl.searchParams.set('webkit-smoke', String(process.env.GITHUB_SHA || Date.now()));
  targetUrl.searchParams.set('boot-diagnostics', 'observe');
  let browser;
  let context;
  let page;
  const diagnostics = { consoleErrors: [], pageErrors: [], failedRequests: [] };
  const startedAt = new Date().toISOString();

  try {
    browser = await webkit.launch();
    context = await browser.newContext({
      ...devices[DEVICE_NAME],
      acceptDownloads: true,
      locale: 'ja-JP',
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
      timezoneId: 'Asia/Tokyo'
    });
    page = await context.newPage();
    page.setDefaultTimeout(20_000);
    page.on('console', message => message.type() === 'error' && diagnostics.consoleErrors.push(message.text()));
    page.on('pageerror', error => diagnostics.pageErrors.push(error.message));
    page.on('requestfailed', request => diagnostics.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`));

    await page.goto(targetUrl.toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.locator('html[data-app-boot-state="ready"]').waitFor({ state: 'attached', timeout: 30_000 });
    await page.locator('#setup-form').waitFor({ state: 'visible', timeout: 30_000 });
    await page.locator('[data-setup-recovery]').waitFor({ state: 'visible', timeout: 20_000 });
    assert.equal(await page.locator('#import-file').count(), 1);

    const boot = await page.evaluate(() => globalThis.__capitalismTycoonBootDiagnostics || null);
    assert.ok(boot, 'boot diagnostics must be available in WebKit smoke');
    assert.equal(boot.forceDisconnected, false, 'normal boot must not hit the observer safety threshold');

    await page.locator('#setup-form input[name="playerName"]').fill('WebKit Tester');
    await page.locator('#setup-form input[name="companyName"]').fill('WebKit Holdings');
    await page.locator('#setup-form').evaluate(form => form.requestSubmit());
    await page.locator('.topbar').waitFor({ state: 'visible', timeout: 20_000 });
    assert.match(await page.locator('.topbar').innerText(), /WebKit Holdings/);

    const configuredSave = await page.evaluate(key => localStorage.getItem(key), SAVE_KEY);
    assert.ok(configuredSave, 'configured game must be persisted');
    assert.equal(JSON.parse(configuredSave).configured, true);

    await weeklySummary(page, 'advance-week');
    const saved = JSON.parse(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY));
    assert.ok(Number.isFinite(saved.week) && saved.week >= 2, `unexpected saved week: ${saved.week}`);
    assert.equal(saved.saveVersion, 9);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'iphone-webkit-smoke.png'), fullPage: true });
    assert.deepEqual(diagnostics, { consoleErrors: [], pageErrors: [], failedRequests: [] });
    writeResult({
      status: 'passed', startedAt, completedAt: new Date().toISOString(),
      device: DEVICE_NAME, browser: 'WebKit', browserVersion: browser.version(),
      targetMode, targetUrl: publishedUrl ? releaseCandidate.deployment.url : baseUrl.toString(),
      weekAfterAdvance: saved.week, saveVersion: saved.saveVersion, boot
    });
    console.log(`iPhone WebKit smoke passed (${targetMode})`);
  } catch (error) {
    await persistFailureEvidence(page, diagnostics);
    writeResult({
      status: 'failed', startedAt, completedAt: new Date().toISOString(),
      targetMode, targetUrl: publishedUrl ? releaseCandidate.deployment.url : baseUrl.toString(),
      error: error?.stack || String(error), ...diagnostics
    });
    throw error;
  } finally {
    if (context) await deadline(context.close(), 5000, 'context close').catch(() => {});
    if (browser) await deadline(browser.close(), 5000, 'browser close').catch(() => {});
    if (server) await stopServer(server);
  }
}

main().catch(error => {
  console.error(error?.stack || error);
  process.exit(1);
});
