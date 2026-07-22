'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadGame } = require('./harness');

function install(load) {
  for (const file of [
    'player-debt-service.js', 'treasury-prepayment.js', 'shareholder-returns.js',
    'capital-allocation-score.js', 'capital-allocation-policy.js', 'capital-allocation-forecast.js',
    'capital-allocation-actions.js', 'capital-allocation-decision-memo.js',
    'capital-allocation-stress-test.js', 'capital-allocation-resilience-memo.js',
    'capital-allocation-recovery-funding.js', 'capital-allocation-recovery-funding-options.js',
    'capital-allocation-recovery-funding-readiness.js',
    'capital-allocation-recovery-funding-reconciliation.js',
    'capital-allocation-recovery-funding-outcome.js'
  ]) {
    const key = file.replace('.js', '').replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    if (!load.modules[key]) {
      vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file), 'utf8'), load.ctx, { filename:file });
    }
  }
  return load;
}

function publicGame(modules) {
  const { engine, finance } = modules;
  const state = engine.createInitialState({ configured:true, playerName:'Reload Director', companyName:'Reload Holdings' });
  Object.assign(state, {
    week:27,
    publicCompany:true,
    selectedTab:'market',
    companyCash:10_000_000,
    companyDebt:300_000_000,
    companyCredit:100,
    companyReputation:80,
    investorConfidence:80,
    sharesOut:1_000_000,
    founderShares:600_000,
    stockPrice:100,
    ticker:'CPTY'
  });
  state.market = state.market.filter(row => !['CPTY', 'EXT'].includes(row.id));
  state.market.push(
    { id:'CPTY', name:state.companyName, sector:'コングロマリット', price:100, previous:100, dividendYield:0, volatility:0, trend:0, marketCap:100_000_000, per:20, pbr:2, issuedShares:1_000_000, dividendPerShare:0, shareholders:{}, description:'test issuer', listingMarket:'東証グロース', priceHistory:[{week:27,price:100}] },
    { id:'EXT', name:'外部上場株', sector:'IT', price:10_000, previous:10_000, dividendYield:0, volatility:0, trend:0, marketCap:10_000_000_000, per:20, pbr:2, issuedShares:1_000_000, dividendPerShare:0, shareholders:{}, description:'test asset', listingMarket:'東証プライム', priceHistory:[{week:27,price:10_000}] }
  );
  state.companyStocks = { EXT:{ qty:10_000, avg:8_000 } };
  const property = state.properties[0];
  Object.assign(property, {
    owner:'company',
    value:1_000_000_000,
    price:1_000_000_000,
    purchasePrice:600_000_000,
    bookValue:600_000_000
  });
  state.finance = finance.defaultFinanceState(state);
  state.finance.capitalAllocationPolicy = { id:'balanced', lastChangedWeek:-999, lastEvaluatedWeek:-1, executionScore:50, history:[] };
  finance.event(state, 'revenue', 100_000_000, {
    week:27,
    cashEffect:0,
    profitEffect:100_000_000,
    receivableAmount:100_000_000,
    sourceType:'recoveryReloadFixture',
    sourceID:'baseline',
    idempotencyKey:'recovery-reload-revenue',
    description:'Recovery reload fixture revenue'
  });
  state.finance.loans = [{
    id:'test-loan', loanID:'test-loan', status:'active',
    principal:300_000_000, outstandingPrincipal:300_000_000,
    interestRate:.1, termWeeks:260, remainingWeeks:200,
    maturityWeek:104, repaymentMethod:'manual', weeklyPrincipalPayment:0, nextPaymentWeek:28
  }];
  finance.rebuildSnapshotForWeek(state, 27);
  state.finance.dirtyWeeks = [];
  return new engine.TycoonEngine(state);
}

