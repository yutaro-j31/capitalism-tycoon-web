'use strict';

// UI v3 destinations (docs/ui-v3/README.md 6.6 / 10.10, task UI3-10c). A row of the home's "今週やること" that asks for something ("在庫切れリスクが
// 高まっています", "従業員疲労が危険水準です", ...) must lead to a place where that can be done. For every secretary task and every founding-guide
// step (the table is in docs/ui-v3/migration-ledger.md) this test builds the game state that produces the row, presses the row, and proves:
//  - the destination (a v3 screen, a sheet, or the current screen opened directly) is the one the table names;
//  - the operation the table names is visible, enabled and reachable by a finger (not only "the screen changed").
// It also exercises the store sheet's "在庫と仕入れ" section (policy, safety stock, emergency purchase, supplier change with its fees).
// Registered in tests/test-execution-registry.json (iPhone Acceptance Playthrough job).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

// --- static contracts ---------------------------------------------------
const FILES = [];
const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
for (const name of FILES) {
  const source = fs.readFileSync(path.join(ROOT, 'js', `${name}.js`), 'utf8');
  assert.doesNotMatch(source, /Math\.random|Date\.now|MutationObserver|registerUIEnhancer/, `${name} uses no RNG, clock, observer or D UI enhancer`);
  assert.doesNotMatch(source, /\b(?:g|engine\.g|context\.g)\.[A-Za-z_$][\w$]*\s*(?:=(?!=)|\+=|-=|\+\+|--)/, `${name} never assigns engine state`);
  assert.doesNotMatch(source, /\.save\(|localStorage|sessionStorage|(?<![\w.])confirm\(/, `${name} never saves, stores or uses the browser's confirm()`);
  assert.ok(index.indexOf(`./js/${name}.js`) > index.indexOf('./js/ui3-shell.js') && index.indexOf(`./js/${name}.js`) < index.indexOf('./js/app.js'), `index.html loads ${name} after the shell and before the app`);
}

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
const digest = page => engineEval(page, engine => JSON.stringify(engine.g, (key, value) => (key === 'lastSaveDate' || key === 'saveSequence' ? undefined : value)));
// the share-count dialog is the v3 amount sheet (UI3-9a)
const cancelDialog = page => page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').tap();
async function enterAmount(page, amount) {
  await page.locator('#modal-root [data-ui3-amount-input]').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#modal-root [data-ui3-amount-input]').fill(String(amount));
  await page.locator('#modal-root [data-ui3-amount-run]').tap();
}

async function found(page, url) {
  await page.goto(url, { waitUntil: 'load' });
  await page.locator('#setup-form').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('#setup-form').evaluate(form => form.requestSubmit());
  await page.waitForFunction(() => !document.getElementById('setup-form'), null, { timeout: 30000 });
}
const metrics = page => page.evaluate(() => {
  const visible = element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden'; };
  const controls = [...document.querySelectorAll('#app button,#app a[href],#app input,#app select')].filter(visible);
  let minFont = 99; const walker = document.createTreeWalker(document.getElementById('app'), NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) { const node = walker.currentNode; if (node.nodeValue.trim() && visible(node.parentElement)) minFont = Math.min(minFont, parseFloat(getComputedStyle(node.parentElement).fontSize)); }
  return { small: controls.filter(element => { const box = element.getBoundingClientRect(); return box.width < 44 || box.height < 44; }).map(element => element.className || element.tagName),
    minFont, overflowX: document.documentElement.scrollWidth > innerWidth, screens: document.documentElement.scrollHeight / innerHeight };
});
const sheetMetrics = page => page.evaluate(() => {
  const root = document.querySelector('#modal-root .u-sheet');
  const visible = element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0; };
  const small = [...root.querySelectorAll('button')].filter(visible).filter(element => { const box = element.getBoundingClientRect(); return box.width < 44 || box.height < 44; }).map(element => element.textContent.trim());
  let minFont = 99; const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) { const node = walker.currentNode; if (node.nodeValue.trim() && visible(node.parentElement)) minFont = Math.min(minFont, parseFloat(getComputedStyle(node.parentElement).fontSize)); }
  return { small, minFont, bottom: Math.round(root.getBoundingClientRect().bottom), primaries: [...root.querySelectorAll('.u-btn.primary')].filter(visible).length };
});


