'use strict';

// Saves written before #796-#798 carry company-cash movements with no ledger row. The gap never
// closes, so finance.validate() fails for the rest of the game and every action gated on it
// refuses to run. Loading such a save reconciles it once as a prior-period correction; a gap that
// appears after that is still reported.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

// The harness runs the game in its own VM context; compare its objects as plain JSON.
const plain = value => JSON.parse(JSON.stringify(value));
const SAVE_KEY = 'capitalism_tycoon_web_v1';
const MEDIA = 1_200_000, COMPLAINT = 1_500_000;

function lcg(seedValue) {
  let seed = seedValue >>> 0;
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; };
}

// A save with the same shape as one written by the pre-#796 engine: three player actions move
// company cash while finance.event is unavailable (the old code never called it), then the game
// plays on for six weeks. Returns the raw payload with no ledgerCoverageVersion.
function legacySave({ spendThisWeek = false } = {}) {
  const loaded = loadGame({ headless: true, random: lcg(0x80280001) });
  const { modules } = loaded;
  const engine = new loaded.engineModule.TycoonEngine();
  engine.configure({ playerName: 'Old', companyName: 'Old Save Co', difficulty: 'normal', scenario: 'free' });
  modules.simulationRng.reseed(engine.g, 0x802);
  const contribution = 2_000_000_000 - engine.g.companyCash;
  engine.g.personalCash += contribution;
  assert.equal(engine.contributeFounderCapital(contribution), true);
  engine.g.hasHeadOffice = true;
  engine.g.officeCapacity = 32;
  const office = engine.g.rentalOffices.find(o => !o.contracted && o.id !== engine.g.contractedOfficeID);
  const realEvent = modules.finance.event;
  const cashBefore = engine.g.companyCash, rowsBefore = engine.g.finance.transactions.length;
  modules.finance.event = () => null;
  try {
    assert.equal(engine.startMediaAction('social'), true);
    assert.equal(engine.contractBranchOffice(office.id), true);
    engine.ensureCompletionDefaults();
    engine.g.employeeComplaintLog.push({ id: 'c1', status: 'open', week: engine.g.week, text: '残業が多い' });
    assert.equal(engine.resolveEmployeeComplaint('c1', 'invest'), true);
  } finally {
    modules.finance.event = realEvent;
  }
  const unrecorded = cashBefore - engine.g.companyCash;
  assert.equal(unrecorded, MEDIA + office.deposit + COMPLAINT, 'precondition: the three actions moved company cash');
  assert.equal(engine.g.finance.transactions.length, rowsBefore, 'precondition: and wrote no ledger rows');
  for (let week = 0; week < 6; week++) assert.notEqual(engine.advanceWeek(false), false);
  if (spendThisWeek) {
    // Also spend in the saved week itself, after its last ledger row.
    modules.finance.event = () => null;
    try { assert.equal(engine.startMediaAction('social'), true); } finally { modules.finance.event = realEvent; }
  }
  delete engine.g.finance.ledgerCoverageVersion;
  return { payload: JSON.stringify(engine.g), deposit: office.deposit, unrecorded, modules };
}

function load(payload, seed = 1) {
  const loaded = loadGame({ headless: true, random: lcg(seed) });
  loaded.ctx.__localStorageData.set(SAVE_KEY, payload);
  const engine = loaded.engineModule.TycoonEngine.load();
  assert.equal(engine._saveBlockedDueToLoadFailure, undefined, 'the save loads');
  return { engine, modules: loaded.modules, loaded };
}

const legacy = legacySave();
const expenses = MEDIA + COMPLAINT;

// 1. The legacy save fails validation, and the gap does not close as the game plays on.
{
  const raw = JSON.parse(legacy.payload);
  const errors = legacy.modules.finance.validate(raw).errors;
  assert.ok(errors.some(e => e.startsWith('資産=負債+純資産が不一致 差額-' + expenses)), `balance-sheet gap: ${errors.join(' / ')}`);
  assert.ok(errors.some(e => e.startsWith('finance.openingCashロールフォワードとcompanyCashが不一致 差額' + legacy.unrecorded)), `cash roll-forward gap: ${errors.join(' / ')}`);
}