function accountingSnapshot(game) {
  const property = game.g.properties.find(row => row.owner === 'company');
  const stockUnits = 1_000;
  const stockAmount = game.stock('EXT').price * stockUnits * .999;
  const propertyAmount = property.value * .97;
  const borrowing = 50_000_000;
  const transactions = game.g.finance.transactions;
  const last = transactions.at(-1);
  return {
    fingerprint:'save-reload-accounting-fixture',
    week:game.g.week,
    targetScore:70,
    projectedScore:null,
    optionId:'recommended',
    optionName:'現行推奨',
    targetPolicy:'growth',
    currentPolicy:'balanced',
    baselineCash:game.g.companyCash,
    baselineDebt:game.g.companyDebt,
    baselineTransactionCount:transactions.length,
    baselineLastTransactionId:last?.transactionID || last?.id || '',
    assetFunding:stockAmount + propertyAmount,
    totalFunding:stockAmount + propertyAmount + borrowing,
    borrowing,
    sources:[
      { id:'stock:EXT', kind:'securities', sourceId:'EXT', units:stockUnits, amount:stockAmount, price:game.stock('EXT').price, holdingUnits:game.g.companyStocks.EXT.qty, averageCost:game.g.companyStocks.EXT.avg },
      { id:`property:${property.id}`, kind:'properties', sourceId:property.id, units:1, amount:propertyAmount, owner:'company', marketValue:property.value, landCarryingValue:property.purchasePrice, buildingCarryingValue:0, buildingAssetCount:0 }
    ],
    steps:[
      { id:'policy', kind:'policy', label:'方針変更', order:1, amount:0 },
      { id:'stock:EXT', kind:'securities', sourceId:'EXT', label:'株式売却', order:2, units:stockUnits, amount:stockAmount },
      { id:`property:${property.id}`, kind:'properties', sourceId:property.id, label:'不動産売却', order:3, units:1, amount:propertyAmount },
      { id:'borrowing', kind:'borrowing', label:'会社借入', order:4, units:1, amount:borrowing }
    ]
  };
}

function summary(game, modules) {
  const property = game.g.properties[0];
  const transactions = game.g.finance.transactions || [];
  return {
    saveVersion:game.g.saveVersion,
    week:game.g.week,
    companyCash:game.g.companyCash,
    companyDebt:game.g.companyDebt,
    policy:game.g.finance.capitalAllocationPolicy?.id,
    stockQty:game.g.companyStocks?.EXT?.qty || 0,
    propertyOwner:property?.owner ?? null,
    transactionCount:transactions.length,
    transactionIDs:transactions.map(row => row.transactionID || row.id || ''),
    financeErrors:Array.from(modules.finance.validate(game.g).errors || []).map(String)
  };
}

const load = install(loadGame());
const modules = load.modules;
const reconciliation = modules.capitalAllocationRecoveryFundingReconciliation;
const outcome = modules.capitalAllocationRecoveryFundingOutcome;
assert.ok(reconciliation?.__installed);
assert.ok(outcome?.__installed);
assert.equal(modules.engine.SAVE_KEY, 'capitalism_tycoon_web_v1');
assert.equal(modules.engine.SAVE_VERSION, 9);

const game = publicGame(modules);
const snapshot = accountingSnapshot(game);
const propertyID = snapshot.steps.find(step => step.kind === 'properties').sourceId;
assert.equal(game.setCapitalAllocationPolicy('growth'), true);
assert.equal(game.sellStock('EXT', 1_000, 'company'), true);
assert.equal(game.sellProperty(propertyID), true);
assert.equal(game.borrow(50_000_000, 'company'), true);

const scoreMetrics = modules.capitalAllocationScore.metrics(game);
const actualScore = modules.capitalAllocationScore.scoreMetrics(scoreMetrics);
snapshot.targetScore = actualScore;
snapshot.projectedScore = actualScore;

