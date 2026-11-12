'use strict';

// UI3-12a: the two stalls found in the play test (docs/ui-v3/README.md 10 / playtest B14, B17).
//  - "4週" stops in the week a funding crisis starts or worsens (it used to run on to the insolvency week), shows the
//    week-end report, and still advances four weeks when there is no crisis; the v3 dock button goes through the same action.
//  - The v3 map screen mounted before js/city-lab-map.js has registered waits for it (bounded), draws when it arrives, and
//    takes the current-map fallback (never a TypeError, never "loading" forever) when it does not.
// Registered in tests/test-execution-registry.json (iPhone Acceptance Playthrough job).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

const appSource = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');
assert.match(appSource, /case 'advance-4':advanceUpToFourWeeks\(\)/, 'the 4-week action goes through the crisis-aware loop');
assert.doesNotMatch(appSource.match(/function advanceUpToFourWeeks[\s\S]*?\n}\n/)[0], /Math\.random|Date\.now/, 'the loop uses no RNG or clock');
const mapSource = fs.readFileSync(path.join(ROOT, 'js', 'ui3-map.js'), 'utf8');
assert.match(mapSource, /WAIT_TRIES/, 'the map screen waits for the map module with a bounded number of tries');



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

const goTo = (page, tab) => page.evaluate(id => document.querySelector(`[data-action="tab"][data-tab="${id}"]`).click(), tab);
const engineEval = (page, fn, arg) => page.evaluate(([source, value]) => {
  const engine = globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine();
  return (0, eval)(`(${source})`)(engine, value);
}, [fn.toString(), arg]);
async function found(page, url) {
  await page.goto(url, { waitUntil: 'load' });
  await page.locator('#setup-form').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('#setup-form').evaluate(form => form.requestSubmit());
  await page.waitForFunction(() => !document.getElementById('setup-form'), null, { timeout: 30000 });
}

async function main() {
  const browserName = process.env.UI3_TEST_BROWSER || 'webkit';
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const launch = browserName === 'chromium' && process.env.UI3_TEST_CHROME
    ? { executablePath: process.env.UI3_TEST_CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {};
  const browser = await playwright[browserName].launch(launch);
  const device = playwright.devices['iPhone 13'];
  const newPage = async () => {
    const context = await browser.newContext({ viewport: device.viewport, userAgent: device.userAgent, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ja-JP' });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error.message)));
    return { context, page, pageErrors };
  };
  try {
    // ---- B14: "4週" and the crisis -------------------------------------------------------------------------------
    for (const ui of ['', '?ui=3']) {
      const { context, page, pageErrors } = await newPage();
      await found(page, `${base}${ui}`);
      const label = ui || 'current UI';
      const press = async () => {
        if (ui) await page.locator('.u-advance4').tap(); else await page.evaluate(() => document.querySelector('[data-action="advance-4"]').click());
        await page.waitForTimeout(400);
      };
      // no crisis: four weeks
      const start = await engineEval(page, engine => engine.g.week);
      await press();
      assert.equal(await engineEval(page, engine => engine.g.week), start + 4, `${label}: without a crisis 4週 advances four weeks`);
      await page.evaluate(() => document.querySelector('#modal-root [data-action="close-modal"]')?.click());
      // a crisis that starts in the second week: the engine's own status field changes after the 2nd advanceWeek call
      await engineEval(page, engine => {
        let calls = 0; const original = engine.advanceWeek.bind(engine);
        engine.advanceWeek = (...args) => { const ok = original(...args); if (++calls === 2) { engine.g.playerCrisis = { ...(engine.g.playerCrisis || {}), status: 'distressed' }; } return ok; };
        window.__restoreAdvance = () => { engine.advanceWeek = original; };
      });
      const before = await engineEval(page, engine => engine.g.week);
      await press();
      const after = await engineEval(page, engine => ({ week: engine.g.week, over: engine.g.gameOver, status: engine.g.playerCrisis.status }));
      assert.equal(after.week, before + 2, `${label}: 4週 stops in the week the crisis starts (stopped after ${after.week - before} weeks)`);
      assert.equal(after.over, false, `${label}: the company is not insolvent`);
      assert.ok(await page.locator('#modal-root .u-sheet, #modal-root .modal, #modal-root [role="dialog"]').count() > 0, `${label}: the week-end report is shown`);
      await page.evaluate(() => { window.__restoreAdvance(); document.querySelector('#modal-root [data-action="close-modal"]')?.click(); });
      // already in the crisis and nothing changes: four weeks
      const again = await engineEval(page, engine => engine.g.week);
      await press();
      const final = await engineEval(page, engine => engine.g.week);
      assert.ok(final > again, `${label}: it still advances while the crisis status is unchanged`);
      assert.deepEqual(pageErrors, [], `${label}: no page errors`);
      await context.close();
    }

    // ---- B17: the map module arrives late / never ------------------------------------------------------------------
    {
      const { context, page, pageErrors } = await newPage();
      await found(page, `${base}?ui=3`);
      await page.evaluate(() => { const m = globalThis.__capitalismTycoonModules; window.__savedMap = m.cityLabMap; delete m.cityLabMap; });
      assert.equal(await page.evaluate(() => globalThis.__capitalismTycoonModules.cityLabMap), undefined, 'setup: the map module is absent');
      await goTo(page, 'map');
      await page.waitForTimeout(500);
      assert.deepEqual(pageErrors, [], 'no TypeError while the map module is missing');
      assert.equal(await page.locator('.u-pin').count(), 0, 'nothing is drawn yet');
      await page.evaluate(() => { globalThis.__capitalismTycoonModules.cityLabMap = window.__savedMap; });
      await page.waitForFunction(() => document.querySelectorAll('.ui3 .u-pin:not([hidden])').length > 0, null, { timeout: 30000 });
      assert.deepEqual(pageErrors, [], 'the map draws once the module arrives, with no page errors');
      await context.close();
    }
    {
      const { context, page, pageErrors } = await newPage();
      await found(page, `${base}?ui=3`);
      await page.evaluate(() => { delete globalThis.__capitalismTycoonModules.cityLabMap; });
      await goTo(page, 'map');
      await page.waitForFunction(() => !document.querySelector('.ui3 [data-ui3-map]') || document.querySelector('.d-map-workspace, .city-lab-fallback, .d-map-stage'), null, { timeout: 15000 });
      assert.deepEqual(pageErrors, [], 'a map module that never arrives ends in the fallback without page errors');
      assert.equal(await page.locator('.ui3 .u-pin').count(), 0, 'no v3 pins in the fallback');
      await context.close();
    }
    console.log(`ui3-12a-webkit-test: PASS (${browserName})`);
  } finally {
    await browser.close();
    server.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
