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
const MIME = new Map([
  ['.css', 'text/css; charset=utf-8'], ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8']
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
  return `http://127.0.0.1:${address.port}/`;
}

async function openTenant(page, tenantName, businessID, storeName, expectedStoreCount) {
  const card = page.locator('article.item').filter({ hasText: tenantName });
  await card.waitFor({ state: 'visible' });
  await card.locator('select[id^="business-"]').selectOption(businessID);
  await card.locator('button[data-action="open-store"]').click();
  await page.locator('#modal-text').waitFor({ state: 'visible' });
  await page.locator('#modal-text').fill(storeName);
  await page.locator('#modal-ok').click();
  await page.waitForFunction(() => document.getElementById('modal-root')?.innerHTML === '');
  await page.waitForFunction(({ key, count }) => {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    try { return JSON.parse(raw).stores?.length === count; }
    catch (_) { return false; }
  }, { key: SAVE_KEY, count: expectedStoreCount });
}

async function installWeekTrace(page) {
  await page.evaluate(() => {
    const modules = globalThis.__capitalismTycoonModules;
    const engine = modules?.playerEngineBridge?.getEngine?.();
    if (!engine) throw new Error('active engine is unavailable for week trace');
    const wrap = (target, name, label = name) => {
      if (!target || typeof target[name] !== 'function' || target[name].__weekTraceWrapped) return;
      const original = target[name];
      const wrapped = function(...args) {
        const suffix = name === 'emit' ? `(${args[0] || 'change'})` : '';
        console.info(`[week-trace] start ${label}${suffix}`);
        try {
          const result = original.apply(this, args);
          console.info(`[week-trace] end ${label}${suffix}`);
          return result;
        } catch (error) {
          console.info(`[week-trace] throw ${label}${suffix}: ${error?.message || error}`);
          throw error;
        }
      };
      Object.defineProperty(wrapped, '__weekTraceWrapped', { value: true });
      target[name] = wrapped;
    };
    for (const name of [
      'updateMacro','updateMarket','updateProperties','updateStartups','updateCompetitors',
      'updateDirectivesAndCampaigns','updateProducts','updateOverseas','updateSubsidiaries',
      'updateFranchise','updatePersonalAssets','recordHistory','evaluateProgression',
      'generateRecurringEvents','updateExpansionWeekly','updateCompletionWeekly','updateParityWeekly',
      'save','emit'
    ]) wrap(engine, name, `engine.${name}`);
    for (const [moduleName, names] of Object.entries({
      supply:['ensure','spoil','receiveOrders','payables','autoOrder','validate'],
      workforce:['ensure','processWeekStart','generateCandidates','recompute','weeklyPayroll','advanceProjects','updateEndOfWeek','validate'],
      market:['calculateMarkets'],
      competitor:['receiveMarketResults','processWeek','validate'],
      finance:['recordWeekly','validate','rebuildDirtySnapshots']
    })) for (const name of names) wrap(modules[moduleName], name, `${moduleName}.${name}`);
  });
}

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const server = staticServer();
  const baseUrl = await startServer(server);
  const diagnostics = { consoleErrors: [], pageErrors: [], failedRequests: [], weekTrace: [] };
  let browser;
  let page;
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
    page.on('console', message => {
      const text = message.text();
      if (text.startsWith('[week-trace]')) diagnostics.weekTrace.push(text);
      if (message.type() === 'error') diagnostics.consoleErrors.push(text);
    });
    page.on('pageerror', error => diagnostics.pageErrors.push(error.message));
    page.on('requestfailed', request => diagnostics.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`));

    await page.goto(new URL('play.html', baseUrl).toString(), { waitUntil: 'networkidle', timeout: 30_000 });
    await page.locator('#setup-form').waitFor({ state: 'visible', timeout: 20_000 });
    assert.match(page.url(), /play\.html/, 'cache-safe launcher should keep the shareable play URL');
    const loadedAssets = await page.evaluate(() => [...document.scripts].map(script => script.src).filter(Boolean));
    const gameScripts = loadedAssets.filter(url => new URL(url).pathname.includes('/js/'));
    const uncachedGameScripts = gameScripts.filter(url => !new URL(url).searchParams.has('launch'));
    const launchTokens = gameScripts.map(url => new URL(url).searchParams.get('launch'));
    assert.ok(gameScripts.length >= 20, `expected game scripts from launcher, got ${gameScripts.length}`);
    assert.deepEqual(uncachedGameScripts, [], `launcher must cache-bust every game script; uncached=${uncachedGameScripts.join(',')}`);
    assert.ok(launchTokens.every(Boolean), 'every game script must have a launch token');
    assert.equal(new Set(launchTokens).size, 1, `all game scripts must share one launch token: ${JSON.stringify(launchTokens)}`);
    for (const expected of ['ma-portfolio-summary.js', 'ma-portfolio-summary-ui.js']) {
      const url = gameScripts.find(src => new URL(src).pathname.endsWith(`/js/${expected}`));
      assert.ok(url, `launcher must include ${expected}`);
      assert.equal(new URL(url).searchParams.get('launch'), launchTokens[0], `${expected} must inherit the launch token`);
    }

    await page.locator('#setup-form input[name="playerName"]').fill('悠太郎');
    await page.locator('#setup-form input[name="companyName"]').fill('YTR');
    await page.locator('#setup-form select[name="difficulty"]').selectOption('hard');
    await page.locator('#setup-form select[name="founderTraitID"]').selectOption('merchant');
    await page.locator('#setup-form').evaluate(form => form.requestSubmit());
    await page.locator('.topbar').waitFor({ state: 'visible', timeout: 20_000 });

    await page.locator('#d-ui-sidebar [data-tab="map"]').click();
    await page.locator('select[data-bind="selectedPref"]').selectOption('fukuoka');
    await openTenant(page, '福岡 駅前1階テナント', 'ramen', 'YTR 福岡駅前店', 1);
    await openTenant(page, '福岡 商店街角地テナント', 'ramen', 'YTR 福岡商店街店', 2);

    const before = JSON.parse(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY));
    assert.equal(before.difficulty, 'hard');
    assert.equal(before.week, 1);
    assert.equal(before.stores.length, 2);
    assert.ok(before.companyCash > 0 && before.companyCash < 2_000_000,
      `reported setup must remain a low-cash two-store start, got ${before.companyCash}`);

    await installWeekTrace(page);
    await page.locator('button[data-action="advance-week"]').click({ timeout: 30_000 });
    const summary = page.locator('#modal-root .summary-modal');
    await summary.waitFor({ state: 'visible', timeout: 30_000 });
    assert.match(await summary.innerText(), /第2週/);
    assert.match(await summary.innerText(), /週間経営レポート/);
    assert.match(await page.locator('.topbar').innerText(), /第2週/);

    const after = JSON.parse(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY));
    assert.equal(after.week, 2);
    assert.equal(after.stores.length, 2);
    assert.ok(after.lastWeeklySummary && after.lastWeeklySummary.week === 2);
    assert.deepEqual({ consoleErrors: diagnostics.consoleErrors, pageErrors: diagnostics.pageErrors, failedRequests: diagnostics.failedRequests }, { consoleErrors: [], pageErrors: [], failedRequests: [] });

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'two-store-first-week.png'), fullPage: true });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'two-store-first-week.json'), `${JSON.stringify({ status:'passed', launchUrl:page.url(), difficulty:before.difficulty, cashBeforeAdvance:before.companyCash, beforeWeek:before.week, afterWeek:after.week, stores:after.stores.length, weekTrace:diagnostics.weekTrace }, null, 2)}\n`);
    console.log('reported hard-mode two-store iPhone WebKit regression passed through play.html');
  } catch (error) {
    if (page) {
      try { await page.screenshot({ path: path.join(ARTIFACT_DIR, 'two-store-first-week-failure.png'), fullPage: true }); } catch (_) {}
    }
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'two-store-first-week.json'), `${JSON.stringify({ status:'failed', error:error?.stack || String(error), ...diagnostics }, null, 2)}\n`);
    throw error;
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error(error?.stack || error);
  process.exit(1);
});
