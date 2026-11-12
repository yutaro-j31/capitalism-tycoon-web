'use strict';

// "4週" stops where a cash crisis starts or gets worse (docs/ui-v3 task UI3-12a, playtest finding B14).
// Before the fix, js/app.js's advance-4 only stopped on game over, so a crisis that began in week 32 ran on to the
// bankruptcy in week 35 without the player ever seeing the response options. Proves in a real browser, for the v3
// button (?ui=3) and for the current UI's button, that:
//  - without a crisis, "4週" advances exactly four weeks and shows the weekly report;
//  - when a crisis starts in the middle of the four weeks, it stops in that week, the company is not bankrupt, the
//    weekly report is shown and a toast says why it stopped; the crisis response is then available as usual
//    (v3: the shell's notice opens the response sheet; current UI: the crisis panel is on the home);
//  - the stop only reads engine.g.playerCrisis (the engine is not changed; one week is simulated per engine call).
// The crisis is made inside the throw-away test page (the way tests/ui3-crisis-webkit-test.js makes it: cash below zero
// and a rebuilt finance state), right before the third engine week of the press. That is inspection setup for this test only.
// Registered in tests/test-execution-registry.json (iPhone Acceptance Playthrough job).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg' };

// --- static contracts ---------------------------------------------------
const appSource = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');
assert.match(appSource, /function advanceUpToFourWeeks\(\)/, 'js/app.js has the crisis-aware four-week advance');
assert.doesNotMatch(appSource, /case 'advance-4':for\(let i=0;i<4&&!engine\.g\.gameOver;i\+\+\)/, 'the old loop that only stops on game over is gone');
const helper = appSource.slice(appSource.indexOf('function advanceUpToFourWeeks()'), appSource.indexOf('function action(name,el)'));
assert.doesNotMatch(helper, /engine\.g\.[A-Za-z_$][\w$.]*\s*(?:=(?!=)|\+=|-=|\+\+|--)/, 'the stop condition only reads the game state');
assert.doesNotMatch(helper, /Math\.random/, 'no RNG in the stop condition');
assert.equal((appSource.match(/advanceUpToFourWeeks\(\)/g) || []).length, 2, 'one definition and one caller: every "4週" button goes through the same function');

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

const engineEval = (page, fn, arg) => page.evaluate(([source, value]) => {
  const engine = globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine();
  return (0, eval)(`(${source})`)(engine, value);
}, [fn.toString(), arg]);

async function found(page, url) {
  await page.goto(url, { waitUntil: 'load' });
  await page.locator('#setup-form').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('#setup-form').evaluate(form => form.requestSubmit());
  await page.waitForFunction(() => !document.getElementById('setup-form'), null, { timeout: 30000 });
  await page.waitForTimeout(1500);
}

const state = page => engineEval(page, engine => ({
  week: engine.g.week, over: Boolean(engine.g.gameOver), status: engine.g.playerCrisis?.status || 'stable', calls: globalThis.__advanceCalls || 0,
}));
const closeReport = async page => {
  await page.locator('#modal-root button[data-action="close-modal"]').first().click();
  await page.waitForFunction(() => !document.querySelector('#modal-root [data-action="close-modal"]'), null, { timeout: 5000 });
};

async function main() {
  const browserName = process.env.UI3_TEST_BROWSER || 'webkit';
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await playwright[browserName].launch(browserName === 'chromium' && process.env.UI3_TEST_CHROME
    ? { executablePath: process.env.UI3_TEST_CHROME, args: ['--no-sandbox'] } : {});
  const device = playwright.devices['iPhone 13'];
  const newPage = async () => {
    const context = await browser.newContext({ viewport: device.viewport, userAgent: device.userAgent, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ja-JP' });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error.message)));
    return { context, page, pageErrors };
  };
  // Counts the engine's weeks, and (when asked) starts a crisis right before the third one, as a real run into a cash shortfall would.
  const instrument = (page, crisisAtCall) => engineEval(page, (engine, at) => {
    const m = globalThis.__capitalismTycoonModules;
    const original = engine.advanceWeek.bind(engine);
    globalThis.__advanceCalls = 0;
    engine.advanceWeek = (...args) => {
      globalThis.__advanceCalls++;
      if (at && globalThis.__advanceCalls === at) { engine.g.companyCash = -1000000; engine.g.finance = m.finance.defaultFinanceState(engine.g); }
      return original(...args);
    };
  }, crisisAtCall);

  const cases = [
    { name: 'v3 button', url: `${base}?ui=3`, button: '.u-advance4', report: '#modal-root .u-sheet', crisisEntry: '[data-ui3-crisis-open]' },
    { name: 'current UI button', url: base, button: '[data-action="advance-4"]:visible', report: '#modal-root .modal', crisisEntry: '#player-crisis-panel' },
  ];
  try {
    for (const c of cases) {
      // 1. No crisis: four weeks, the weekly report, no stop notice.
      {
        const { context, page, pageErrors } = await newPage();
        await found(page, c.url);
        await instrument(page, 0);
        const before = await state(page);
        assert.equal(before.status, 'stable', `${c.name}: the new company starts without a crisis`);
        await page.locator(c.button).first().click();
        await page.locator(c.report).first().waitFor({ state: 'attached', timeout: 10000 });
        const after = await state(page);
        assert.deepEqual([after.week - before.week, after.calls, after.over, after.status], [4, 4, false, 'stable'], `${c.name}: without a crisis "4週" runs four weeks`);
        assert.equal(await page.locator('#toast-root .toast').filter({ hasText: '資金繰りが悪化' }).count(), 0, `${c.name}: no stop notice without a crisis`);
        assert.deepEqual(pageErrors, []);
        await context.close();
      }
      // 2. A crisis starts in the third week of the press: it stops there.
      {
        const { context, page, pageErrors } = await newPage();
        await found(page, c.url);
        await instrument(page, 3);
        const before = await state(page);
        await page.locator(c.button).first().click();
        await page.locator(c.report).first().waitFor({ state: 'attached', timeout: 10000 });
        const after = await state(page);
        assert.equal(after.status, 'distressed', `${c.name}: the crisis has started`);
        assert.deepEqual([after.week - before.week, after.calls, after.over], [3, 3, false], `${c.name}: stopped in the week the crisis started, not bankrupt`);
        await page.locator('#toast-root .toast').filter({ hasText: '資金繰りが悪化' }).first().waitFor({ state: 'attached', timeout: 5000 });
        assert.ok(await page.locator(c.report).first().isVisible(), `${c.name}: the weekly report is shown`);
        await closeReport(page);
        await page.locator(c.crisisEntry).first().waitFor({ state: 'attached', timeout: 10000 });   // the response is reachable
        if (c.name === 'v3 button') {
          await page.locator('[data-ui3-crisis-open]').first().click();
          await page.locator('[data-ui3-crisis-sheet]').waitFor({ state: 'attached', timeout: 10000 });
        }
        assert.deepEqual(pageErrors, []);
        await context.close();
      }
    }
    console.log(`ui3-advance-crisis-stop-webkit-test: PASS (${browserName})`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(error => { console.error(error); process.exit(1); });
