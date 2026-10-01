'use strict';

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const ALLOCATION = 50_000_000;
const STARTING_CASH = 500_000_000;
const TARGET_ID = 'allocation-target';
const OPERATION_ID = 'group-capital-allocation-12';

function fixture(kind = 'ma') {
  const { ctx, engineModule } = loadGame();
  const engine = ctx.__ct_engine;
  const finance = ctx.__capitalismTycoonModules.finance;

  engine.g.week = 12;
  engine.g.companyCash = STARTING_CASH;
  engine.g.personalCash = 7_000_000;
  engine.g.companyDebt = 0;

  if (kind === 'ma') {
    engine.g.maSubsidiaries = [{
      id: TARGET_ID,
      name: '配分先M&A子会社',
      status: 'active',
      identifiableNetAssetsBookValue: 100_000_000,
      goodwillBookValue: 20_000_000,
      totalCarryingValue: 120_000_000,
      investmentBookValue: 0,
      capitalReceived: 0,
      valuation: 300_000_000
    }];
    engine.g.subsidiaries = [];
  } else {
    engine.g.maSubsidiaries = [];
    engine.g.subsidiaries = [{
      id: TARGET_ID,
      name: '配分先通常子会社',
      status: 'active',
      ownership: 1,
      valuation: 300_000_000,
      investedCost: 100_000_000,
      carryingBookValue: 100_000_000,
      investmentBookValue: 0,
      capitalReceived: 0
    }];
  }

  engine.g.groupCapitalAllocation = {
    lastPlanWeek: 12,
    lastExecutionWeek: null,
    rows: [{ id: TARGET_ID, allocation: ALLOCATION }],
    history: [],
    executions: []
  };

  engine.g.finance = finance.defaultFinanceState(engine.g);
  engine.g.finance.ledgerCoverageVersion = finance.LEDGER_COVERAGE_VERSION;
  return { ctx, engine, engineModule, finance, kind };
}

function target(engine) {
  return [...(engine.g.maSubsidiaries || []), ...(engine.g.subsidiaries || [])].find(row => row.id === TARGET_ID);
}

function snapshot(engine) {
  const sub = target(engine);
  return {
    companyCash: engine.g.companyCash,
    investmentBookValue: sub?.investmentBookValue,
    identifiableNetAssetsBookValue: sub?.identifiableNetAssetsBookValue,
    totalCarryingValue: sub?.totalCarryingValue,
    carryingBookValue: sub?.carryingBookValue,
    capitalReceived: sub?.capitalReceived,
    lastCapitalAllocationWeek: sub?.lastCapitalAllocationWeek,
    lastExecutionWeek: engine.g.groupCapitalAllocation.lastExecutionWeek,
    executions: JSON.stringify(engine.g.groupCapitalAllocation.executions),
    finance: JSON.stringify(engine.g.finance)
  };
}

// M&A subsidiary: cash becomes additional authoritative identifiable investment basis.
{
  const { engine, finance } = fixture('ma');
  const beforeStatements = finance.buildStatements(engine.g, '52');
  const beforeProfit = beforeStatements.profitAndLoss.netIncome;
  const beforeInvestment = beforeStatements.balanceSheet.assets.subsidiariesAndAffiliates;
  const beforeRows = engine.g.finance.transactions.length;

  assert.equal(engine.executeGroupCapitalAllocation(), true);

  const sub = target(engine);
  const statements = finance.buildStatements(engine.g, '52');
  const validation = finance.validate(engine.g);
  const rows = engine.g.finance.transactions.filter(row => row.operationID === OPERATION_ID);

  assert.equal(engine.g.companyCash, STARTING_CASH - ALLOCATION);
  assert.equal(sub.investmentBookValue, ALLOCATION);
  assert.equal(sub.capitalReceived, ALLOCATION);
  assert.equal(sub.identifiableNetAssetsBookValue, 150_000_000);
  assert.equal(sub.totalCarryingValue, 170_000_000);
  assert.equal(engine.g.finance.transactions.length, beforeRows + 1);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].category, 'investmentPurchase');
  assert.equal(rows[0].cashEffect, -ALLOCATION);
  assert.equal(rows[0].assetEffect, ALLOCATION);
  assert.equal(rows[0].profitEffect, 0);
  assert.equal(statements.profitAndLoss.netIncome, beforeProfit);
  assert.equal(statements.balanceSheet.assets.subsidiariesAndAffiliates - beforeInvestment, ALLOCATION);
  assert.equal(statements.balanceSheet.assets.cashAndDeposits, engine.g.companyCash);
  assert.equal(statements.balanceSheet.balanceDifference, 0);
  assert.equal(validation.ok, true, validation.errors.join('\n'));

  const once = snapshot(engine);
  assert.equal(engine.executeGroupCapitalAllocation(), false);
  assert.deepEqual(snapshot(engine), once);
}