const beforeReloadReconciliation = game.capitalAllocationRecoveryFundingReconciliation(snapshot);
const beforeReloadOutcome = game.capitalAllocationRecoveryFundingOutcome(snapshot);
assert.equal(beforeReloadReconciliation.status, 'complete');
assert.equal(beforeReloadReconciliation.complete, true);
assert.equal(beforeReloadOutcome.status, 'verified');
assert.equal(beforeReloadOutcome.verified, true);
assert.equal(beforeReloadOutcome.targetReached, true);
assert.equal(beforeReloadOutcome.evidence.transactionCount, 3);
assert.ok(Math.abs(beforeReloadOutcome.cashVariance) <= .5);
assert.ok(Math.abs(beforeReloadOutcome.debtVariance) <= .5);

const beforeReload = summary(game, modules);
assert.deepEqual(beforeReload.financeErrors, []);
const serialized = JSON.stringify(game.g);
assert.ok(serialized.includes('recovery-reload-revenue'));
const reloaded = new modules.engine.TycoonEngine(JSON.parse(serialized));
const afterReload = summary(reloaded, modules);

assert.equal(afterReload.saveVersion, 9);
assert.equal(afterReload.week, beforeReload.week);
assert.equal(afterReload.companyCash, beforeReload.companyCash);
assert.equal(afterReload.companyDebt, beforeReload.companyDebt);
assert.equal(afterReload.policy, beforeReload.policy);
assert.equal(afterReload.stockQty, beforeReload.stockQty);
assert.equal(afterReload.propertyOwner, beforeReload.propertyOwner);
assert.equal(afterReload.transactionCount, beforeReload.transactionCount);
assert.deepEqual(afterReload.transactionIDs, beforeReload.transactionIDs);
assert.deepEqual(afterReload.financeErrors, []);

const afterReloadReconciliation = reloaded.capitalAllocationRecoveryFundingReconciliation(snapshot);
const afterReloadOutcome = reloaded.capitalAllocationRecoveryFundingOutcome(snapshot);
assert.equal(afterReloadReconciliation.status, 'complete');
assert.equal(afterReloadReconciliation.complete, true);
assert.equal(afterReloadReconciliation.transactionEvidence.relevantCount, 3);
assert.ok(reconciliation.moneyClose(afterReloadReconciliation.cashVariance, 0));
assert.ok(reconciliation.moneyClose(afterReloadReconciliation.debtVariance, 0));
assert.equal(afterReloadOutcome.status, 'verified');
assert.equal(afterReloadOutcome.verified, true);
assert.equal(afterReloadOutcome.targetReached, true);
assert.deepEqual(afterReloadOutcome.evidence, beforeReloadOutcome.evidence);
assert.equal(afterReloadOutcome.actualScore, beforeReloadOutcome.actualScore);
assert.equal(afterReloadOutcome.scoreVariance, 0);

const pinGame = publicGame(modules);
const initialCandidate = pinGame.capitalAllocationRecoveryFundingReadiness(50, 'recommended');
pinGame.g.finance.capitalAllocationPolicy.id = initialCandidate.targetPolicy;
pinGame.g.finance.capitalAllocationPolicy.lastChangedWeek = -999;
const ready = reconciliation.candidates(pinGame, 50).find(row => row.ready);
assert.ok(ready, 'fixture must expose a transient plan');
const pinStateBefore = JSON.stringify(pinGame.g);
const pinned = pinGame.pinCapitalAllocationRecoveryFundingSnapshot(50, ready.optionId);
assert.ok(pinned);
assert.equal(JSON.stringify(pinGame.g), pinStateBefore, 'pinning must remain outside the save state');
assert.ok(reconciliation.pinned(pinGame));
const pinReloaded = new modules.engine.TycoonEngine(JSON.parse(JSON.stringify(pinGame.g)));
assert.equal(reconciliation.pinned(pinReloaded), null, 'transient recovery plans must not leak into reloaded saves');
assert.equal(pinReloaded.g.saveVersion, 9);
assert.deepEqual(Array.from(modules.finance.validate(pinReloaded.g).errors || []), []);

console.log('recovery transactions, accounting evidence, and transient plans survive save reload safely');
