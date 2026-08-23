'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const vm = require('node:vm');
const { webkit, devices } = require('playwright');
const { createDiagnostics, isPublishedTarget, observePageDiagnostics, runWithPublishedRetry } = require('./published-webkit-transient-retry');
const { ROOT, loadGame } = require('./harness');

const SAVE_KEY = 'capitalism_tycoon_web_v1';
const SAVE_VERSION = 9;
const DEVICE_NAME = 'iPhone 13';
const TARGET_URL = String(process.env.CAPITAL_ALLOCATION_RECOVERY_TARGET_URL || '').trim();
const OUT = path.resolve(process.env.IPHONE_WEBKIT_ARTIFACT_DIR || path.join(ROOT, 'artifacts', 'iphone-webkit-smoke'));
const RESULT_PATH = path.join(OUT, 'capital-allocation-recovery-outcome-workflow.json');
const TRANSACTION_KINDS = new Set(['securities', 'properties', 'borrowing']);
const MIME = new Map([
  ['.css', 'text/css; charset=utf-8'], ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'], ['.svg', 'image/svg+xml'], ['.webp', 'image/webp']
]);

function installModules(load) {
  for (const file of [
    'player-debt-service.js', 'treasury-prepayment.js', 'shareholder-returns.js',
    'capital-allocation-score.js', 'capital-allocation-policy.js', 'capital-allocation-forecast.js',
    'capital-allocation-actions.js', 'capital-allocation-decision-memo.js',
    'capital-allocation-stress-test.js', 'capital-allocation-resilience-memo.js',
    'capital-allocation-recovery-audit.js', 'capital-allocation-recovery-funding.js',
    'capital-allocation-recovery-funding-options.js', 'capital-allocation-recovery-funding-readiness.js',
    'capital-allocation-recovery-funding-reconciliation.js',
    'capital-allocation-recovery-funding-outcome.js'
  ]) {
    const key = file.replace('.js', '').replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    if (!load.modules[key]) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', file), 'utf8'), load.ctx, { filename:file });
  }
  return load;
}

function buildGame(modules, scenario) {
  const { engine, finance } = modules;
  const state = engine.createInitialState({ configured:true, playerName:'Outcome Director', companyName:'Outcome Holdings' });
  Object.assign(state, {
    week:27,
    publicCompany:true,
    selectedTab:'market',
    companyCash:scenario.cash,
    companyDebt:scenario.debt,
    companyCredit:scenario.credit,
    companyReputation:80,
    investorConfidence:80,
    sharesOut:1_000_000,
    founderShares:600_000,
    stockPrice:scenario.ownSharePrice,
    ticker:'CPTY'
  });
  state.market = state.market.filter(row => !['CPTY', 'EXT'].includes(row.id));
  state.market.push(
    { id:'CPTY', name:state.companyName, sector:'コングロマリット', price:scenario.ownSharePrice, previous:scenario.ownSharePrice, dividendYield:0, volatility:0, trend:0, marketCap:scenario.ownSharePrice*1_000_000, per:20, pbr:2, issuedShares:1_000_000, dividendPerShare:0, shareholders:{}, description:'test issuer', listingMarket:'東証グロース', priceHistory:[{week:27,price:scenario.ownSharePrice}] },
    { id:'EXT', name:'外部上場株', sector:'IT', price:10_000, previous:10_000, dividendYield:0, volatility:0, trend:0, marketCap:10_000_000_000, per:20, pbr:2, issuedShares:1_000_000, dividendPerShare:0, shareholders:{}, description:'test asset', listingMarket:'東証プライム', priceHistory:[{week:27,price:10_000}] }
  );
  state.companyStocks = { EXT:{ qty:scenario.stockQty, avg:8_000 } };
  Object.assign(state.properties[0], {
    owner:'company',
    value:scenario.propertyValue,
    price:scenario.propertyValue,
    purchasePrice:Math.floor(scenario.propertyValue*.6),
    bookValue:Math.floor(scenario.propertyValue*.6)
  });
  state.finance = finance.defaultFinanceState(state);
  state.finance.capitalAllocationPolicy = { id:'balanced', lastChangedWeek:-999, lastEvaluatedWeek:-1, executionScore:50, history:[] };
  finance.event(state, 'revenue', scenario.revenue, {
    week:27,
    cashEffect:0,
    profitEffect:scenario.revenue,
    receivableAmount:scenario.revenue,
    sourceType:'outcomeWebKitFixture',
    sourceID:scenario.id,
    idempotencyKey:`outcome-webkit-revenue-${scenario.id}`,
    description:'Outcome WebKit fixture revenue'
  });
  state.finance.loans = scenario.debt>0 ? [{
    id:`loan-${scenario.id}`, loanID:`loan-${scenario.id}`, status:'active',
    principal:scenario.debt, outstandingPrincipal:scenario.debt,
    interestRate:.1, termWeeks:260, remainingWeeks:200,
    maturityWeek:104, repaymentMethod:'manual', weeklyPrincipalPayment:0, nextPaymentWeek:28
  }] : [];
  finance.rebuildSnapshotForWeek(state, 27);
  state.finance.dirtyWeeks = [];
  const game = new engine.TycoonEngine(state);
  game.g.selectedTab = 'market';
  return game;
}

