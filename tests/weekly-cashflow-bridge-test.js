'use strict';

// An external audit observed a week reporting 売上121.5万 / 利益48.7万 while 会社現金 fell by
// 110.7万, with nothing on the weekly screen explaining the gap. That behaviour is correct --
// inventory purchases, deposits and debt service move cash without being that week's expense --
// but the weekly modal showed 利益 and 会社現金 side by side with no bridge between them, so it
// read as a contradiction. (The 決算 tab already had a full cash flow statement; the weekly
// modal, which is the screen shown on every week advance, did not.)
//
// The fix adds a profit-to-cash bridge built entirely from finance.js's existing statement --
// no new modelling. This test pins the two identities the bridge depends on, because if either
// stops holding the displayed column silently stops adding up:
//
//   (1) netIncome + depreciation + workingCapitalCashFlowImpact  = operatingCashFlow
//   (2) openingCash + operatingCF + investingCF + financingCF    = endingCash = companyCash
//
// Identity (1) is additionally guarded in the UI by an その他 residual row, so a future category
// that breaks it degrades into a visible line rather than a column that does not tie.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./harness');

function lcg(seed = 260819906) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 260819906) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  return { modules, engine };
}

function openRamenStore(engine) {
  const tenant = engine.g.tenants.find(t => !t.occupiedBy);
  assert.ok(tenant, '前提: 空きテナントが存在する');
  assert.equal(engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: '検証店', operatingHours: 3 }), true);
  return engine.g.stores.at(-1);
}

const bridge = (modules, engine) => {
  const s = modules.finance.buildStatements(engine.g, 'week');
  return { cf: s.cashFlow, pl: s.profitAndLoss };
};

// 0. The bridge itself lives in finance.js (not app.js) precisely so its arithmetic is
// testable: app.js is one closed IIFE with no exports, so a bridge built there could only be
// checked by source patterns, which cannot catch a row rendering the wrong number. These
// assertions pin the returned values against the statement they are derived from.
{
  const { modules, engine } = newGame();
  openRamenStore(engine);
  for (let w = 0; w < 6; w++) engine.advanceWeek(false);

  const b = modules.finance.cashBridge(engine.g, 'week');
  const { cf, pl } = bridge(modules, engine);

  assert.equal(b.netIncome, pl.netIncome, '当期利益はP/Lの当期利益と一致する');
  assert.equal(b.depreciation, cf.depreciation, '減価償却はCFの減価償却と一致する');
  assert.equal(b.workingCapital, cf.workingCapitalCashFlowImpact, '運転資本はCFの運転資本影響と一致する');
  assert.equal(b.operating, cf.operatingCashFlow, '営業CFが一致する');
  assert.equal(b.investing, cf.investingCashFlow, '投資CFが一致する');
  assert.equal(b.financing, cf.financingCashFlow, '財務CFが一致する');
  assert.equal(b.netCashChange, cf.netCashChange, '現金増減が一致する');
  assert.equal(b.endingCash, cf.endingCash, '期末現金が一致する');

  assert.ok(Math.abs((b.netIncome + b.depreciation + b.workingCapital + b.other) - b.operating) < 1, '内訳の合計が営業CFになる');
  assert.ok(Math.abs((b.operating + b.investing + b.financing) - b.netCashChange) < 1, '3区分の合計が現金増減になる');
  assert.ok(Math.abs((b.openingCash + b.netCashChange) - b.endingCash) < 1, '期首＋増減＝期末');
  assert.ok(Math.abs(b.endingCash - engine.g.companyCash) < 1, '期末現金が実際のcompanyCashと一致する');
}

