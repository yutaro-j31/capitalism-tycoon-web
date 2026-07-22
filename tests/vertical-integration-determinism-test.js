const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame, ROOT } = require('./harness');

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function round(value) { return Math.round(Number(value) * 1_000_000) / 1_000_000; }
function round2(value) { return Math.round(Number(value) * 100) / 100; }
function seededRandom(seed = 0x71c0ffee) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
function blockableRandom() {
  let blocked = false;
  const fn = () => {
    if (blocked) throw new Error('updateSupplyChainWeekly must not use Math.random');
    return .5;
  };
  fn.block = () => { blocked = true; };
  return fn;
}
function makeEngine(randomImpl = () => .5) {
  const { modules, ctx } = loadGame({ random: randomImpl });
  const engine = new modules.engine.TycoonEngine();
  engine.g.configured = true;
  engine.g.skipWeeklyValidation = false;
  engine.g.companyCash = 500_000_000;
  engine.g.companyDebt = 0;
  engine.g.week = 24;
  engine.g.month = 6;
  engine.g.news = [];
  engine.g.supplyChainEvents = [];
  engine.g.stores = [];
  engine.g.supplierContracts = [];
  engine.g.verticalIntegrationAssets = [];
  engine.g.inventoryByBusinessID = {
    ...engine.g.inventoryByBusinessID,
    cafe: { units: 1000, value: 0, targetWeeks: 2, lastDemandUnits: 0, lastProcurementCost: 0, disruptionWeeks: 0 }
  };
  engine.g.finance = modules.finance.defaultFinanceState(engine.g);
  modules.finance.recordSnapshot(engine.g, engine.g.companyCash, engine.g.week, engine.g.companyCash);
  return { engine, modules, ctx };
}
function addCafeStores(engine) {
  engine.g.stores.push(
    { id: 'cafe-a', businessID: 'cafe', prefID: 'tokyo', name: 'Cafe A', status: 'open', condition: 100, operatingHours: 3, openingWeek: 1, weeksToOpen: 0, lastSales: 12_000_000, lastProfit: 2_000_000 },
    { id: 'cafe-b', businessID: 'cafe', prefID: 'tokyo', name: 'Cafe B', status: 'open', condition: 100, operatingHours: 3, openingWeek: 1, weeksToOpen: 0, lastSales: 8_000_000, lastProfit: 1_000_000 }
  );
}
function addSupplier(engine, overrides = {}) {
  engine.g.supplierContracts.push({
    contractID: 'contract-fixed', id: 'supplier-fixed', name: '決定論サプライヤー', businessID: 'cafe', active: true,
    weeklyFee: 100_000, discount: .08, quality: 3, reliability: 0,
    ...overrides
  });
}
function addVerticalAssets(engine, assets) {
  engine.g.verticalIntegrationAssets.push(...assets.map(asset => ({
    id: asset.id, assetID: asset.assetID, name: asset.name, businessID: asset.businessID || 'all',
    cost: asset.cost ?? 120_000_000, weeklyCost: asset.weeklyCost ?? 900_000,
    costReduction: asset.costReduction ?? .06, risk: asset.risk ?? 0, active: true,
    startedWeek: asset.startedWeek ?? 10, condition: asset.condition ?? 100
  })));
}
function directSnapshot(engine) {
  return {
    cash: round(engine.g.companyCash),
    stores: engine.g.stores.map(store => ({ id: store.id, sales: round(store.lastSales), profit: round(store.lastProfit) })).sort((a, b) => a.id.localeCompare(b.id)),
    inventory: clone(engine.g.inventoryByBusinessID.cafe),
    assets: engine.g.verticalIntegrationAssets.map(asset => ({ assetID: asset.assetID, condition: round(asset.condition) })).sort((a, b) => a.assetID.localeCompare(b.assetID)),
    events: engine.g.supplyChainEvents.slice(),
    news: engine.g.news.slice()
  };
}
function runDirect(setup, randomImpl) {
  const { engine, modules } = makeEngine(randomImpl);
  addCafeStores(engine);
  setup(engine, modules);
  if (typeof randomImpl?.block === 'function') randomImpl.block();
  const beforeCash = engine.g.companyCash;
  const adjustment = engine.updateSupplyChainWeekly();
  assert.equal(round(engine.g.companyCash - beforeCash), round(adjustment), 'cash delta must equal returned supply adjustment');
  return { engine, modules, adjustment: round(adjustment), snapshot: directSnapshot(engine) };
}

// npm-test wiring contract: a temporary failure in this file is guaranteed to fail npm test
// because run-all calls the package script registered below.
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
assert.equal(pkg.scripts['test:vertical-integration-determinism'], 'node tests/vertical-integration-determinism-test.js');
const runAll = fs.readFileSync(path.join(ROOT, 'tests', 'run-all.js'), 'utf8');
assert.match(runAll, /test:vertical-integration-determinism/, 'npm test must execute the vertical integration determinism regression');

