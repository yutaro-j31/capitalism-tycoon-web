'use strict';

// The v3 map when its modules arrive after the first draw (docs/ui-v3 task UI3-12a, playtest finding B17).
// js/city-lab-map.js and js/map-phase2-canvas.js are classic scripts that load after js/app.js. When the saved game was left on
// the map tab, app.js draws the map screen and queues its mount before those scripts have run, so ui3-map.js read
// modules.cityLabMap while it was still undefined: "TypeError: Cannot read properties of undefined (reading 'renderWorkspace')"
// and the "エラーから復旧" dialog. Proves in a real browser, with the 3D map script held back or failing, that:
//  - held back (arrives 1.5 s late): no page error, the map appears as soon as the script arrives, no "loading" text is left;
//  - never registering (the script loads but provides no map): no page error, the map waits a bounded time and then the current UI's map is shown
//    (README 6.5), never a permanent "loading" state, and the recovery dialog does not appear.
// The game is left on the map tab, then the page is reloaded with the script delayed or blocked (a real browser loads it later by itself).
// Registered in tests/test-execution-registry.json (iPhone Acceptance Playthrough job).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
const CITY_LAB_MODULE = /\/js\/city-lab-map\.js(?:\?.*)?$/;

// --- static contracts ---------------------------------------------------
const mapSource = fs.readFileSync(path.join(ROOT, 'js', 'ui3-map.js'), 'utf8');
assert.match(mapSource, /function mapModulesReady\(\)|const mapModulesReady=/, 'the v3 map checks that its modules are registered');
assert.match(mapSource, /MAP_MODULE_MAX_TRIES/, 'the wait for the map modules is bounded');
assert.doesNotMatch(mapSource, /Math\.random|MutationObserver|registerUIEnhancer/, 'no RNG, observer or D UI enhancer in the v3 map');
const calls = mapSource.match(/modules\.cityLabMap\.renderWorkspace/g) || [];
assert.equal(calls.length, 1, 'one render call');
assert.ok(mapSource.indexOf('mapModulesReady()', mapSource.indexOf('function refreshMap')) < mapSource.indexOf('modules.cityLabMap.renderWorkspace'), 'the render call is behind the readiness check');

function serve() {
  const server = http.createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname);
      const file = path.resolve(ROOT, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
      assert.ok(file.startsWith(`${ROOT}${path.sep}`));
      const body = fs.readFileSync(file);
      response.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
      response.end(body);
    } catch (error) {
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end('Not found');
    }
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function found(page, url) {
  await page.goto(url, { waitUntil: 'load' });
  await page.locator('#setup-form').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('#setup-form').evaluate(form => form.requestSubmit());
  await page.waitForFunction(() => !document.getElementById('setup-form'), null, { timeout: 30000 });
  await page.waitForTimeout(1500);
}

async function main() {
  const browserName = process.env.UI3_TEST_BROWSER || 'webkit';
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await playwright[browserName].launch(browserName === 'chromium' && process.env.UI3_TEST_CHROME
    ? { executablePath: process.env.UI3_TEST_CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const device = playwright.devices['iPhone 13'];
  const newPage = async () => {
    const context = await browser.newContext({ viewport: device.viewport, userAgent: device.userAgent, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ja-JP' });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error.message)));
    return { context, page, pageErrors };
  };
  const recovery = page => page.locator('[data-runtime-recovery-root] [role="dialog"]').count();
  const startOnMap = async (page) => {
    await found(page, `${base}?ui=3`);
    await page.evaluate(() => document.querySelector('[data-action="tab"][data-tab="map"]').click());
    await page.locator('.city-lab-stage').waitFor({ state: 'attached', timeout: 30000 });
    assert.equal(await page.evaluate(() => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.selectedTab), 'map');
  };
  try {
    // 1. The 3D map script arrives late.
    {
      const { context, page, pageErrors } = await newPage();
      await startOnMap(page);
      await context.route(CITY_LAB_MODULE, async route => { await new Promise(resolve => setTimeout(resolve, 1500)); await route.continue(); });
      await page.goto(`${base}?ui=3`, { waitUntil: 'load' });
      await page.locator('[data-ui3-map-chips]').waitFor({ state: 'attached', timeout: 30000 });
      assert.ok(await page.locator('.city-lab-stage').count() > 0, 'the 3D map is drawn once its script has arrived');
      assert.equal(await page.locator('[data-ui3-map-loading]').count(), 0, 'no loading text is left');
      assert.equal(await recovery(page), 0, 'no recovery dialog');
      assert.deepEqual(pageErrors, []);
      await context.close();
    }
    // 2. The 3D map module never registers (the script loads but does not provide the map; a script that fails to load at all is the
    //    app's own "必要なファイルを読み込めませんでした" recovery, a separate mechanism).
    {
      const { context, page, pageErrors } = await newPage();
      await startOnMap(page);
      await context.route(CITY_LAB_MODULE, route => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: '/* the 3D map module never registers: test */' }));
      await page.goto(`${base}?ui=3`, { waitUntil: 'load' });
      // bounded wait (about 5 s), then the current UI's map
      await page.locator('[data-ui3-screen="map"]').waitFor({ state: 'detached', timeout: 20000 });
      await page.locator('.d-map-stage, .d-map-workspace, canvas').first().waitFor({ state: 'attached', timeout: 20000 });
      assert.equal(await page.locator('[data-ui3-map-loading]').count(), 0, 'no permanent loading state');
      assert.equal(await recovery(page), 0, 'no recovery dialog');
      assert.deepEqual(pageErrors, []);
      await context.close();
    }
    console.log(`ui3-map-startup-race-webkit-test: PASS (${browserName})`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(error => { console.error(error); process.exit(1); });