// Ordinary subsidiary: capital allocation increases the existing carrying-book basis used by IPO/sale paths.
{
  const { engine, finance } = fixture('ordinary');
  const beforeStatements = finance.buildStatements(engine.g, '52');
  const beforeInvestment = beforeStatements.balanceSheet.assets.subsidiariesAndAffiliates;

  assert.equal(engine.executeGroupCapitalAllocation(), true);

  const sub = target(engine);
  const statements = finance.buildStatements(engine.g, '52');
  const validation = finance.validate(engine.g);
  assert.equal(sub.carryingBookValue, 150_000_000);
  assert.equal(sub.investmentBookValue, ALLOCATION);
  assert.equal(sub.capitalReceived, ALLOCATION);
  assert.equal(statements.balanceSheet.assets.subsidiariesAndAffiliates - beforeInvestment, ALLOCATION);
  assert.equal(statements.balanceSheet.balanceDifference, 0);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

// False operation leaves cash, basis and finance state untouched.
{
  const { engine } = fixture('ma');
  engine.g.groupCapitalAllocation.rows = [{ id: 'missing-target', allocation: ALLOCATION }];
  const before = snapshot(engine);
  assert.equal(engine.executeGroupCapitalAllocation(), false);
  assert.deepEqual(snapshot(engine), before);
}

// A duplicate/null finance posting is a hard failure and the production transaction rolls everything back.
{
  const { engine, finance } = fixture('ma');
  finance.event(engine.g, 'investmentPurchase', 0, {
    cashEffect: 0,
    assetEffect: 0,
    profitEffect: 0,
    sourceType: 'test-preexisting-posting',
    sourceID: OPERATION_ID,
    operationID: OPERATION_ID,
    idempotencyKey: OPERATION_ID
  });
  const before = snapshot(engine);
  assert.throws(() => engine.executeGroupCapitalAllocation(), /accounting posting failed/);
  assert.deepEqual(snapshot(engine), before);
}

// A thrown accounting failure also rolls back authoritative cash/book state.
{
  const { ctx, engine } = fixture('ma');
  const finance = ctx.__capitalismTycoonModules.finance;
  const originalEvent = finance.event;
  const before = snapshot(engine);
  finance.event = () => { throw new Error('forced accounting failure'); };
  assert.throws(() => engine.executeGroupCapitalAllocation(), /forced accounting failure/);
  finance.event = originalEvent;
  assert.deepEqual(snapshot(engine), before);
}

// Production save/reload preserves the accounting result and authoritative investment basis.
{
  const { ctx, engine, engineModule, finance } = fixture('ma');
  assert.equal(engine.executeGroupCapitalAllocation(), true);
  assert.equal(engine.save(), true);
  const payload = ctx.__localStorageData.get(engineModule.SAVE_KEY);
  assert(payload);

  const loaded = loadGame({ localStorageInitial: { [engineModule.SAVE_KEY]: payload } });
  const reloaded = loaded.ctx.__ct_engine;
  const reloadedFinance = loaded.ctx.__capitalismTycoonModules.finance;
  const originalSub = target(engine);
  const reloadedSub = target(reloaded);

  assert.equal(reloaded.g.companyCash, engine.g.companyCash);
  assert.equal(reloadedSub.identifiableNetAssetsBookValue, originalSub.identifiableNetAssetsBookValue);
  assert.equal(reloadedSub.totalCarryingValue, originalSub.totalCarryingValue);
  assert.equal(reloadedSub.investmentBookValue, originalSub.investmentBookValue);
  assert.equal(reloadedSub.capitalReceived, originalSub.capitalReceived);
  assert.deepEqual(
    JSON.parse(JSON.stringify(reloaded.g.finance.transactions)),
    JSON.parse(JSON.stringify(engine.g.finance.transactions))
  );
  assert.equal(reloadedFinance.validate(reloaded.g).ok, true, reloadedFinance.validate(reloaded.g).errors.join('\n'));
  assert.equal(finance.validate(engine.g).ok, true, finance.validate(engine.g).errors.join('\n'));
}

console.log('group capital allocation accounting tests passed');