// 1. The reported symptom reproduces: a profitable week whose cash still falls, and the bridge
// names the reason rather than leaving it unexplained.
{
  const { modules, engine } = newGame();
  openRamenStore(engine);
  let found = null;
  for (let w = 0; w < 12 && !found; w++) {
    const cashBefore = engine.g.companyCash;
    assert.notEqual(engine.advanceWeek(false), false);
    const { cf, pl } = bridge(modules, engine);
    if (pl.netIncome > 0 && engine.g.companyCash < cashBefore) found = { cf, pl };
  }
  assert.ok(found, '前提: 黒字なのに現金が減る週が発生する（監査が報告した状況）');
  assert.ok(found.cf.operatingCashFlow < 0, '営業CFがマイナスであることが現金減少の説明になっている');
  assert.ok(found.cf.workingCapitalCashFlowImpact < 0, '運転資本の増加が現金を圧迫している');
  assert.ok(
    Math.abs(found.cf.workingCapitalCashFlowImpact) > found.pl.netIncome,
    `運転資本の影響が利益を上回るからこそ黒字でも現金が減る: wc=${found.cf.workingCapitalCashFlowImpact} netIncome=${found.pl.netIncome}`
  );
}

// 2. Identity (1): the profit-to-operatingCF portion of the bridge ties exactly, so the
// その他 residual row stays absent on the ordinary path.
// 3. Identity (2): the cash waterfall ties exactly and lands on the real companyCash.
{
  const { modules, engine } = newGame();
  openRamenStore(engine);
  let maxProfitResidual = 0, maxWaterfallResidual = 0, maxCashResidual = 0;
  for (let w = 0; w < 52; w++) {
    assert.notEqual(engine.advanceWeek(false), false);
    const { cf, pl } = bridge(modules, engine);
    maxProfitResidual = Math.max(maxProfitResidual, Math.abs(pl.netIncome + cf.depreciation + cf.workingCapitalCashFlowImpact - cf.operatingCashFlow));
    maxWaterfallResidual = Math.max(maxWaterfallResidual, Math.abs(cf.openingCash + cf.operatingCashFlow + cf.investingCashFlow + cf.financingCashFlow - cf.endingCash));
    maxCashResidual = Math.max(maxCashResidual, Math.abs(cf.endingCash - engine.g.companyCash));
  }
  assert.ok(maxProfitResidual < 1, `利益→営業CFの内訳が52週すべてで一致する (最大残差 ${maxProfitResidual})`);
  assert.ok(maxWaterfallResidual < 1, `現金ウォーターフォールが52週すべてで一致する (最大残差 ${maxWaterfallResidual})`);
  assert.ok(maxCashResidual < 1, `期末現金が実際のcompanyCashと一致する (最大残差 ${maxCashResidual})`);
}

// 4. The identities must also hold once financing activity is present -- borrowing is exactly
// the case where cash moves with no effect on profit at all.
{
  const { modules, engine } = newGame();
  openRamenStore(engine);
  for (let w = 0; w < 6; w++) engine.advanceWeek(false);

  const residualOf = () => {
    const { cf, pl } = bridge(modules, engine);
    return {
      cf,
      worst: Math.max(
        Math.abs(pl.netIncome + cf.depreciation + cf.workingCapitalCashFlowImpact - cf.operatingCashFlow),
        Math.abs(cf.openingCash + cf.operatingCashFlow + cf.investingCashFlow + cf.financingCashFlow - cf.endingCash)
      )
    };
  };

  // Borrowing moves cash with zero effect on profit -- the case the bridge exists to explain.
  // These loans repay manually (repaymentMethod:'manual'), so the financing activity lands on
  // the week the action is taken rather than trickling out weekly.
  const before = engine.g.companyCash;
  assert.equal(engine.borrow(3_000_000, 'company'), true, '前提: 会社の借入が成立する');
  assert.ok(engine.g.companyCash > before, '借入で現金が増える');
  const borrowed = residualOf();
  assert.ok(borrowed.cf.financingCashFlow > 0, '借入週に財務CFがプラスで立つ');
  assert.ok(borrowed.worst < 1, `借入週でも恒等式が保たれる (残差 ${borrowed.worst})`);

  assert.ok(engine.repay(1_000_000, 'company'), '前提: 一部返済ができる');
  const repaid = residualOf();
  assert.ok(repaid.worst < 1, `返済後も恒等式が保たれる (残差 ${repaid.worst})`);

  let maxResidual = 0;
  for (let w = 0; w < 20; w++) {
    assert.notEqual(engine.advanceWeek(false), false);
    maxResidual = Math.max(maxResidual, residualOf().worst);
  }
  assert.ok(maxResidual < 1, `借入を抱えたまま週を進めても恒等式が保たれる (最大残差 ${maxResidual})`);
  assert.equal(modules.finance.validate(engine.g).ok, true, '会計整合性が保たれている');
}

