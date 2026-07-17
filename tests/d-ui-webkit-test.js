'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { webkit, devices } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.env.D_UI_ARTIFACT_DIR || path.join(ROOT, 'artifacts', 'd-ui-webkit'));

function server() {
  return http.createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname);
      const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      const file = path.resolve(ROOT, relative);
      assert.ok(file === ROOT || file.startsWith(ROOT + path.sep), 'unsafe request path');
      const body = fs.readFileSync(file);
      const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.json') ? 'application/json' : 'text/html';
      res.writeHead(200, { 'cache-control': 'no-store', 'content-type': `${type}; charset=utf-8` });
      res.end(body);
    } catch (error) {
      res.writeHead(error.code === 'ENOENT' ? 404 : 500);
      res.end(String(error.message || error));
    }
  });
}

async function createCompany(page, suffix) {
  await page.goto(page.baseURL, { waitUntil: 'networkidle' });
  await page.locator('#setup-form input[name="playerName"]').fill(`D UI Tester ${suffix}`);
  await page.locator('#setup-form input[name="companyName"]').fill(`D UI Company ${suffix}`);
  await page.locator('#setup-form').evaluate(form => form.requestSubmit());
  await page.locator('.d-kpi-strip').waitFor();
}

async function verifyDesktop(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ja-JP', serviceWorkers: 'block' });
  const page = await context.newPage();
  page.baseURL = `${base}index.html`;
  const errors = [];
  page.on('pageerror', error => errors.push(String(error.message || error)));
  await createCompany(page, 'desktop');

  await page.locator('#d-ui-sidebar').waitFor();
  await page.locator('#d-ui-dock').waitFor();
  assert.equal(await page.locator('.d-kpi').count(), 5, 'desktop KPI bar must contain five metrics');
  await page.locator('#d-ui-sidebar [data-tab="map"]').click();
  await page.locator('.d-map-workspace').waitFor();
  await page.locator('.d-context-panel').waitFor();
  await page.locator('.d-map-directory').waitFor();
  assert.ok(await page.locator('.d-map-marker').count() > 0, 'D map must expose at least one actionable marker');

  const firstMarker = page.locator('.d-map-marker').first();
  await firstMarker.click();
  assert.ok((await page.locator('.d-context-panel h2').textContent()).trim().length > 0, 'selected marker must populate the context drawer');

  await page.locator('[data-d-ui-action="toggle-menu"]').first().click();
  await page.locator('#d-ui-command-menu.open').waitFor();
  assert.ok(await page.locator('#d-ui-command-menu [data-tab]').count() >= 18, 'full command menu must preserve all game sections');
  await page.locator('#d-ui-command-menu [data-tab="business"]').click();
  await page.locator('#screen').waitFor();
  assert.equal(await page.locator('#d-ui-command-menu.open').count(), 0, 'command menu must close after navigation');
  assert.ok(await page.locator('#screen .card').count() > 0, 'existing business screen must remain rendered');

  await page.locator('#d-ui-sidebar [data-tab="map"]').click();
  await page.locator('.d-map-workspace').waitFor();
  await page.screenshot({ path: path.join(OUT, 'd-ui-desktop.png'), fullPage: true });
  assert.deepEqual(errors, []);
  await context.close();
}

async function verifyIPhone(browser, base) {
  const context = await browser.newContext({ ...devices['iPhone 13'], locale: 'ja-JP', serviceWorkers: 'block' });
  const page = await context.newPage();
  page.baseURL = `${base}index.html`;
  const errors = [];
  page.on('pageerror', error => errors.push(String(error.message || error)));
  await createCompany(page, 'iphone');
  await page.locator('#d-ui-sidebar').waitFor();

  const sidebarPosition = await page.locator('#d-ui-sidebar').evaluate(node => getComputedStyle(node).position);
  assert.equal(sidebarPosition, 'fixed', 'iPhone D navigation must remain fixed');
  await page.locator('#d-ui-sidebar [data-tab="map"]').click();
  await page.locator('.d-map-workspace').waitFor();
  await page.locator('.d-map-stage').waitFor();
  await page.locator('[data-d-ui-action="toggle-menu"]').first().click();
  await page.locator('#d-ui-command-menu.open').waitFor();
  await page.locator('#d-ui-command-menu [data-tab="settings"]').click();
  await page.locator('#screen').waitFor();
  assert.ok(await page.locator('#screen .card').count() > 0, 'settings screen must remain usable from the mobile command menu');
  await page.screenshot({ path: path.join(OUT, 'd-ui-iphone.png'), fullPage: true });
  assert.deepEqual(errors, []);
  await context.close();
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const appServer = server();
  await new Promise((resolve, reject) => { appServer.once('error', reject); appServer.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${appServer.address().port}/`;
  let browser;
  try {
    browser = await webkit.launch();
    await verifyDesktop(browser, base);
    await verifyIPhone(browser, base);
    fs.writeFileSync(path.join(OUT, 'd-ui-webkit.json'), JSON.stringify({ status: 'passed', layouts: ['desktop', 'iPhone 13'], shell: 'D' }, null, 2) + '\n');
    console.log('D UI desktop and iPhone WebKit smoke passed');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => appServer.close(resolve));
  }
}

main().catch(error => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'd-ui-webkit-failure.log'), String(error.stack || error) + '\n');
  console.error(error.stack || error);
  process.exit(1);
});
