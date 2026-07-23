'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { webkit, devices } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT_DIR = path.resolve(process.env.FOUNDING_TUTORIAL_ARTIFACT_DIR || path.join(ROOT, 'artifacts', 'founding-tutorial-webkit'));
const SAVE_KEY = 'capitalism_tycoon_web_v1';
const SAVE_VERSION = 9;
const DEVICE_NAME = 'iPhone 13';
const MIME = new Map([
  ['.css', 'text/css; charset=utf-8'], ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'], ['.png', 'image/png'], ['.svg', 'image/svg+xml'], ['.webp', 'image/webp']
]);
assert.ok(devices[DEVICE_NAME], `Playwright device descriptor is unavailable: ${DEVICE_NAME}`);

function writeResult(value) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'founding-tutorial-result.json'), `${JSON.stringify(value, null, 2)}\n`);
}

function staticServer() {
  return http.createServer((request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      const relative = decodeURIComponent(url.pathname) === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const resolved = path.resolve(ROOT, relative);
      assert.ok(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `request escaped repository root: ${url.pathname}`);
      const target = fs.statSync(resolved).isDirectory() ? path.join(resolved, 'index.html') : resolved;
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
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return `http://127.0.0.1:${server.address().port}/`;
}
async function stopServer(server) { await new Promise(resolve => server.close(resolve)); }
async function save(page) { return page.evaluate(key => localStorage.getItem(key), SAVE_KEY); }
async function parsed(page) { const raw = await save(page); return raw ? JSON.parse(raw) : null; }
async function assertText(locator, pattern) { assert.match(await locator.innerText(), pattern); }
async function assertNoText(locator, pattern) { assert.doesNotMatch(await locator.innerText(), pattern); }

async function setupFreshCompany(page, baseUrl) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(key => localStorage.removeItem(key), SAVE_KEY);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#setup-form input[name="playerName"]').fill('創業WebKit検証者');
  await page.locator('#setup-form input[name="companyName"]').fill('創業WebKit商事');
  await page.locator('#setup-form').evaluate(form => form.requestSubmit());
  await page.locator('[data-founding-guide="1"]').waitFor({ state: 'visible' });
  const game = await parsed(page);
  assert.equal(game.configured, true);
  assert.equal(game.saveVersion, SAVE_VERSION);
  assert.equal(game.playerName, '創業WebKit検証者');
  assert.equal(game.companyName, '創業WebKit商事');
}

async function layout(page) {
  return page.locator('[data-founding-guide="1"]').evaluate(root => {
    const guide = root.getBoundingClientRect();
    const cta = root.querySelector('.founding-guide-cta')?.getBoundingClientRect();
    const summary = root.querySelector('.founding-roadmap summary')?.getBoundingClientRect();
    return {
      viewportWidth: innerWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      guideLeft: guide.left,
      guideRight: guide.right,
      cardWidth: guide.width,
      ctaHeight: cta?.height || 0,
      summaryHeight: summary?.height || 0,
      roadmapRows: [...root.querySelectorAll('.founding-step')].map(element => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, height: rect.height, text: element.innerText, ariaCurrent: element.getAttribute('aria-current'), state: [...element.classList].filter(c => c !== 'founding-step').join(' ') };
      }),
      currentVisible: Boolean(root.querySelector('[aria-current="step"]')?.getBoundingClientRect().height),
      active: document.activeElement?.getAttribute('data-ceo-dashboard-card') || document.activeElement?.getAttribute('data-action') || document.activeElement?.className || document.activeElement?.id || document.activeElement?.tagName
    };
  });
}

function assertMobile(layoutValue) {
  assert.ok(layoutValue.documentScrollWidth <= layoutValue.viewportWidth + 2, `document overflow: ${JSON.stringify(layoutValue)}`);
  assert.ok(layoutValue.bodyScrollWidth <= layoutValue.viewportWidth + 2, `body overflow: ${JSON.stringify(layoutValue)}`);
  assert.ok(layoutValue.ctaHeight >= 43.5, `CTA target below 44px: ${JSON.stringify(layoutValue)}`);
  assert.ok(layoutValue.summaryHeight >= 43.5, `roadmap summary target below 44px: ${JSON.stringify(layoutValue)}`);
  assert.ok(layoutValue.guideLeft >= -1 && layoutValue.guideRight <= layoutValue.viewportWidth + 1, `guide unsafe area overflow: ${JSON.stringify(layoutValue)}`);
}