// 2. Loading reconciles it once: validation passes, the amounts are recorded, and nothing is
//    booked in the current period.
const saved = JSON.parse(legacy.payload);
const first = load(legacy.payload);
{
  const f = first.engine.g.finance;
  const validation = first.modules.finance.validate(first.engine.g);
  assert.equal(validation.ok, true, `finance.validate after load: ${validation.errors.join(' / ')}`);
  assert.equal(f.ledgerCoverageVersion, first.modules.finance.LEDGER_COVERAGE_VERSION);
  assert.deepEqual(plain(f.legacyLedgerReconciliation), {
    reconciledWeek: saved.week,
    cashGap: -legacy.unrecorded,
    equityAdjustment: -expenses,
    snapshotAdjustments: [{ week: 2, withinWeek: false, amount: -legacy.unrecorded }]
  });
  assert.equal(f.openingCash, saved.finance.openingCash - legacy.unrecorded, 'the unrecorded cash is restated in the opening balance');
  assert.equal(f.balances.priorPeriodAdjustments, -expenses, 'the unrecorded expenses are a prior-period adjustment');
  assert.equal(f.transactions.length, saved.finance.transactions.length, 'no transaction is booked in the current period');
  assert.equal(first.engine.g.companyCash, saved.companyCash, 'company cash is unchanged');
  const week = first.modules.finance.buildStatements(first.engine.g, 'week');
  const weekRows = f.transactions.filter(t => t.week === saved.week);
  assert.equal(week.cashFlow.netCashChange, weekRows.reduce((sum, t) => sum + t.cashEffect, 0), 'this week\'s cash flow is only this week\'s ledger rows');
  const savedWeek = legacy.modules.finance.buildStatements(structuredClone(saved), 'week');
  assert.equal(week.profitAndLoss.netIncome, savedWeek.profitAndLoss.netIncome, 'this week\'s profit is what the save had before reconciliation');
  assert.equal(week.cashFlow.netCashChange, savedWeek.cashFlow.netCashChange, 'this week\'s cash flow is what the save had before reconciliation');
  const equity = week.balanceSheet.equity.totalEquity, assets = week.balanceSheet.assets.totalAssets, liabilities = week.balanceSheet.liabilities.totalLiabilities;
  assert.equal(equity, assets - liabilities);
}

// 3. An action gated on finance.validate works on the reconciled save.
{
  const { engine, modules } = first;
  engine.g.productVentures.push({ id: 'product-loss', name: '赤字プロダクト', valuation: 4_000_000, profit: -200_000, investedCost: 5_000_000 });
  const delta = -1_000_000 - engine.g.companyCash;
  engine.g.companyCash = -1_000_000;
  modules.finance.event(engine.g, 'otherOperating', Math.abs(delta), { cashEffect: delta, profitEffect: delta, sourceType: 'crisisTestLoss', sourceID: 'legacy-crisis', operationID: 'legacy-crisis' });
  engine.g.playerCrisis.lastEvaluationWeek = 0;
  modules.playerCrisis.evaluate(engine.g);
  assert.equal(engine.g.playerCrisis.status, 'distressed', 'precondition: the company is in crisis');
  assert.equal(engine.executeCrisisDisposition('product', 'product-loss'), true, 'the restructuring sale runs on the reconciled save');
  assert.equal(modules.finance.validate(engine.g).ok, true);
}

// 4. It runs once. A gap that appears after reconciliation is still reported, also after a reload.
{
  const second = load(legacy.payload, 2);
  const { engine, modules } = second;
  const record = plain(engine.g.finance.legacyLedgerReconciliation);
  for (let week = 0; week < 2; week++) assert.notEqual(engine.advanceWeek(false), false);
  assert.equal(modules.finance.validate(engine.g).ok, true, 'the reconciled save stays valid as it plays on');
  engine.g.companyCash -= 700_000; // a new movement with no ledger row
  const after = modules.finance.validate(engine.g);
  assert.equal(after.ok, false, 'a new gap is reported');
  assert.equal(engine.save(), true);
  const reloaded = load(second.loaded.ctx.__localStorageData.get(SAVE_KEY), 3);
  assert.deepEqual(plain(reloaded.engine.g.finance.legacyLedgerReconciliation), record, 'the reconciliation is not repeated');
  const again = reloaded.modules.finance.validate(reloaded.engine.g);
  assert.equal(again.ok, false, 'the new gap is still reported after a reload');
  assert.ok(again.errors.some(e => e.includes('差額700000') || e.includes('差額-700000')), again.errors.join(' / '));
}

// 5. A new game starts at the current ledger coverage and is never reconciled.
{
  const loaded = loadGame({ headless: true, random: lcg(4) });
  const engine = new loaded.engineModule.TycoonEngine();
  engine.configure({ playerName: 'New', companyName: 'New Co', difficulty: 'normal', scenario: 'free' });
  assert.equal(engine.g.finance.ledgerCoverageVersion, loaded.modules.finance.LEDGER_COVERAGE_VERSION);
  assert.equal(engine.g.finance.legacyLedgerReconciliation, undefined);
  engine.g.companyCash -= 500_000;
  engine.normalize();
  assert.equal(engine.g.finance.legacyLedgerReconciliation, undefined, 'normalize does not absorb a gap in a current save');
  assert.equal(loaded.modules.finance.validate(engine.g).ok, false);
}

// 6. Cash that left without a ledger row in the saved week itself is restated too.
{
  const within = legacySave({ spendThisWeek: true });
  const raw = JSON.parse(within.payload);
  const { engine, modules } = load(within.payload, 5);
  const validation = modules.finance.validate(engine.g);
  assert.equal(validation.ok, true, `finance.validate after load: ${validation.errors.join(' / ')}`);
  assert.deepEqual(plain(engine.g.finance.legacyLedgerReconciliation), {
    reconciledWeek: raw.week,
    cashGap: -(within.unrecorded + MEDIA),
    equityAdjustment: -(expenses + MEDIA),
    snapshotAdjustments: [{ week: 2, withinWeek: false, amount: -within.unrecorded }, { week: raw.week, withinWeek: true, amount: -MEDIA }]
  });
  assert.equal(engine.g.companyCash, raw.companyCash, 'company cash is unchanged');
}

console.log('legacy ledger reconciliation tests passed');