function findExecutableFixture() {
  const load = installModules(loadGame());
  const modules = load.modules;
  const scenarios = [
    { id:'baseline', cash:10_000_000, debt:300_000_000, credit:100, revenue:100_000_000, ownSharePrice:100, stockQty:10_000, propertyValue:800_000_000 },
    { id:'liquid-heavy', cash:1_000_000, debt:300_000_000, credit:100, revenue:100_000_000, ownSharePrice:100, stockQty:250_000, propertyValue:2_000_000_000 },
    { id:'property-heavy', cash:1_000_000, debt:600_000_000, credit:100, revenue:150_000_000, ownSharePrice:200, stockQty:50_000, propertyValue:5_000_000_000 },
    { id:'deep-recovery', cash:0, debt:1_000_000_000, credit:100, revenue:200_000_000, ownSharePrice:300, stockQty:500_000, propertyValue:10_000_000_000 }
  ];
  const diagnostics = [];
  for (const scenario of scenarios) {
    for (const targetScore of [50, 60, 70, 80]) {
      const game = buildGame(modules, scenario);
      for (let pass=0; pass<3; pass+=1) {
        const seed = modules.capitalAllocationRecoveryFundingReadiness.snapshot(game, targetScore, 'recommended');
        if (!seed.targetPolicy || seed.targetPolicy === game.g.finance.capitalAllocationPolicy.id) break;
        game.g.finance.capitalAllocationPolicy.id = seed.targetPolicy;
        game.g.finance.capitalAllocationPolicy.lastChangedWeek = -999;
      }
      const candidates = modules.capitalAllocationRecoveryFundingReconciliation.candidates(game, targetScore);
      const preferred = candidates.find(row => row.ready && row.steps.some(step => TRANSACTION_KINDS.has(step.kind)));
      diagnostics.push({
        scenario:scenario.id,
        targetScore,
        currentPolicy:game.g.finance.capitalAllocationPolicy.id,
        candidates:candidates.map(row => ({
          optionId:row.optionId,
          ready:row.ready,
          status:row.status,
          targetReached:row.targetReached,
          projectedScore:row.projectedScore,
          blockers:Array.from(row.blockers || [], blocker => blocker.id),
          stepKinds:Array.from(row.steps || [], step => step.kind)
        }))
      });
      if (!preferred) continue;
      assert.equal(modules.engine.SAVE_KEY, SAVE_KEY);
      assert.equal(modules.engine.SAVE_VERSION, SAVE_VERSION);
      assert.equal(game.g.saveVersion, SAVE_VERSION);
      assert.deepEqual(Array.from(modules.finance.validate(game.g).errors || []), []);
      return {
        save:JSON.stringify(game.g),
        scenario:scenario.id,
        targetScore,
        optionId:preferred.optionId,
        expectedStepKinds:Array.from(preferred.steps, step => step.kind),
        diagnostics
      };
    }
  }
  assert.fail(`no executable recovery fixture found: ${JSON.stringify(diagnostics)}`);
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

function normalizedTargetUrl(value) {
  if (!value) return '';
  const target = new URL(value);
  assert.ok(['http:', 'https:'].includes(target.protocol), 'recovery target URL must use http or https');
  if (!target.pathname.endsWith('/')) target.pathname += '/';
  return target.toString();
}

async function assertInsideViewport(page, selector) {
  const layout = await page.locator(selector).evaluate(node => {
    const rect = node.getBoundingClientRect();
    return { viewportWidth:innerWidth, documentWidth:document.documentElement.scrollWidth, bodyWidth:document.body.scrollWidth, left:rect.left, right:rect.right, width:rect.width };
  });
  assert.ok(layout.documentWidth <= layout.viewportWidth + 2, `document overflow: ${JSON.stringify(layout)}`);
  assert.ok(layout.bodyWidth <= layout.viewportWidth + 2, `body overflow: ${JSON.stringify(layout)}`);
  assert.ok(layout.left >= -2 && layout.right <= layout.viewportWidth + 2, `card escaped viewport: ${JSON.stringify(layout)}`);
}

async function runAttempt(attempt) {
  fs.mkdirSync(OUT, { recursive:true });
  const diagnostics = createDiagnostics();
  const startedAt = new Date().toISOString();
  let server;
  let browser;
  let page;
  let baseUrl = '';
  let stage = 'fixture';
  let fixture = null;
  try {
    fixture = findExecutableFixture();
    baseUrl = normalizedTargetUrl(TARGET_URL);
    if (!baseUrl) {
      stage = 'server';
      server = staticServer();
      baseUrl = await startServer(server);
    }
    stage = 'browser';
    browser = await webkit.launch();
    const context = await browser.newContext({ ...devices[DEVICE_NAME], locale:'ja-JP', reducedMotion:'reduce', serviceWorkers:'block', timezoneId:'Asia/Tokyo' });
    await context.addInitScript(({ key, value }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, value); }, { key:SAVE_KEY, value:fixture.save });
    page = await context.newPage();
    observePageDiagnostics(page, { published: isPublishedTarget(baseUrl), targetUrl: baseUrl, diagnostics });

    stage = 'boot';
    await page.goto(baseUrl, { waitUntil:'networkidle', timeout:30_000 });
    await page.locator('.topbar').waitFor({ state:'visible', timeout:20_000 });
    assert.match(await page.locator('.topbar').innerText(), /Outcome Holdings/);
    const reconciliation = page.locator('[data-capital-allocation-recovery-funding-reconciliation]');
    const outcome = page.locator('[data-capital-allocation-recovery-funding-outcome]');
    await reconciliation.waitFor({ state:'visible', timeout:30_000 });
    await outcome.waitFor({ state:'visible', timeout:30_000 });
    assert.match(await outcome.innerText(), /計画なし/);
    await assertInsideViewport(page, '[data-capital-allocation-recovery-funding-outcome]');

    stage = 'pin';
    const storedBeforePin = await page.evaluate(key => localStorage.getItem(key), SAVE_KEY);
    const pinned = await page.evaluate(({ targetScore, optionId }) => {
      const modules = globalThis.__capitalismTycoonModules;
      const engine = modules.playerEngineBridge?.getEngine?.();
      const value = modules.capitalAllocationRecoveryFundingReconciliation?.pin?.(engine, targetScore, optionId);
      engine?.emit?.();
      return value ? { targetScore:value.targetScore, optionId:value.optionId, fingerprint:value.fingerprint, stepKinds:Array.from(value.steps || [], step => step.kind) } : null;
    }, { targetScore:fixture.targetScore, optionId:fixture.optionId });
    assert.ok(pinned, 'selected recovery plan must pin in the production browser runtime');
    assert.deepEqual(pinned.stepKinds, fixture.expectedStepKinds);
    await page.locator('[data-capital-allocation-funding-clear]').waitFor({ state:'visible', timeout:10_000 });
    await page.waitForFunction(() => /未着手|実行中/.test(document.querySelector('[data-capital-allocation-recovery-funding-outcome]')?.innerText || ''), null, { timeout:10_000 });
    assert.equal(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY), storedBeforePin, 'pinning must not mutate the persisted save');

    stage = 'execute';
    const execution = await page.evaluate(() => {
      const modules = globalThis.__capitalismTycoonModules;
      const engine = modules.playerEngineBridge?.getEngine?.();
      const plan = modules.capitalAllocationRecoveryFundingReconciliation?.pinned?.(engine);
      if (!engine || !plan) throw new Error('pinned recovery plan is unavailable');
      const results = [];
      for (const step of plan.steps || []) {
        let ok = false;
        if (step.kind === 'policy') ok = engine.setCapitalAllocationPolicy(plan.targetPolicy) === true;
        else if (step.kind === 'securities') ok = engine.sellStock(step.sourceId, step.units, 'company') === true;
        else if (step.kind === 'properties') ok = engine.sellProperty(step.sourceId) === true;
        else if (step.kind === 'borrowing') ok = engine.borrow(step.amount, 'company') === true;
        else if (step.kind === 'noAction') ok = true;
        else throw new Error(`unsupported recovery step: ${step.kind}`);
        results.push({ kind:step.kind, ok });
        if (!ok) throw new Error(`recovery step failed: ${step.kind}`);
      }
      engine.emit?.();
      const report = engine.capitalAllocationRecoveryFundingOutcome();
      return {
        results,
        financeErrors:Array.from(modules.finance?.validate?.(engine.g)?.errors || []).map(String),
        report:{ status:report.status, verified:report.verified, targetReached:report.targetReached, transactionCount:report.evidence?.transactionCount || 0, cashVariance:report.cashVariance, debtVariance:report.debtVariance, scoreVariance:report.scoreVariance }
      };
    });
    assert.ok(execution.results.every(row => row.ok));
    assert.deepEqual(execution.financeErrors, []);
    assert.equal(execution.report.status, 'verified');
    assert.equal(execution.report.verified, true);
    assert.equal(execution.report.targetReached, true);
    assert.ok(execution.report.transactionCount >= 1);
    assert.ok(Math.abs(execution.report.cashVariance) <= .5);
    assert.ok(Math.abs(execution.report.debtVariance) <= .5);
    await page.waitForFunction(() => /検証完了/.test(document.querySelector('[data-capital-allocation-recovery-funding-outcome]')?.innerText || ''), null, { timeout:10_000 });
    assert.match(await reconciliation.innerText(), /完了/);
    assert.match(await outcome.innerText(), /検証完了/);
    const storedAfterExecution = await page.evaluate(key => localStorage.getItem(key), SAVE_KEY);
    assert.notEqual(storedAfterExecution, storedBeforePin, 'real funding transactions must persist through the normal save path');
    await outcome.screenshot({ path:path.join(OUT, 'capital-allocation-recovery-outcome.png') });
    await assertInsideViewport(page, '[data-capital-allocation-recovery-funding-outcome]');

    stage = 'clear';
    await page.locator('[data-capital-allocation-funding-clear]').click();
    await page.waitForFunction(() => /計画なし/.test(document.querySelector('[data-capital-allocation-recovery-funding-outcome]')?.innerText || ''), null, { timeout:10_000 });
    assert.equal(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY), storedAfterExecution, 'clearing the transient plan must not mutate the executed save');
    await assertInsideViewport(page, '[data-capital-allocation-recovery-funding-outcome]');

    stage = 'evidence';
    assert.deepEqual(diagnostics, { consoleErrors:[], pageErrors:[], failedRequests:[], requiredAssetServerErrors:[] });
    fs.writeFileSync(RESULT_PATH, `${JSON.stringify({
      status:'passed', attempt, published:isPublishedTarget(baseUrl), requiredAssetServerErrors:diagnostics.requiredAssetServerErrors, stage, startedAt, completedAt:new Date().toISOString(),
      device:DEVICE_NAME, browser:'WebKit', browserVersion:browser.version(),
      targetUrl:baseUrl, published:Boolean(TARGET_URL),
      scenario:fixture.scenario, targetScore:fixture.targetScore, pinnedOption:fixture.optionId,
      executedStepKinds:fixture.expectedStepKinds, outcome:execution.report,
      saveKey:SAVE_KEY, saveVersion:SAVE_VERSION
    }, null, 2)}\n`);
    console.log(`capital allocation recovery outcome iPhone WebKit workflow passed (${TARGET_URL ? 'published' : 'local'})`);
    await context.close();
  } catch (error) {
    if (page) { try { await page.screenshot({ path:path.join(OUT, 'capital-allocation-recovery-outcome-failure.png') }); } catch (_) {} }
    fs.writeFileSync(RESULT_PATH, `${JSON.stringify({
      status:'failed', attempt, published:isPublishedTarget(baseUrl || TARGET_URL), stage, startedAt, completedAt:new Date().toISOString(),
      targetUrl:baseUrl || TARGET_URL || null, published:Boolean(TARGET_URL),
      fixture:fixture ? { scenario:fixture.scenario, targetScore:fixture.targetScore, optionId:fixture.optionId } : null,
      error:error?.stack || String(error), ...diagnostics
    }, null, 2)}\n`);
    error.publishedWebKitDiagnostics = diagnostics;
    throw error;
  } finally {
    if (browser) await browser.close();
    if (server) await stopServer(server);
  }
}

async function main() { await runWithPublishedRetry({ published: isPublishedTarget(TARGET_URL), resultPath: RESULT_PATH, runAttempt }); }

main().catch(error => { console.error(error?.stack || error); process.exit(1); });