async function assertGuide(page) {
  const guide = page.locator('[data-founding-guide="1"]');
  assert.equal(await guide.count(), 1);
  await assertText(guide, /会社の現在地を確認/);
  await assertText(guide, /0\/10 完了/);
  await assertText(guide, /CEO Dashboardを見る/);
  assert.equal(await guide.locator('.founding-step').count(), 10);
  assert.equal(await guide.locator('[aria-current="step"]').count(), 1);
  await assertNoText(guide, /創業チュートリアル完了|進行済みセーブの創業ガイド/);
  const before = await save(page);
  await guide.locator('summary').click();
  await guide.locator('summary').click();
  assert.equal(await save(page), before, 'roadmap toggle must not mutate save');
  const guideLayout = await layout(page);
  assertMobile(guideLayout);
  return guideLayout;
}

async function setState(page, kind) {
  await page.evaluate(({ key, kind }) => {
    const modules = globalThis.__capitalismTycoonModules;
    const game = new modules.engine.TycoonEngine();
    const state = modules.engine.createInitialState({ configured: true, playerName: '創業WebKit検証者', companyName: '創業WebKit商事' });
    state.selectedTab = 'home';
    function addStore() {
      state.stores = [{ id: 's1', businessID: 'ramen', prefID: 'tokyo', name: '本店', status: 'open', quality: 0, brand: 0, condition: 100, operatingHours: 3, openingWeek: 1, weeksToOpen: 0 }];
      state.supplySettingsByStoreID = { s1: { autoPolicy: 'balanced' } };
    }
    function addReports(count) {
      state.week = count;
      state.reports = Array.from({ length: count }, (_, index) => ({ week: index + 1, sales: 1_000_000 + index * 100_000, profit: 120_000 + index * 30_000, expenses: 700_000, fixedCosts: 500_000 }));
      state.lastReport = state.reports.at(-1);
    }
    if (kind === 'weekly') { addStore(); addReports(1); }
    if (kind === 'improvement') { addStore(); addReports(2); modules.workforce.storeAdjustment(state, state.stores[0], 1000); }
    if (kind === 'cash') { addStore(); addReports(2); }
    if (kind === 'summary') { addReports(4); state.publicCompany = true; state.sharesOut = 100_000; state.companyDebt = 1_000_000; }
    if (kind === 'complete') {
      addStore(); addReports(3); state.companyCash = 8_000_000;
      state.stores.push({ id: 's2', businessID: 'ramen', prefID: 'tokyo', name: '2号店', status: 'open', quality: 0, brand: 0, condition: 100, operatingHours: 3, openingWeek: 1, weeksToOpen: 0 });
      state.hasHeadOffice = true; state.departments = { operations: { name: '運営部' } };
    }
    game.g = state;
    game.normalize();
    if (kind === 'cash' || kind === 'complete') {
      const beforeCash = game.g.companyCash;
      const ok = game.investBusiness('ramen', 'brand', 100_000);
      if (!ok) throw new Error('production investBusiness action failed while preparing tutorial improvement state');
      if (!Number.isFinite(game.g.finance?.transactions?.at(-1)?.amount)) throw new Error('improvement transaction amount must be finite');
      if (game.g.companyCash !== beforeCash - 100_000) throw new Error('production improvement should have the expected controlled cash effect');
      game.normalize();
    }
    const model = modules.foundingTutorial.build(game.g);
    if (kind === 'cash' && model.current?.id !== 'cash_runway') throw new Error(`cash fixture did not reach cash_runway: ${model.current?.id}`);
    if (kind === 'complete' && model.displayMode !== 'complete') throw new Error(`complete fixture did not reach complete: ${model.displayMode}`);
    localStorage.setItem(key, JSON.stringify(game.g));
  }, { key: SAVE_KEY, kind });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-founding-guide="1"]').waitFor({ state: 'visible' });
}