// 5. The weekly modal actually renders the bridge from those exact fields. app.js is a single
// IIFE with no module export, so wiring is verified at the source level (the same approach
// tests/store-multiple-menu-test.js already uses for app.js), while the arithmetic above is
// verified behaviourally against the real engine.
{
  const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  assert.match(app, /function weeklyCashBridge\(\)/, '週次ブリッジの生成関数が存在する');
  assert.match(app, /\$\{weeklyCashBridge\(\)\}/, '週間レポートのモーダルからブリッジが描画される');
  assert.match(app, /financeModule\.cashBridge\(engine\.g,'week'\)/, 'ブリッジの数値はfinance.jsのcashBridgeから取得する');
  // Each row must render its own field. Asserting the field names alone would not catch a row
  // wired to a constant, so this pins the label-to-field pairing.
  for (const [label, field] of [['当期利益', 'b.netIncome'], ['減価償却など非現金費用', 'b.depreciation'], ['運転資本の増減（在庫・売掛・買掛）', 'b.workingCapital'], ['営業キャッシュフロー', 'b.operating'], ['投資（設備・保証金など）', 'b.investing'], ['財務（借入・返済・配当）', 'b.financing'], ['今週の現金増減', 'b.netCashChange']]) {
    assert.ok(app.includes(`['${label}',${field}`), `「${label}」の行は ${field} を描画する`);
  }
  for (const field of ['b.openingCash', 'b.endingCash', 'b.other']) {
    assert.ok(app.includes(field), `ブリッジは ${field} を描画する`);
  }
  assert.match(app, /その他/, '説明できない差額はその他として明示される');
  assert.match(app, /利益と現金の差/, '見出しが利益と現金の差を説明する');
  assert.ok(!app.includes('new MutationObserver'), 'production起動経路にMutationObserverを増やさない');
}

// 6. Determinism: building the bridge consumes no RNG and changes no economic state.
//
// buildStatements() does write one field -- finance.lastStatements, its memoised result -- so
// this asserts the economically meaningful invariants individually rather than whole-state
// equality. That write is not introduced here: renderReport() already calls buildStatements()
// on every render, so the weekly modal adds no new category of side effect, only one more call.
{
  const { modules, engine } = newGame();
  openRamenStore(engine);
  for (let w = 0; w < 6; w++) engine.advanceWeek(false);

  const snapshot = JSON.parse(JSON.stringify(engine.g));
  let calls = 0;
  const originalRandom = Math.random;
  Math.random = () => { calls++; return originalRandom(); };
  try {
    bridge(modules, engine);
  } finally {
    Math.random = originalRandom;
  }
  assert.equal(calls, 0, 'ブリッジの算出はMath.randomを消費しない');

  for (const key of ['companyCash', 'personalCash', 'companyDebt', 'personalDebt', 'week', 'companyCredit']) {
    assert.equal(engine.g[key], snapshot[key], `${key} は変化しない`);
  }
  assert.equal(JSON.stringify(engine.g.stores), JSON.stringify(snapshot.stores), '店舗は変化しない');
  assert.equal(JSON.stringify(engine.g.finance.transactions), JSON.stringify(snapshot.finance.transactions), '会計台帳は変化しない');
  assert.equal(engine.g.saveVersion, 9);

  const changed = Object.keys(engine.g).filter(k => JSON.stringify(engine.g[k]) !== JSON.stringify(snapshot[k]));
  assert.deepEqual([...changed], ['finance'], `変化するのはfinanceのキャッシュのみ: ${changed.join(',')}`);
  const financeChanged = Object.keys(engine.g.finance).filter(k => JSON.stringify(engine.g.finance[k]) !== JSON.stringify(snapshot.finance[k]));
  assert.deepEqual([...financeChanged], ['lastStatements'], `finance側の変化はlastStatementsのみ: ${financeChanged.join(',')}`);
}

console.log('weekly cash flow bridge tests passed');
