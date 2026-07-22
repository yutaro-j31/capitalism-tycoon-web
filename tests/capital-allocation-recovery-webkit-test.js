'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const vm = require('node:vm');
const { webkit, devices } = require('playwright');
const { ROOT, loadGame } = require('./harness');

const SAVE_KEY = 'capitalism_tycoon_web_v1';
const DEVICE_NAME = 'iPhone 13';
const OUT = path.resolve(process.env.IPHONE_WEBKIT_ARTIFACT_DIR || path.join(ROOT, 'artifacts', 'iphone-webkit-smoke'));
const RESULT_PATH = path.join(OUT, 'capital-allocation-recovery-workflow.json');
const MIME = new Map([
  ['.css', 'text/css; charset=utf-8'], ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'], ['.svg', 'image/svg+xml'], ['.webp', 'image/webp']
]);

function installCapitalAllocationModules(load) {
  const files = [
    'player-debt-service.js', 'treasury-prepayment.js', 'shareholder-returns.js',
    'capital-allocation-score.js', 'capital-allocation-policy.js', 'capital-allocation-forecast.js',
    'capital-allocation-actions.js', 'capital-allocation-decision-memo.js',
    'capital-allocation-stress-test.js', 'capital-allocation-resilience-memo.js',
    'capital-allocation-recovery-audit.js', 'capital-allocation-recovery-funding.js',
    'capital-allocation-recovery-funding-options.js', 'capital-allocation-recovery-funding-readiness.js',
    'capital-allocation-recovery-funding-reconciliation.js'
  ];
  for (const file of files) {
    const key = file.replace('.js', '').replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    if (!load.modules[key]) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', file), 'utf8'), load.ctx, { filename:file });
  }
  return load;
}

function resilientPublicSave() {
  const load = installCapitalAllocationModules(loadGame());
  const { engine, finance } = load.modules;
  const state = engine.createInitialState({ configured:true, playerName:'WebKit Director', companyName:'Recovery Holdings' });
  Object.assign(state, {
    week:53, publicCompany:true, selectedTab:'market', companyCash:2_000_000_000,
    companyDebt:100_000_000, companyCredit:100, companyReputation:80, investorConfidence:80,
    sharesOut:1_000_000, founderShares:600_000, stockPrice:1_000, ticker:'CPTY'
  });
  state.market = state.market.filter(row => !['CPTY', 'EXT'].includes(row.id));
  state.market.push(
    { id:'CPTY', name:state.companyName, sector:'コングロマリット', price:1_000, previous:1_000, dividendYield:0, volatility:0, trend:0, marketCap:1_000_000_000, per:20, pbr:2, issuedShares:1_000_000, dividendPerShare:0, shareholders:{}, description:'test issuer', listingMarket:'東証グロース', priceHistory:[{week:53,price:1_000}] },
    { id:'EXT', name:'外部上場株', sector:'IT', price:10_000, previous:10_000, dividendYield:0, volatility:0, trend:0, marketCap:10_000_000_000, per:20, pbr:2, issuedShares:1_000_000, dividendPerShare:0, shareholders:{}, description:'test asset', listingMarket:'東証プライム', priceHistory:[{week:53,price:10_000}] }
  );
  state.companyStocks = { EXT:{ qty:10_000, avg:8_000 } };
  Object.assign(state.properties[0], { owner:'company', value:1_000_000_000, price:1_000_000_000, purchasePrice:600_000_000, bookValue:600_000_000 });
  state.finance = finance.defaultFinanceState(state);
  state.finance.capitalAllocationPolicy = { id:'balanced', lastChangedWeek:-999, lastEvaluatedWeek:-1, executionScore:80, history:[] };
  finance.event(state, 'revenue', 500_000_000, {
    week:53, cashEffect:0, profitEffect:500_000_000, receivableAmount:500_000_000,
    sourceType:'recoveryWebKitFixture', sourceID:'baseline', idempotencyKey:'recovery-webkit-revenue', description:'WebKit fixture revenue'
  });
  state.finance.loans = [{ loanID:'fixture-loan', principal:100_000_000, outstandingPrincipal:100_000_000, interestRate:.03, termWeeks:260, remainingWeeks:200, repaymentMethod:'manual', weeklyPrincipalPayment:0, nextPaymentWeek:54, status:'active' }];
  finance.rebuildSnapshotForWeek(state, 53);
  state.finance.dirtyWeeks = [];

  const game = new engine.TycoonEngine(state);
  game.g.selectedTab = 'market';
  assert.equal(engine.SAVE_KEY, SAVE_KEY);
  assert.equal(engine.SAVE_VERSION, 9);
  assert.equal(game.g.saveVersion, 9);
  const candidates = load.modules.capitalAllocationRecoveryFundingReconciliation.candidates(game, 70);
  assert.equal(candidates.length, 4);
  assert.ok(candidates.some(row => row.ready), 'fixture must expose at least one pinnable recovery option');
  const financeErrors = Array.from(finance.validate(game.g).errors || []);
  assert.equal(financeErrors.length, 0, `fixture accounting errors: ${financeErrors.join(' | ')}`);
  return JSON.stringify(game.g);
}