async function checkCTA(page, label, screen, selector) {
  const beforeRaw = await save(page);
  const before = JSON.parse(beforeRaw);
  const button = page.locator('.founding-guide-cta');
  await assertText(button, label);
  await button.click();
  await page.locator(`[data-screen="${screen}"]`).waitFor({ state: 'visible' });
  const target = page.locator(selector).first();
  await target.waitFor({ state: 'visible' });
  await page.waitForFunction(expectedSelector => {
    const active = document.activeElement;
    return Boolean(active && active.matches(expectedSelector));
  }, selector);
  assert.notEqual(await page.evaluate(() => document.activeElement?.id), 'screen', 'CTA must not fall back to #screen focus');
  assert.equal(await save(page), beforeRaw, 'CTA must not mutate save');
  const after = await parsed(page);
  assert.equal(after.week, before.week, 'CTA must not advance the week');
  assert.equal(after.companyCash, before.companyCash, 'CTA must not change cash');
  assert.equal(after.companyDebt, before.companyDebt, 'CTA must not change debt');
  assert.deepEqual(after.rngState, before.rngState, 'CTA must not change RNG state');
}

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const server = staticServer();
  let browser;
  let page;
  const diagnostics = { consoleErrors: [], pageErrors: [], failedRequests: [] };
  const startedAt = new Date().toISOString();
  const result = {};
  try {
    const baseUrl = await startServer(server);
    browser = await webkit.launch();
    const context = await browser.newContext({ ...devices[DEVICE_NAME], locale: 'ja-JP', timezoneId: 'Asia/Tokyo', reducedMotion: 'reduce', serviceWorkers: 'block' });
    page = await context.newPage();
    page.on('console', message => message.type() === 'error' && diagnostics.consoleErrors.push(message.text()));
    page.on('pageerror', error => diagnostics.pageErrors.push(error.message));
    page.on('requestfailed', request => diagnostics.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`));

    await setupFreshCompany(page, baseUrl);
    result.guideLayout = await assertGuide(page);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'fresh-guide.png'), fullPage: true });

    await setState(page, 'weekly');
    result.weeklyRecapLayout = await layout(page);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'weekly-recap-current.png'), fullPage: true });
    await checkCTA(page, /週間インパクトへ/, 'home', '[data-ceo-dashboard-card="weekly-impact"]');

    await setState(page, 'improvement');
    await assertText(page.locator('[data-founding-guide="1"]'), /最初の改善を行う/);
    const model = await page.evaluate(() => globalThis.__capitalismTycoonModules.foundingTutorial.build(globalThis.__ct_engine.g));
    assert.equal(model.current.id, 'first_improvement');
    const team = await page.evaluate(() => globalThis.__ct_engine.g.workforceTeams.find(t => t.storeID));
    assert.ok(team.storeID);
    assert.equal(team.headcount, team.baseHeadcount);
    assert.equal((team.storePayrollCohorts || []).length, 0);
    assert.equal(team.onboardingHeadcount || 0, 0);
    assert.equal(team.trainingLevel || 0, 0);
    result.improvementLayout = await layout(page);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'first-improvement-current.png'), fullPage: true });
    await checkCTA(page, /改善候補へ/, 'business', '[data-action="business-invest"],[data-action="business-price"]');

    await setState(page, 'cash');
    await assertText(page.locator('[data-founding-guide="1"]'), /黒字と現金余力を確認/);
    result.cashRunwayLayout = await layout(page);
    await checkCTA(page, /決算を見る/, 'report', '.finance-table,.forecast');

    await setState(page, 'summary');
    await assertText(page.locator('[data-founding-guide="1"]'), /進行済みセーブの創業ガイド|要約/);
    assert.equal(await page.locator('[aria-current="step"]').count(), 0);
    result.summaryLayout = await layout(page);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'summary-mode.png'), fullPage: true });
    await checkCTA(page, /成長ロードマップへ/, 'missions', '.mission');

    await setState(page, 'complete');
    await assertText(page.locator('[data-founding-guide="1"]'), /創業チュートリアル完了|10\/10 完了|Executive Secretary/);
    assert.equal(await page.locator('[aria-current="step"]').count(), 0);
    result.completeLayout = await layout(page);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'complete-mode.png'), fullPage: true });
    await checkCTA(page, /成長ロードマップへ/, 'missions', '.mission');

    assert.deepEqual(diagnostics, { consoleErrors: [], pageErrors: [], failedRequests: [] });
    writeResult({ status: 'passed', startedAt, completedAt: new Date().toISOString(), device: DEVICE_NAME, browser: 'WebKit', browserVersion: browser.version(), mainSha: process.env.GITHUB_SHA || null, saveVersion: SAVE_VERSION, ...result, ...diagnostics });
    console.log('Founding tutorial WebKit regression passed');
  } catch (error) {
    if (page) { try { await page.screenshot({ path: path.join(ARTIFACT_DIR, 'failure.png'), fullPage: true }); } catch (_) {} }
    writeResult({ status: 'failed', startedAt, completedAt: new Date().toISOString(), error: error?.stack || String(error), ...result, ...diagnostics });
    throw error;
  } finally {
    if (browser) await browser.close();
    await stopServer(server);
  }
}

main().catch(error => { console.error(error?.stack || error); process.exit(1); });