// Static scope guard: only the updateSupplyChainWeekly function body is checked because other
// expansion systems still intentionally use runtime randomness for non-supply features.
const expansion = fs.readFileSync(path.join(ROOT, 'js', 'expansion.js'), 'utf8');
const start = expansion.indexOf('TycoonEngine.prototype.updateSupplyChainWeekly=function()');
assert.ok(start >= 0, 'updateSupplyChainWeekly must exist');
const end = expansion.indexOf('\n  TycoonEngine.prototype.updateRDWeekly=function()', start);
assert.ok(end > start, 'updateSupplyChainWeekly extraction must stay precise');
const supplyBody = expansion.slice(start, end);
assert.doesNotMatch(supplyBody, /Math\s*\.\s*random|Math\s*\?\.\s*random|Date\.now|crypto\.randomUUID/, 'supply weekly body must not use nondeterministic APIs');
assert.doesNotMatch(supplyBody, /[^A-Za-z0-9_$]rand\s*\(/, 'supply weekly body must not route weekly decisions through nondeterministic rand()');

// Vertical integration: replay stability, per-asset order invariance, week/ID variation, and cash math.
const blocked = blockableRandom();
const verticalSetup = engine => addVerticalAssets(engine, [
  { id: 'warehouse', assetID: 'asset-a', name: '物流倉庫', risk: 0, weeklyCost: 900_000, costReduction: .06 },
  { id: 'factory', assetID: 'asset-b', name: '食品加工工場', risk: 0, weeklyCost: 760_000, costReduction: .05 }
]);
const verticalA = runDirect(verticalSetup, blocked);
const verticalBlocked = runDirect(verticalSetup, blockableRandom());
assert.equal(JSON.stringify(verticalBlocked.snapshot), JSON.stringify(verticalA.snapshot), 'vertical maintenance must run with Math.random blocked and replay identically');
const verticalB = runDirect(verticalSetup, () => .999999);
assert.equal(JSON.stringify(verticalB.snapshot), JSON.stringify(verticalA.snapshot), 'vertical maintenance must ignore ambient Math.random values');
const verticalDifferentWeek = runDirect(engine => { engine.g.week = 25; verticalSetup(engine); }, () => .5);
assert.notDeepEqual(verticalDifferentWeek.snapshot.assets, verticalA.snapshot.assets, 'different week should change deterministic condition decay');
const verticalDifferentID = runDirect(engine => addVerticalAssets(engine, [
  { id: 'warehouse', assetID: 'asset-c', name: '物流倉庫', risk: 0, weeklyCost: 900_000, costReduction: .06 },
  { id: 'factory', assetID: 'asset-d', name: '食品加工工場', risk: 0, weeklyCost: 760_000, costReduction: .05 }
]), () => .5);
assert.notDeepEqual(verticalDifferentID.snapshot.assets, verticalA.snapshot.assets, 'different asset IDs should change deterministic condition decay');
const reversed = runDirect(engine => addVerticalAssets(engine, [
  { id: 'factory', assetID: 'asset-b', name: '食品加工工場', risk: 0, weeklyCost: 760_000, costReduction: .05 },
  { id: 'warehouse', assetID: 'asset-a', name: '物流倉庫', risk: 0, weeklyCost: 900_000, costReduction: .06 }
]), () => .5);
assert.equal(JSON.stringify(reversed.snapshot.assets), JSON.stringify(verticalA.snapshot.assets), 'asset condition results must not depend on asset array order');
assert.equal(verticalA.adjustment, round(verticalA.engine.g.companyCash - 500_000_000));

// Supplier delay and shortage: force the branches, verify replay stability and Math.random independence.
const supplierSetup = engine => {
  addSupplier(engine, { contractID: 'contract-delay-a', reliability: 0, weeklyFee: 125_000, discount: .04 });
  engine.g.inventoryByBusinessID.cafe.disruptionWeeks = 2;
};
const supplierRandom = blockableRandom();
const supplierA = runDirect(supplierSetup, supplierRandom);
const supplierBlocked = runDirect(supplierSetup, blockableRandom());
assert.equal(JSON.stringify(supplierBlocked.snapshot), JSON.stringify(supplierA.snapshot), 'supplier delay and shortage must run with Math.random blocked');
const supplierReplay = runDirect(supplierSetup, () => .123456);
assert.equal(JSON.stringify(supplierReplay.snapshot), JSON.stringify(supplierA.snapshot), 'supplier delay and shortage replay must match for same state');
assert.ok(supplierA.snapshot.events.some(text => text.includes('供給遅延')), 'supplier reliability branch must emit deterministic delay event');
assert.ok(supplierA.snapshot.events.some(text => text.includes('欠品')), 'disruptionWeeks branch must emit deterministic shortage event');
const supplierDifferentWeek = runDirect(engine => { engine.g.week = 25; supplierSetup(engine); }, () => .5);
assert.notDeepEqual(supplierDifferentWeek.snapshot.stores, supplierA.snapshot.stores, 'different week can change deterministic shortage impact');
const supplierDifferentID = runDirect(engine => {
  addSupplier(engine, { contractID: 'contract-delay-b', reliability: 0, weeklyFee: 125_000, discount: .04 });
  engine.g.inventoryByBusinessID.cafe.disruptionWeeks = 2;
}, () => .5);
assert.notDeepEqual(supplierDifferentID.snapshot.inventory, supplierA.snapshot.inventory, 'different contract ID can change deterministic delay duration');

// Production advanceWeek integration: save/load replay, guard, accounting, finance snapshot, and no duplicate events.
function configuredForAdvance(randomImpl) {
  const { engine, modules, ctx } = makeEngine(randomImpl);
  addCafeStores(engine);
  addSupplier(engine, { contractID: 'advance-contract', reliability: 0, weeklyFee: 75_000, discount: .03 });
  addVerticalAssets(engine, [{ id: 'warehouse', assetID: 'advance-asset', name: '物流倉庫', risk: 0, weeklyCost: 250_000, costReduction: .03 }]);
  engine.g.inventoryByBusinessID.cafe.disruptionWeeks = 1;
  engine.g.lastExpansionUpdateWeek = 0;
  return { engine, modules, ctx };
}
const firstAdvance = configuredForAdvance(seededRandom(0x1234));
const saveBeforeAdvance = JSON.stringify(firstAdvance.engine.g);
assert.equal(firstAdvance.modules.engine.SAVE_KEY, 'capitalism_tycoon_web_v1');
assert.equal(firstAdvance.engine.g.saveVersion, 9);
assert.equal(firstAdvance.engine.advanceWeek(false), true);
const afterAdvance = clone(firstAdvance.engine.g);
assert.equal(afterAdvance.lastExpansionUpdateWeek, afterAdvance.week, 'expansion weekly guard must mark the processed week');
assert.ok(Math.abs(afterAdvance.companyCash - afterAdvance.finance.weeklySnapshots.at(-1).endingCash) < .05, 'finance weekly snapshot closing cash must equal company cash');
const expansionTx = afterAdvance.finance.transactions.find(tx => tx.sourceType === 'expansionWeeklyAdjustment' && tx.sourceID === String(afterAdvance.week));
assert.equal(round2(afterAdvance.expandedWeeklyAdjustments.supply), round2(expansionTx.cashEffect));
assert.equal(round2(afterAdvance.expandedWeeklyAdjustments.supply), round2(expansionTx.profitEffect));
assert.equal(round(afterAdvance.lastReport.profit - firstAdvance.engine.g.reports.at(-1).profit), 0, 'lastReport profit must match reports entry after expansion adjustment');
assert.equal(firstAdvance.modules.finance.validate(afterAdvance).errors.length, 0, 'finance.validate must pass after production weekly path');

const loadedAdvance = configuredForAdvance(seededRandom(0x1234));
const migrated = loadedAdvance.modules.engine.migrateSave(JSON.parse(saveBeforeAdvance));
assert.equal(migrated.ok, true, migrated.errors.join('\n'));
loadedAdvance.engine.g = migrated.state;
loadedAdvance.engine.normalize();
assert.equal(loadedAdvance.engine.advanceWeek(false), true);
assert.equal(JSON.stringify({
  cash: round(loadedAdvance.engine.g.companyCash),
  supply: round(loadedAdvance.engine.g.expandedWeeklyAdjustments.supply),
  report: round(loadedAdvance.engine.g.lastReport.profit),
  events: loadedAdvance.engine.g.supplyChainEvents,
  news: loadedAdvance.engine.g.news.slice(0, loadedAdvance.engine.g.supplyChainEvents.length)
}), JSON.stringify({
  cash: round(afterAdvance.companyCash),
  supply: round(afterAdvance.expandedWeeklyAdjustments.supply),
  report: round(afterAdvance.lastReport.profit),
  events: afterAdvance.supplyChainEvents,
  news: afterAdvance.news.slice(0, afterAdvance.supplyChainEvents.length)
}), 'save/load replay of the next week must match');

const duplicateEventsBefore = afterAdvance.supplyChainEvents.length;
const duplicateNewsBefore = afterAdvance.news.length;
firstAdvance.engine.g = afterAdvance;
firstAdvance.engine.g.lastExpansionUpdateWeek = firstAdvance.engine.g.week;
firstAdvance.engine.ensureExpansionDefaults();
if (firstAdvance.engine.g.lastExpansionUpdateWeek !== firstAdvance.engine.g.week) throw new Error('guard setup failed');
assert.equal(firstAdvance.engine.g.supplyChainEvents.length, duplicateEventsBefore, 'guard setup must not duplicate events');
assert.equal(firstAdvance.engine.g.news.length, duplicateNewsBefore, 'guard setup must not duplicate news');

console.log('vertical integration and supply-chain determinism checks passed');