// A finger can reach the element: scrolled to, its centre is inside the window and the element (or a child) is what is there.
const REACHABLE = selector => {
  const node = document.querySelector(selector);
  if (!node) return 'missing';
  if (node.disabled || node.getAttribute('aria-disabled') === 'true') return 'disabled';
  node.scrollIntoView({ block: 'center', inline: 'center' });
  const box = node.getBoundingClientRect();
  if (box.width <= 0 || box.height <= 0) return 'not visible';
  const x = box.left + box.width / 2, y = box.top + box.height / 2;
  if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return 'outside the window';
  const top = document.elementFromPoint(x, y);
  return top && (top === node || node.contains(top) || top.closest('#toast-root')) ? 'ok' : `covered by ${top?.className || top?.tagName}`;
};

// Test set-up helpers (they write the game state, which only a test may do).
const ADD_STORE = (engine, [name, patch]) => {
  const g = engine.g, modules = globalThis.__capitalismTycoonModules;
  const tenant = g.tenants.find(item => !item.occupiedBy);
  engine.openStore({ tenantID: tenant.id, businessID: patch.businessID || 'ramen', name, operatingHours: 3 });
  const store = g.stores.find(item => item.name === name);
  store.status = 'open';
  modules.supply.ensureStore(g, store);
  Object.assign(store, { inventory: 50, weeklyDemand: 10, lastProfit: 100000 }, patch);
  return store.id;
};
// a declared crisis, built the way tests/ui3-crisis-webkit-test.js builds one
const CRISIS = engine => {
  const m = globalThis.__capitalismTycoonModules, g = engine.g;
  delete g.playerCrisis; delete g.playerCrisisActions; delete g.playerTurnaroundPlan; delete g.playerTurnaroundFund;
  g.week = 2; g.companyCash = -1000000; g.personalCash = 50000000; g.companyCredit = 80;
  g.finance = m.finance.defaultFinanceState(g);
  m.playerCrisis.evaluate(g);
  engine.crisisLiquidityOptions(); engine.turnaroundPlanSnapshot?.(); engine.turnaroundFundOptions?.();
};
// a real M&A deal room opened through the engine (investment department, generated targets, openMADealRoom), then shaped by `patch`
const MA_DEAL = (engine, patch) => {
  const g = engine.g;
  g.companyCash = 900000000; g.personalCash = 900000000; g.hasHeadOffice = true; g.officeCapacity = 80;
  g.completedMissionIDs = globalThis.__capitalismTycoonModules.data.MISSION_DEFS.map(mission => mission.id); g.activeMissionIDs = [];
  if (!g.departments.investment) engine.establishDepartment('investment');
  engine.generateMATargets(true);
  const target = g.acquisitionTargets.find(item => !item.peTierID);
  engine.openMADealRoom(target.id);
  const deal = g.maDealRooms.find(item => item.targetID === target.id);
  Object.assign(deal, patch);
  globalThis.__dealID = deal.id;
  return deal;
};
const MA_SUBSIDIARY = (engine, pmiStatus) => {
  const g = engine.g;
  g.maSubsidiaries = [{ id: 'sub-t', name: 'テスト子会社', status: 'active', pmiStatus, groupMandate: '成長投資', investmentBookValue: 0 }];
};
const RICH = engine => { engine.g.companyCash = 900000000; engine.g.personalCash = 900000000; };