function staticServer() {
  return http.createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname);
      const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      const requested = path.resolve(ROOT, relative);
      assert.ok(requested === ROOT || requested.startsWith(`${ROOT}${path.sep}`), `unsafe request path: ${pathname}`);
      const target = fs.statSync(requested).isDirectory() ? path.join(requested, 'index.html') : requested;
      const body = fs.readFileSync(target);
      response.writeHead(200, { 'cache-control':'no-store', 'content-length':String(body.length), 'content-type':MIME.get(path.extname(target).toLowerCase()) || 'application/octet-stream' });
      response.end(body);
    } catch (error) {
      response.writeHead(error?.code === 'ENOENT' ? 404 : 500, { 'content-type':'text/plain; charset=utf-8' });
      response.end(error?.code === 'ENOENT' ? 'Not found' : String(error?.message || error));
    }
  });
}

async function startServer(server) {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return `http://127.0.0.1:${server.address().port}/`;
}
async function stopServer(server) { await new Promise(resolve => server.close(resolve)); }

async function assertMobileCardLayout(page, selector, minimumControls) {
  const layout = await page.locator(selector).evaluate(node => {
    const rect = node.getBoundingClientRect();
    const controls = [...node.querySelectorAll('button')].map(button => {
      const box = button.getBoundingClientRect();
      const style = getComputedStyle(button);
      return { text:button.textContent.trim(), displayed:style.display !== 'none' && style.visibility !== 'hidden', width:box.width, height:box.height, left:box.left, right:box.right };
    }).filter(row => row.displayed);
    return { viewportWidth:innerWidth, documentWidth:document.documentElement.scrollWidth, bodyWidth:document.body.scrollWidth, rect:{left:rect.left,right:rect.right,width:rect.width}, controls };
  });
  assert.ok(layout.documentWidth <= layout.viewportWidth + 2, `document overflow: ${layout.documentWidth} > ${layout.viewportWidth}`);
  assert.ok(layout.bodyWidth <= layout.viewportWidth + 2, `body overflow: ${layout.bodyWidth} > ${layout.viewportWidth}`);
  assert.ok(layout.rect.left >= -2 && layout.rect.right <= layout.viewportWidth + 2, `recovery card escaped viewport: ${JSON.stringify(layout.rect)}`);
  assert.ok(layout.controls.length >= minimumControls, `recovery card must expose at least ${minimumControls} controls`);
  for (const control of layout.controls) {
    assert.ok(control.width >= 1 && control.height >= 24, `unusable recovery control: ${JSON.stringify(control)}`);
    assert.ok(control.right > 0 && control.left < layout.viewportWidth, `unreachable recovery control: ${JSON.stringify(control)}`);
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive:true });
  const diagnostics = { consoleErrors:[], pageErrors:[], failedRequests:[] };
  const startedAt = new Date().toISOString();
  let server;
  let browser;
  let page;
  let stage = 'fixture';
  try {
    const save = resilientPublicSave();
    stage = 'server';
    server = staticServer();
    const baseUrl = await startServer(server);
    stage = 'browser';
    browser = await webkit.launch();
    const context = await browser.newContext({ ...devices[DEVICE_NAME], locale:'ja-JP', reducedMotion:'reduce', serviceWorkers:'block', timezoneId:'Asia/Tokyo' });
    await context.addInitScript(({ key, value }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, value); }, { key:SAVE_KEY, value:save });
    page = await context.newPage();
    page.on('console', message => message.type() === 'error' && diagnostics.consoleErrors.push(message.text()));
    page.on('pageerror', error => diagnostics.pageErrors.push(error.message));
    page.on('requestfailed', request => diagnostics.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`));

    stage = 'boot';
    await page.goto(baseUrl, { waitUntil:'networkidle', timeout:30_000 });
    await page.locator('.topbar').waitFor({ state:'visible', timeout:20_000 });
    assert.match(await page.locator('.topbar').innerText(), /Recovery Holdings/);

    stage = 'cards';
    const readiness = page.locator('[data-capital-allocation-recovery-funding-readiness]');
    const options = page.locator('[data-capital-allocation-recovery-funding-options]');
    const reconciliation = page.locator('[data-capital-allocation-recovery-funding-reconciliation]');
    await readiness.waitFor({ state:'visible', timeout:30_000 });
    await options.waitFor({ state:'visible', timeout:30_000 });
    await reconciliation.waitFor({ state:'visible', timeout:30_000 });
    assert.match(await readiness.innerText(), /回復資金・実行前確認/);
    const initialText = await reconciliation.innerText();
    for (const label of ['現行推奨', '無借入', '不動産温存', '資産温存']) assert.match(initialText, new RegExp(label));
    assert.equal(await reconciliation.locator('[data-capital-allocation-funding-pin]').count(), 4);
    assert.ok(await reconciliation.locator('[data-capital-allocation-funding-pin]:not([disabled])').count() >= 1);
    await assertMobileCardLayout(page, '[data-capital-allocation-recovery-funding-reconciliation]', 4);

    stage = 'pin';
    const storedBeforePin = await page.evaluate(key => localStorage.getItem(key), SAVE_KEY);
    const pinButton = reconciliation.locator('[data-capital-allocation-funding-pin]:not([disabled])').first();
    const pinnedOption = await pinButton.getAttribute('data-capital-allocation-funding-option');
    await pinButton.click();
    const clearButton = page.locator('[data-capital-allocation-funding-clear]');
    await clearButton.waitFor({ state:'visible', timeout:10_000 });
    const pinnedText = await page.locator('[data-capital-allocation-recovery-funding-reconciliation]').innerText();
    assert.match(pinnedText, /計画識別子/);
    assert.match(pinnedText, /会計証跡/);
    assert.match(pinnedText, /固定を解除/);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY), storedBeforePin, 'transient pinning must not mutate the save');
    await assertMobileCardLayout(page, '[data-capital-allocation-recovery-funding-reconciliation]', 1);

    stage = 'clear';
    await clearButton.click();
    await page.locator('[data-capital-allocation-funding-pin]').first().waitFor({ state:'visible', timeout:10_000 });
    assert.equal(await page.locator('[data-capital-allocation-funding-pin]').count(), 4);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY), storedBeforePin, 'clearing the transient plan must not mutate the save');
    await assertMobileCardLayout(page, '[data-capital-allocation-recovery-funding-reconciliation]', 4);

    stage = 'evidence';
    await page.screenshot({ path:path.join(OUT, 'capital-allocation-recovery-workflow.png'), fullPage:true });
    assert.deepEqual(diagnostics, { consoleErrors:[], pageErrors:[], failedRequests:[] });
    fs.writeFileSync(RESULT_PATH, `${JSON.stringify({ status:'passed', stage, startedAt, completedAt:new Date().toISOString(), device:DEVICE_NAME, browser:'WebKit', browserVersion:browser.version(), pinnedOption, optionCount:4, saveKey:SAVE_KEY, saveVersion:9 }, null, 2)}\n`);
    console.log('capital allocation recovery workflow iPhone WebKit smoke passed');
    await context.close();
  } catch (error) {
    if (page) { try { await page.screenshot({ path:path.join(OUT, 'capital-allocation-recovery-workflow-failure.png'), fullPage:true }); } catch (_) {} }
    fs.writeFileSync(RESULT_PATH, `${JSON.stringify({ status:'failed', stage, startedAt, completedAt:new Date().toISOString(), error:error?.stack || String(error), ...diagnostics }, null, 2)}\n`);
    throw error;
  } finally {
    if (browser) await browser.close();
    if (server) await stopServer(server);
  }
}

main().catch(error => { console.error(error?.stack || error); process.exit(1); });
