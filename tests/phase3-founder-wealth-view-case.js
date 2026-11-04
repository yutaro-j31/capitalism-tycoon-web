'use strict';
// P3-11 §13 read-only breakdown view. Required by phase3-founder-wealth-test.js.
// describeFounderWealth only relabels the projection: unvalued components stay null (never zero), liabilities are
// marked as such, the subtotal is the projection's knownNetWorth and a complete total only appears when complete.
// The app card computes on tap only and never feeds personalNetWorth, credit, progression or the ending.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { loadGame } = require('./harness');
const plain = x => JSON.parse(JSON.stringify(x));

function run() {
  let draws = 0;
  const loaded = loadGame({ headless: true, random: () => { draws++; return .37; } });
  const fw = loaded.modules.phase3FounderWealth, e = new loaded.engineModule.TycoonEngine();
  e.configure({ playerName: 'T', companyName: 'Co', difficulty: 'normal', scenario: 'free', simulationSeed: 5 });
  const live = JSON.stringify(e.g), worth = e.personalNetWorth(), n = draws;
  const state = plain(e.g), ev = fw.captureFounderWealthEvidence(state);
  const result = fw.projectFounderWealth(state, ev.ownershipSnapshot, ev.valuationEvidence, ev.liabilityEvidence);
  const view = fw.describeFounderWealth(result);
  assert.equal(view.authority, 'read-only'); assert.ok(Object.isFrozen(view) && Object.isFrozen(view.rows));
  assert.equal(view.rows.length, result.components.length);
  assert.equal(view.knownNetWorth, result.knownNetWorth); assert.equal(view.complete, result.complete);
  assert.equal(view.totalNetWorth, result.complete ? result.totalNetWorth : null);
  assert.equal(view.unvaluedCount, result.unvaluedComponents.length); assert.equal(view.inputRejected, false);
  for (const row of view.rows) {
    const c = result.components.find(x => x.componentId === row.componentId);
    assert.equal(row.side, c.side); assert.equal(row.amountJPY, c.amountJPY);
    assert.equal(row.status, c.amountJPY === null ? 'unvalued' : 'known');
    assert.ok(row.label && !/^asset:|^liability:/.test(row.label), `labelled ${row.componentId}`);
  }
  const cash = view.rows.find(r => r.componentId === 'asset:personal-cash');
  assert.equal(cash.label, '個人現金'); assert.equal(cash.amountJPY, e.g.personalCash); assert.equal(cash.basis, '現金残高');
  const own = view.rows.find(r => r.componentId === 'asset:own-company');
  assert.equal(own.status, 'unvalued'); assert.equal(own.amountJPY, null, 'no evidence-backed equity value -> unvalued, not zero');
  assert.ok(view.rows.some(r => r.side === 'liability' && r.label === '個人借入'));
  // Unknown component IDs keep a generic label; prefix families keep their detail.
  const synthetic = fw.describeFounderWealth({ complete: false, knownNetWorth: -5, components: [
    { componentId: 'asset:listed:X', side: 'asset', amountJPY: 10, valuationBasis: 'marketPrice' },
    { componentId: 'liability:new-kind', side: 'liability', amountJPY: 15, valuationBasis: 'mystery' },
    { componentId: 'asset:zzz', side: 'asset', amountJPY: null, valuationBasis: null }] });
  assert.deepEqual(plain(synthetic.rows.map(r => [r.label, r.detail, r.basis, r.status])),
    [['上場株', 'X', '時価', 'known'], ['その他の負債', '', 'mystery', 'known'], ['その他の資産', '', null, 'unvalued']]);
  assert.equal(synthetic.knownNetWorth, -5, 'negative subtotal shown honestly'); assert.equal(synthetic.totalNetWorth, null);
  // A rejected input yields no rows and is reported as such.
  const rejected = fw.describeFounderWealth(fw.projectFounderWealth(null, null, null, null));
  assert.equal(rejected.inputRejected, true); assert.equal(rejected.knownNetWorth, null);
  assert.equal(fw.describeFounderWealth(undefined).inputRejected, true);
  // Purity: live state, installed net worth and RNG untouched.
  assert.equal(JSON.stringify(e.g), live); assert.equal(e.personalNetWorth(), worth); assert.equal(draws, n);

  // App wiring: computed only through the tap action; render never captures; consumers untouched.
  const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  const render = app.slice(app.indexOf('function renderFounderWealthBreakdown('), app.indexOf('\n', app.indexOf('function renderFounderWealthBreakdown(') + 1200));
  assert.match(app, /case 'founder-wealth-capture':ui\.founderWealth=captureFounderWealthBreakdown\(\);render\(\);break;/);
  assert.doesNotMatch(render, /captureFounderWealth(Evidence|Breakdown)\(/, 'render never computes');
  assert.match(app, /既存の個人純資産・借入枠・実績の計算には使いません/);
  assert.match(app, /算定済み項目の合計/); assert.match(app, /未評価・未照合/);
  assert.equal((app.match(/phase3FounderWealth/g) || []).length, 1, 'one call site, inside the tap capture');
  const engineSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'engine.js'), 'utf8');
  assert.doesNotMatch(engineSrc, /phase3FounderWealth|describeFounderWealth/, 'engine consumers unchanged');
}
module.exports = { run };