// Each task: the state that produces its row, the row, and what must be true after pressing it.
const BANK_BORROW = ['[data-ui3-bank-amount="borrow"]'];
const BANK_REPAY = ['[data-ui3-bank-amount="repay"]'];
const SUPPLY_OPS = ['[data-ui3-supply-card] [data-action="supply-policy"]', '[data-ui3-supply-card] [data-action="supply-safety"]', '[data-ui3-supply="emergency"]', '[data-ui3-supply="suppliers"]'];
const LOAN_FN = (engine, rate) => { const g = engine.g; g.companyDebt = 3000000; g.finance.loans = [{ loanID: 'loan-t', id: 'loan-t', status: 'active', nextPaymentWeek: g.week + 1, interestRate: rate, balance: 3000000, principal: 3000000 }]; };
const HELPERS_SOURCE = `({ ADD_STORE: ${ADD_STORE}, RICH: ${RICH}, LOAN: ${LOAN_FN}, CRISIS: ${CRISIS}, MA_DEAL: ${MA_DEAL}, MA_SUBSIDIARY: ${MA_SUBSIDIARY} })`;
const TASKS = [
  { id: 'finance_cash_negative', setup: engine => { T.CRISIS(engine); }, tab: 'home', native: true, crisisSheet: true, ops: ['#modal-root [data-ui3-cr]'] },
  { id: 'finance_cash_negative', variant: 'crisis not declared yet', setup: engine => { engine.g.companyCash = -3000000; }, tab: 'bank', native: true, info: ['[data-ui3-bank="summary"]'] },
  { id: 'finance_cash_runway', setup: engine => { engine.g.companyCash = 900000; }, tab: 'bank', native: true, ops: BANK_BORROW },
  { id: 'finance_loss_runway', setup: engine => { engine.g.lastReport = { ...(engine.g.lastReport || {}), profit: -3000000, expenses: 5000000 }; }, tab: 'report', native: true, info: ['[data-ui3-report="summary"]'] },
  { id: 'finance_debt_due', setup: engine => { T.LOAN(engine, 0.05); }, tab: 'bank', native: true, ops: BANK_REPAY },
  { id: 'finance_high_interest', setup: engine => { T.LOAN(engine, 0.15); }, tab: 'bank', native: true, ops: BANK_REPAY },
  { id: 'finance_debt_heavy', setup: engine => { engine.g.companyDebt = 900000000; engine.g.companyCash = 8000000; }, tab: 'bank', native: true, ops: BANK_REPAY },
  { id: 'supply_stockout', setup: engine => { T.RICH(engine); T.ADD_STORE(engine, ['在庫十分店', {}]); T.ADD_STORE(engine, ['欠品店', { inventory: 0 }]); }, tab: 'business', native: true, sheet: '[data-ui3-business-sheet]', sheetTitle: '欠品店', ops: SUPPLY_OPS },
  { id: 'supply_overstock', setup: engine => { T.RICH(engine); T.ADD_STORE(engine, ['在庫十分店', {}]); T.ADD_STORE(engine, ['過剰在庫店', { inventory: 500, weeklyDemand: 10 }]); }, tab: 'business', native: true, sheet: '[data-ui3-business-sheet]', sheetTitle: '過剰在庫店', ops: SUPPLY_OPS },
  { id: 'store_loss', setup: engine => { T.RICH(engine); T.ADD_STORE(engine, ['黒字店', {}]); T.ADD_STORE(engine, ['赤字店', { lastProfit: -500000 }]); }, tab: 'business', native: true, sheet: '[data-ui3-business-sheet]', sheetTitle: '赤字店', ops: ['[data-action="store-price"]'] },
  { id: 'workforce_fatigue', setup: engine => { engine.g.overtimeRisk = 0.9; }, tab: 'office', native: true, ops: ['[data-action="workforce-invest"]', '[data-action="toggle-remote"]'] },
  { id: 'workforce_retention', setup: engine => { engine.g.keyPersonnel = [{ id: 'kp-t', name: 'テスト社員', roleID: 'sales', level: 2, salary: 6000000, loyalty: 50, motivation: 50, retentionRisk: 0.9, traitIDs: [] }]; engine.g.hasHeadOffice = true; }, tab: 'office', native: false, ops: ['[data-action="train-keyperson"]'], info: ['#screen'] },
  { id: 'growth_product_ready', setup: engine => { T.RICH(engine); engine.g.productVentures = [{ id: 'pv-t', name: 'テスト商品', status: 'completed', progress: 100, origin: 'formal' }]; }, tab: 'business', native: false, info: ['#screen'] },
  { id: 'growth_competitor_alert', setup: engine => { engine.g.competitorOwnedRatio = 0.2; }, tab: 'rivals', native: true, ops: ['[data-ui3-rival="rival"]'] },
  { id: 'growth_ipo_ready', setup: engine => { engine.ipoMissingReasons = () => []; engine.g.hasHeadOffice = true; }, tab: 'office', native: false, ops: ['[data-action="execute-ipo"]'], info: ['#screen'] },
  { id: 'growth_expansion_capacity', setup: engine => { T.RICH(engine); T.ADD_STORE(engine, ['黒字店', {}]); }, tab: 'map', native: true, ops: ['.u-pin'] },
  { id: 'crisis_active', setup: engine => { T.CRISIS(engine); }, tab: 'home', native: true, crisisSheet: true, ops: ['#modal-root [data-ui3-cr]'] },
  { id: 'crisis_active', variant: 'crisis not declared yet', setup: engine => { engine.g.companyCash = -3000000; }, tab: 'bank', native: true, info: ['[data-ui3-bank="summary"]'] },
  // M&A: the deal-room and integration operations live in the current screen only, so each row opens it directly
  { id: 'ma_dd_completed_', prefix: true, setup: engine => { T.MA_DEAL(engine, { activeDiligence: { status: 'completed' } }); }, tab: 'ma', native: false, info: ['[data-ma-deal-room]'] },
  { id: 'ma_counter_', prefix: true, setup: engine => { T.MA_DEAL(engine, { status: 'countered' }); }, tab: 'ma', native: false, info: ['[data-ma-deal-room]'] },
  { id: 'ma_competing_bid_', prefix: true, setup: engine => { T.MA_DEAL(engine, { competingBid: { status: 'active' } }); }, tab: 'ma', native: false, info: ['[data-ma-deal-room]'] },
  { id: 'ma_financing_', prefix: true, setup: engine => { T.MA_DEAL(engine, { status: 'accepted', acceptedTerms: { method: 'cash' } }); }, tab: 'ma', native: false, info: ['[data-ma-deal-room]'] },
  { id: 'ma_accepted_', prefix: true, setup: engine => { T.MA_DEAL(engine, { status: 'accepted', acceptedTerms: { method: 'shareSwap' } }); /* the approval chain (terms, public company, due diligence) is not built here: the validator says valid, so the secretary produces this row */ globalThis.__capitalismTycoonModules.maBoardApproval.validateApproval = () => ({ valid: true }); }, tab: 'ma', native: false, info: ['[data-ma-deal-room]'] },
  { id: 'ma_financing_invalid_', prefix: true, setup: engine => { T.MA_DEAL(engine, { status: 'accepted', acceptedTerms: { method: 'cash' }, acquisitionFinancingPlan: { planKey: 'plan-t', mode: 'cash', cashAmount: 1, debtAmount: 0, equityAmount: 0 } }); }, tab: 'ma', native: false, info: ['[data-ma-deal-room]'] },
  { id: 'ma_board_', prefix: true, setup: engine => { T.MA_DEAL(engine, { status: 'accepted', acceptedTerms: { method: 'shareSwap' } }); }, tab: 'ma', native: false, info: ['[data-ma-deal-room]'] },
  { id: 'ma_deadline_', prefix: true, setup: engine => { const g = engine.g; T.MA_DEAL(engine, {}); g.maDealRooms[0].deadlineWeek = g.week + 1; }, tab: 'ma', native: false, info: ['[data-ma-deal-room]'] },
  { id: 'ma_pmi_planning_', prefix: true, setup: engine => { T.MA_SUBSIDIARY(engine, 'planning'); }, tab: 'ma', native: false, info: ['[data-ma-subsidiary=\"sub-t\"]'] },
  { id: 'ma_pmi_stalled_', prefix: true, setup: engine => { T.MA_SUBSIDIARY(engine, 'stalled'); }, tab: 'ma', native: false, info: ['[data-ma-subsidiary=\"sub-t\"]'] },
];
const GUIDE = [
  { id: 'dashboard', tab: 'home', native: true, info: ['section[aria-label="今週の成績"]'] },
  { id: 'first_store', tab: 'map', native: true, ops: ['.u-pin'] },
  { id: 'unit_economics', setup: engine => { T.RICH(engine); T.ADD_STORE(engine, ['最初の店', {}]); }, tab: 'business', native: true, sheet: '[data-ui3-business-sheet]', sheetTitle: '最初の店', ops: SUPPLY_OPS },
  { id: 'first_week', tab: 'home', native: true, ops: ['.u-advance'] },
  { id: 'weekly_recap', tab: 'home', native: true, info: ['section[aria-label="今週の成績"]'] },
  { id: 'first_improvement', setup: engine => { T.RICH(engine); T.ADD_STORE(engine, ['最初の店', {}]); }, tab: 'business', native: true, sheet: '[data-ui3-business-sheet]', ops: ['[data-action="business-invest"]', '[data-action="business-price"]'] },
  { id: 'cash_runway', tab: 'report', native: true, info: ['[data-ui3-report="summary"],[data-ui3-report="none"]'] },
  { id: 'growth_step', tab: 'map', native: true, ops: ['.u-pin'] },
  { id: 'organization', tab: 'office', native: true, ops: ['[data-ui3-dept="open"]'] },
  { id: 'graduation', tab: 'missions', native: true, info: ['[data-ui3-missions="missions"]'] },
];

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
  const problems = [];
  const check = (condition, message) => { if (!condition) problems.push(message); };

  // The four-part check: press the row, then judge the place it led to.
  async function pressRow(page, spec, kind) {
    const selector = spec.prefix ? `[data-ui3-dest^="${spec.id}"]` : `[data-ui3-dest="${kind === 'guide' ? `guide:${spec.id}` : spec.id}"]`;
    const label = `${kind} ${spec.id}${spec.variant ? ` (${spec.variant})` : ''}`;
    if (!await page.locator(selector).count()) { check(false, `${label}: the home has no row for it (${selector})`); return false; }
    await page.locator(selector).first().scrollIntoViewIfNeeded();
    await page.locator(selector).first().click();
    await page.waitForTimeout(500);
    return true;
  }
  async function judge(page, spec, label) {
    const where = await page.evaluate(() => ({ tab: globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.selectedTab, native: document.body.classList.contains('ui3-native') }));
    check(where.tab === spec.tab, `${label}: goes to ${spec.tab}, was ${where.tab}`);
    check(where.native === spec.native, `${label}: ${spec.native ? 'a v3 screen' : 'the current screen opened directly'}, was ${where.native ? 'v3' : 'current'}`);
    if (spec.sheet) {
      check(await page.locator(`#modal-root ${spec.sheet}`).count() > 0, `${label}: opens a sheet (${spec.sheet})`);
      if (spec.sheetTitle) check((await page.locator('#modal-root .u-sheet h1').first().innerText().catch(() => '')) === spec.sheetTitle, `${label}: the sheet is for ${spec.sheetTitle}`);
    }
    if (spec.crisisSheet) check(await page.locator('#modal-root [data-ui3-crisis-sheet]').count() > 0, `${label}: opens the crisis response sheet`);
    for (const selector of spec.ops || []) {
      const result = await page.evaluate(REACHABLE, selector);
      check(result === 'ok', `${label}: the operation ${selector} is ${result}`);
    }
    for (const selector of spec.info || []) {
      const result = await page.evaluate(REACHABLE, selector);
      check(result === 'ok', `${label}: ${selector} is ${result}`);
    }
  }
  const prepare = async (page, spec, guideStep) => {
    await engineEval(page, (engine, patch) => {
      const modules = globalThis.__capitalismTycoonModules;
      const tutorial = modules.foundingTutorial, realBuild = tutorial.__realBuild || tutorial.build;
      tutorial.__realBuild = realBuild;
      // secretary rows: no guide row (so the three slots are the secretary's); guide rows: the step under test is the current one
      tutorial.build = g => {
        const result = realBuild(g);
        if (!patch.step) return { ...result, displayMode: 'summary', current: null };
        const step = tutorial.STEPS.find(item => item.id === patch.step);
        return { ...result, displayMode: 'guide', current: step, total: tutorial.STEPS.length };
      };
    }, { step: guideStep });
  };
  async function runOne(spec, kind) {
    const { context, page, pageErrors } = await newPage();
    await found(page, `${base}?ui=3`);
    await page.evaluate(source => { globalThis.T = (0, eval)(source); }, HELPERS_SOURCE);
    if (spec.setup) await engineEval(page, spec.setup);
    await prepare(page, {}, kind === 'guide' ? spec.id : null);
    await engineEval(page, engine => engine.emit?.());
    await goTo(page, 'map'); await goTo(page, 'home');
    await page.waitForTimeout(300);
    if (await pressRow(page, spec, kind)) await judge(page, spec, `${kind} ${spec.id}${spec.variant ? ` (${spec.variant})` : ''}`);
    check(pageErrors.length === 0, `${kind} ${spec.id}: page errors ${JSON.stringify(pageErrors)}`);
    await context.close();
  }

  try {
    for (const spec of TASKS) await runOne(spec, 'secretary');
    for (const spec of GUIDE) await runOne(spec, 'guide');

    // 3. The store sheet's "在庫と仕入れ" section: what it reads, what it does, what it costs
    {
      const { context, page, pageErrors } = await newPage();
      await found(page, `${base}?ui=3`);
      await page.evaluate(source => { globalThis.T = (0, eval)(source); }, HELPERS_SOURCE);
      const ids = await engineEval(page, engine => { T.RICH(engine); return { ramen: T.ADD_STORE(engine, ['仕入れ検査店', {}]), conveni: T.ADD_STORE(engine, ['コンビニ検査店', { businessID: 'conveni' }]) }; });
      const money = amount => page.evaluate(value => globalThis.__capitalismTycoonModules.engine.compactYen(value), amount);
      const settings = () => engineEval(page, (engine, id) => ({ ...engine.g.supplySettingsByStoreID[id], cash: engine.g.companyCash }), ids.ramen);
      const openStoreSheet = async id => { await goTo(page, 'home'); await goTo(page, 'business'); await page.locator(`[data-ui3-biz="store"][data-id="${id}"]`).first().click(); await page.locator('#modal-root [data-ui3-business-sheet]').waitFor({ state: 'attached', timeout: 10000 }); };
      const waitSheet = () => page.waitForTimeout(250);

      // a store of a business the supply module does not cover has no section
      await openStoreSheet(ids.conveni);
      check(await page.locator('#modal-root [data-ui3-supply-card]').count() === 0, 'a convenience store has no 在庫と仕入れ section');
      await page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').first().click();

      // the state is the secretary's expression: three stores, three states, and the secretary agrees with each
      for (const [patch, expected, secretaryRow] of [[{ inventory: 0 }, '在庫切れの恐れ', 'supply_stockout'], [{ inventory: 500, weeklyDemand: 10 }, '在庫過多', 'supply_overstock'], [{ inventory: 50, weeklyDemand: 10 }, '適正', null]]) {
        await engineEval(page, (engine, [id, values]) => { Object.assign(engine.g.stores.find(item => item.id === id), values); engine.emit?.(); }, [ids.ramen, patch]);
        await openStoreSheet(ids.ramen);
        check(await page.locator('#modal-root [data-ui3-supply-card] .u-stat b').first().innerText() === expected, `the section says ${expected} for ${JSON.stringify(patch)}`);
        const tasks = await engineEval(page, engine => globalThis.__capitalismTycoonModules.executiveSecretary.generateTasks(engine.g, { engine, companyValue: engine.companyValue() }).map(row => row.id).filter(id => id.startsWith('supply_') && id !== 'supply_x'));
        check(secretaryRow ? tasks.includes(secretaryRow) : !tasks.some(id => id === 'supply_stockout' || id === 'supply_overstock'), `the secretary agrees (${expected}): ${JSON.stringify(tasks)}`);
        await page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').first().click();
      }

      await openStoreSheet(ids.ramen);
      // policy, safety stock: the existing actions, with the current screen's data-id and values
      await page.locator('#modal-root [data-action="supply-policy"][value="lean"]').click(); await waitSheet();
      check((await settings()).autoPolicy === 'lean', 'the policy button sets autoPolicy');
      check(await page.locator('#modal-root [data-action="supply-policy"][value="lean"]').getAttribute('aria-pressed') === 'true', 'the sheet shows the new policy');
      await page.locator('#modal-root [data-action="supply-safety"][value="3"]').click(); await waitSheet();
      check((await settings()).safetyStockWeeks === 3, 'the safety-stock chip sets safetyStockWeeks');
      check(await page.locator('#modal-root [data-action="supply-safety"]').count() === 7, 'safety stock: 0 to 6 weeks');
      const emergencyBefore = (await settings()).emergencyProcurementEnabled;
      await page.locator('#modal-root [data-ui3-supply="emergency"]').click(); await waitSheet();
      check((await settings()).emergencyProcurementEnabled === !emergencyBefore, 'the emergency row toggles emergencyProcurementEnabled');
      await page.locator('#modal-root [data-ui3-supply="emergency"]').click(); await waitSheet();
      check((await settings()).emergencyProcurementEnabled === emergencyBefore, 'and back');

      // a supplier change costs the new contract fee, and the current contract's termination fee: confirmation first, exact amounts
      const supplierFacts = () => page.locator('#modal-root [data-ui3-confirm-facts] .u-stat').evaluateAll(nodes => nodes.map(node => [node.querySelector('span').innerText, node.querySelector('b').innerText]));
      const choose = async supplierID => { await page.locator('#modal-root [data-ui3-supply="suppliers"]').click(); await page.locator(`#modal-root [data-ui3-supply="supplier"][data-supplier="${supplierID}"]`).click(); await page.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible', timeout: 10000 }); };
      const supply = await engineEval(page, () => { const s = globalThis.__capitalismTycoonModules.supply; return { suppliers: s.SUPPLIERS.map(item => ({ id: item.id, fee: item.contractFee })) }; });
      const fee = id => supply.suppliers.find(item => item.id === id).fee;
      const current0 = await engineEval(page, (engine, id) => { const c = (engine.g.supplierContracts || []).find(item => item.storeID === id && item.active && item.status === 'active'); return c ? { supplierID: c.supplierID, termination: c.terminationFee } : null; }, ids.ramen);
      const first = current0?.supplierID === 'quality_farm' ? 'low_cost' : 'quality_farm';
      await choose(first);
      let facts = await supplierFacts();
      const expectFirst = [['契約料', await money(fee(first))], ...(current0 ? [['いまの契約の解約金', await money(current0.termination)]] : []), ['実行後の会社現金', await money((await settings()).cash - fee(first) - (current0?.termination || 0))]];
      check(JSON.stringify(facts) === JSON.stringify(expectFirst), `the confirmation shows the exact fees: ${JSON.stringify(facts)} vs ${JSON.stringify(expectFirst)}`);
      const before = await settings();
      await page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').first().click();
      const afterCancel = await settings();
      check(afterCancel.cash === before.cash && afterCancel.preferredSupplierID === before.preferredSupplierID, 'cancelling changes nothing');
      await openStoreSheet(ids.ramen);
      await choose(first);
      await page.locator('#modal-root [data-ui3-confirm]').click(); await page.waitForTimeout(400);
      const afterFirst = await settings();
      check(afterFirst.preferredSupplierID === first, 'confirming changes the supplier');
      check(before.cash - afterFirst.cash === fee(first) + (current0?.termination || 0), `the company paid exactly the shown fees (${before.cash - afterFirst.cash})`);
      check((await page.locator('#modal-root [data-ui3-supply-card] .u-stat b').nth(1).innerText()).length > 0 && await page.locator('#modal-root [data-ui3-supply-card]').count() === 1, 'the store sheet is shown again after the change');
      // now a contract exists: the next change also pays its termination fee
      const current1 = await engineEval(page, (engine, id) => { const c = engine.g.supplierContracts.find(item => item.storeID === id && item.active && item.status === 'active'); return { supplierID: c.supplierID, termination: c.terminationFee }; }, ids.ramen);
      const second = first === 'low_cost' ? 'quick_local' : 'low_cost';
      await choose(second);
      facts = await supplierFacts();
      check(JSON.stringify(facts.map(item => item[0])) === JSON.stringify(['契約料', 'いまの契約の解約金', '実行後の会社現金']) && facts[1][1] === await money(current1.termination), `a second change shows the termination fee: ${JSON.stringify(facts)}`);
      // not enough cash: said on the sheet, nothing changes
      await engineEval(page, engine => { engine.g.companyCash = 1000; engine.emit?.(); });
      await page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').first().click();
      await openStoreSheet(ids.ramen);
      await choose(first === 'low_cost' ? 'balanced_wholesale' : 'low_cost');
      check(await page.locator('#modal-root [data-ui3-confirm-note]').count() === 1, 'not enough cash is said on the confirmation');
      check(pageErrors.length === 0, `supply section: page errors ${JSON.stringify(pageErrors)}`);
      await context.close();
    }

    // M&A tasks: a real deal room / subsidiary opened through the engine, then the row for each task type
    // (the deal-room and integration operations live in the current screen only, so the row opens it directly)
    console.log(`ui3-destinations: ${TASKS.length} secretary tasks and ${GUIDE.length} guide steps checked`);
    assert.deepEqual(problems, [], `destinations that do not lead to the operation:\n  ${problems.join('\n  ')}`);
    console.log(`ui3-destinations-webkit-test: PASS (${browserName})`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(error => { console.error(error); process.exit(1); });
