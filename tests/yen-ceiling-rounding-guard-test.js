'use strict';
// Whole-yen ceiling rounding ratchet (docs/economic-engine/YEN_CEILING_ROUNDING_CONTRACT.md §6).
// Lexical: only files listed in pendingFiles may still round money to ¥0.01, and a listed file that no longer
// does is stale and must be removed. Runtime: each migration slice registers focused scenarios below whose
// ledger rows and written state fields must be whole yen.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'yen-ceiling-rounding-baseline.json'), 'utf8'));
const CENT_PATTERN = /\*\s*100\s*\)\s*\/\s*100(?![0-9])/;
const EXEMPT = /\/\*\s*not-money:\s*\S[^*]*\*\//;

assert.equal(baseline.schema, 1);
assert.ok(Array.isArray(baseline.pendingFiles));
assert.deepEqual([...baseline.pendingFiles], [...new Set(baseline.pendingFiles)].sort(), 'pendingFiles is sorted and unique');

assert.ok(CENT_PATTERN.test('const r=v=>Math.round(v*100)/100;') && CENT_PATTERN.test('Math.round(x * 100 ) / 100'), 'cent pattern matches its spacing variants');
assert.ok(!CENT_PATTERN.test('Math.round(x*100)/1000'), 'a different divisor is not a cent pattern');
assert.ok(EXEMPT.test('Math.round(rate*100)/100 /* not-money: rate */') && !EXEMPT.test('Math.round(x*100)/100 /* not-money: */'), 'exemption needs a stated reason');

function centLines(file) {
  return fs.readFileSync(path.join(root, file), 'utf8').split('\n')
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => CENT_PATTERN.test(line) && !EXEMPT.test(line));
}
const files = fs.readdirSync(path.join(root, 'js')).filter(name => name.endsWith('.js')).sort().map(name => `js/${name}`);
const pending = new Set(baseline.pendingFiles);
for (const file of pending) assert.ok(files.includes(file), `pendingFiles lists ${file}, which does not exist`);
const unlisted = [], stale = [];
for (const file of files) {
  const hits = centLines(file);
  if (hits.length && !pending.has(file)) unlisted.push(`${file}:${hits.map(hit => hit.number).join(',')}`);
  if (!hits.length && pending.has(file)) stale.push(file);
}
assert.deepEqual(unlisted, [], 'cent rounding outside pendingFiles; use economicOperation.ceilYen, or mark a non-money line with /* not-money: ... */');
assert.deepEqual(stale, [], 'stale pendingFiles entries; remove them from tests/fixtures/yen-ceiling-rounding-baseline.json');

// Runtime: the row check itself must reject fractions, so a slice scenario cannot pass vacuously.
const EFFECTS = ['amount', 'cashEffect', 'profitEffect', 'assetEffect', 'liabilityEffect', 'equityEffect'];
function fractionalFields(row) { return EFFECTS.filter(key => row[key] !== undefined && !Number.isSafeInteger(Number(row[key]))); }
assert.deepEqual(fractionalFields({ amount: 13, cashEffect: -13, profitEffect: 0 }), []);
assert.deepEqual(fractionalFields({ amount: 12.3, cashEffect: -12.3 }), ['amount', 'cashEffect']);

// Each migration slice appends { slice, label, run } where run() returns { rows, state } for its migrated writers,
// starting from whole-yen balances (contract §6).
const { loadGame } = require('./harness');
function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}
function newGame(seed) {
  const loaded = loadGame({ headless: true, random: lcg(seed) });
  const engine = new loaded.engineModule.TycoonEngine();
  engine.configure({ playerName: 'Founder', companyName: 'Yen Co', difficulty: 'normal' });
  const finance = loaded.modules.finance;
  engine.g.companyCash = 500_000_000;
  engine.g.personalCash = 100_000_000;
  engine.g.finance = finance.defaultFinanceState(engine.g);
  return { engine, finance, modules: loaded.modules };
}
const rowsSince = (g, count, keep) => g.finance.transactions.slice(count).filter(keep);
const SCENARIOS = [
  { slice: 'R1', label: 'depreciation: weekly charge rounds up, the final charge is capped at book − salvage', run() {
    const { engine, finance } = newGame(1101), g = engine.g;
    finance.addFixedAsset(g, { assetID: 'r1-full', acquisitionCost: 1_000_000, salvageValue: 100_000, usefulLifeWeeks: 260 });
    finance.addFixedAsset(g, { assetID: 'r1-tail', acquisitionCost: 1_000_000, salvageValue: 100_000, usefulLifeWeeks: 260, accumulatedDepreciation: 899_950, bookValue: 100_050 });
    const count = g.finance.transactions.length;
    finance.recordWeekly(g, { stores: [], other: {}, beginningCash: g.companyCash });
    const rows = rowsSince(g, count, row => row.sourceType === 'depreciation');
    const byID = Object.fromEntries(rows.map(row => [row.sourceID, row.amount]));
    assert.deepEqual(byID, { 'r1-full': 3462, 'r1-tail': 50 }, '900,000 / 260 = 3461.54 rounds up to 3462; the tail is capped at 50');
    const [full, tail] = g.finance.fixedAssets.filter(a => a.assetID.startsWith('r1-'));
    assert.equal(tail.bookValue, 100_000);
    return { rows, state: { fullBook: full.bookValue, fullAccumulated: full.accumulatedDepreciation, tailBook: tail.bookValue, tailAccumulated: tail.accumulatedDepreciation } };
  } },
  { slice: 'R1', label: 'generic interest on company debt and the founder lender share', run() {
    const { engine } = newGame(1102), g = engine.g;
    assert.equal(engine.borrow(12_345_679, 'company'), true);
    assert.equal(engine.foundersLoanToCompany(3_000_001), true);
    const count = g.finance.transactions.length;
    engine.advanceWeek(false);
    const rows = rowsSince(g, count, row => row.sourceType === 'weekly-interest');
    return { rows, state: {} };
  } },
  { slice: 'R1', label: 'voluntary prepayment of a fractional request', run() {
    const { engine } = newGame(1103), g = engine.g;
    assert.equal(engine.borrow(20_000_000, 'company'), true);
    const count = g.finance.transactions.length;
    assert.equal(engine.prepayCompanyDebtVoluntarily(1_234_567.3), true);
    const rows = rowsSince(g, count, row => row.sourceType === 'voluntaryDebtPrepayment');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].amount, 1_234_568, 'a requested ¥0.3 rounds up to the next yen');
    const before = g.finance.transactions.length;
    assert.equal(engine.prepayCompanyDebtVoluntarily(5e-10), false, 'a request that rounds to ¥0 is rejected, not reported as paid');
    assert.equal(g.finance.transactions.length, before);
    return { rows, state: { companyCash: g.companyCash, companyDebt: g.companyDebt } };
  } },
  { slice: 'R2a', label: 'store weekly P&L rounds each row up from fractional master data', run() {
    const loaded = loadGame({ headless: true, random: lcg(1201) });
    const { engine: engineModule, finance, market, data } = loaded.modules;
    const state = engineModule.createInitialState({ configured: true });
    const business = state.businesses.find(row => !market.isTargetBusinessID(row.id));
    Object.assign(business, { price: 123.45, unitCost: 45.67, fixedCost: 100000.89, wage: 20000.78, demand: 0.25, quality: 0, brand: 0, efficiency: 0, dx: 0, storeCost: 0 });
    const pref = state.prefs[0];
    pref.rent = 30000.67;
    Object.assign(state, { companyCash: 1_000_000_000, companyDebt: 0, properties: [], startups: [], competitors: [], market: [], productVentures: [], subsidiaries: [], maSubsidiaries: [], overseasSubsidiaries: [], sportsTeams: [], personalInvestments: [], luxuryAssets: [], activeMissionIDs: [], completedMissionIDs: (data.MISSION_DEFS || []).map(row => row.id) });
    state.stores = [{ id: 'r2a-store', businessID: business.id, prefID: pref.id, name: 'R2a', status: 'open', condition: 99.876, operatingHours: 3, openingWeek: 1, weeksToOpen: 0, lastSales: 0, lastProfit: 0, marketResult: null }];
    state.finance = finance.defaultFinanceState(state);
    const engine = new engineModule.TycoonEngine(state), g = engine.g, count = g.finance.transactions.length;
    assert.equal(engine.advanceWeek(false), true);
    const rows = rowsSince(g, count, row => row.storeID === 'r2a-store');
    assert.equal(rows.length, 5, 'five store rows');
    return { rows, state: { lastSales: g.stores[0].lastSales, lastProfit: g.stores[0].lastProfit } };
  } },
  { slice: 'R2a', label: 'open and close a store with a fractional tenant deposit', run() {
    const { engine } = newGame(1202), g = engine.g;
    const tenant = g.tenants.find(t => !t.occupiedBy && t.businessID !== 'ramen') || g.tenants.find(t => !t.occupiedBy);
    tenant.deposit = 1_234_567.3;
    // The opening preview posts fixed cost as the same three independently rounded rows as advanceWeek().
    g.inflation = 1.001;
    const estimate = engine.estimateStoreOpening({ tenantID: tenant.id, businessID: tenant.businessID || 'cafe', operatingHours: 3 });
    const { rent, wage, otherFixed } = estimate.breakdown;
    for (const value of [rent, wage, otherFixed]) assert.equal(Number.isInteger(value), true, 'each preview fixed row is whole yen');
    assert.equal(estimate.expected.fixed, rent + wage + otherFixed, 'preview fixed cost is the sum of the rounded rows');
    assert.equal(estimate.deposit, 1_234_568, 'the previewed deposit is the amount that will be paid');
    const count = g.finance.transactions.length;
    assert.notEqual(engine.openStore({ tenantID: tenant.id, businessID: tenant.businessID || 'cafe', name: 'R2a open', operatingHours: 3 }), false);
    const store = g.stores[g.stores.length - 1];
    assert.equal(store.depositPaid, 1_234_568, 'the deposit paid is rounded up and kept on the store');
    const afterOpen = g.finance.transactions.length;
    assert.equal(engine.closeStore(store.id), true);
    const closeRows = g.finance.transactions.slice(afterOpen).filter(row => row.storeID === store.id);
    assert.equal(closeRows.find(row => row.sourceType === 'closeStoreDeposit').amount, 1_234_568, 'the forfeited deposit is the amount paid');
    return { rows: rowsSince(g, count, row => row.storeID === store.id), state: { companyCash: g.companyCash } };
  } },
  { slice: 'R2a', label: 'store equipment upgrade, renovation, menu research and business investment', run() {
    const { engine } = newGame(1203), g = engine.g;
    const tenant = g.tenants.find(t => !t.occupiedBy && t.businessID === 'ramen') || g.tenants.find(t => !t.occupiedBy);
    assert.notEqual(engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: 'R2a equip', operatingHours: 3 }), false);
    const store = g.stores[g.stores.length - 1];
    store.status = 'open';
    store.condition = 87.654;
    // Menu research needs the product department, which needs an office. The office deposit is slice R2c and can
    // leave a fraction in companyCash, so this scenario checks the rows only.
    const office = g.rentalOffices.reduce((a, b) => (a.deposit < b.deposit ? a : b));
    assert.equal(engine.contractOffice(office.id), true);
    assert.equal(engine.establishDepartment('product'), true);
    const count = g.finance.transactions.length;
    assert.equal(engine.upgradeStoreEquipment(store.id), true);
    assert.equal(engine.renovateStore(store.id), true);
    assert.equal(engine.startMenuResearch('chashu'), true);
    assert.equal(engine.investBusiness('ramen', 'brand', 1_000_000.4), true);
    const rows = rowsSince(g, count, () => true);
    assert.equal(rows.find(row => row.sourceType === 'investBusiness').amount, 1_000_001, 'a fractional investment rounds up');
    return { rows, state: {} };
  } },
  { slice: 'R2b', label: 'ramen procurement: contract, receipts, AP payment, consumption and spoilage', run() {
    const { engine, modules } = newGame(1301), g = engine.g, supply = modules.supply;
    g.inflation = 1.0137;
    const tenant = g.tenants.find(t => !t.occupiedBy && t.businessID === 'ramen') || g.tenants.find(t => !t.occupiedBy);
    assert.notEqual(engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: 'R2b', operatingHours: 3 }), false);
    const store = g.stores[g.stores.length - 1];
    store.status = 'open';
    store.openingWeek = g.week;
    const count = g.finance.transactions.length;
    // The default supplier (balanced_wholesale) buys on 3-week terms, so receipts go through AP and are paid later.
    for (let week = 0; week < 8; week++) assert.equal(engine.advanceWeek(false), true);
    const SUPPLY_SOURCES = new Set(['inventory-receipt-cash', 'emergency-receipt-cash', 'inventory-receipt-ap', 'ap-payment', 'spoilage']);
    const rows = rowsSince(g, count, row => SUPPLY_SOURCES.has(row.sourceType) || (row.sourceType === 'weekly-store-cogs' && row.storeID === store.id));
    for (const kind of ['inventory-receipt-ap', 'ap-payment', 'weekly-store-cogs']) assert.ok(rows.some(row => row.sourceType === kind), `R2b scenario posts ${kind}`);
    const lots = Object.values(g.inventoryByStoreID[store.id].materials).flatMap(material => material.lots).filter(lot => lot.status === 'available');
    assert.ok(lots.length > 0 && lots.every(lot => Number.isSafeInteger(lot.bookValue)), 'every lot book is whole yen');
    assert.equal(supply.physicalInventoryValue(g), g.finance.balances.inventory, 'physical inventory equals the balance-sheet inventory exactly');
    return { rows, state: { supplyAccountsPayable: g.supplyAccountsPayableBalance, inventory: g.finance.balances.inventory, lotBooks: lots.reduce((sum, lot) => sum + lot.bookValue, 0) } };
  } },
  { slice: 'R2b', label: 'every other supply writer: fees, cash and emergency receipts, spoilage, closure write-off', run() {
    const { engine, finance, modules } = newGame(1302), g = engine.g, supply = modules.supply;
    g.inflation = 1.0137;
    const tenant = g.tenants.find(t => !t.occupiedBy && t.businessID === 'ramen') || g.tenants.find(t => !t.occupiedBy);
    assert.notEqual(engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: 'R2b writers', operatingHours: 3 }), false);
    const store = g.stores[g.stores.length - 1];
    store.status = 'open';
    supply.ensureStore(g, store);
    const count = g.finance.transactions.length;
    assert.equal(supply.selectSupplier(g, store.id, 'quality_farm', finance), true, 'contract fee');
    assert.equal(supply.selectSupplier(g, store.id, 'quick_local', finance), true, 'termination fee plus the next contract fee');
    const cashOrder = supply.createOrder(g, store.id, 'ramen_noodles', 333.33, { paymentTermsWeeks: 0, leadTimeWeeks: 0 });
    assert.ok(cashOrder && supply.receiveOrderNow(g, finance, cashOrder, cashOrder.orderedQuantity) > 0, 'immediate cash receipt');
    assert.ok(supply.receiveEmergencyOrder(g, store.id, 'ramen_soup', 77.77, finance), 'emergency receipt');
    const soupLots = g.inventoryByStoreID[store.id].materials.ramen_soup.lots;
    soupLots.forEach(lot => { lot.expiryWeek = g.week; });
    assert.ok(supply.spoil(g, finance).cost > 0, 'spoilage');
    assert.ok(supply.disposeStoreSupply(g, store.id, finance).bookValue > 0, 'closure write-off of the remaining noodles');
    const rows = rowsSince(g, count, row => row.storeID === store.id || row.sourceType === 'spoilage');
    for (const kind of ['supplier-contract', 'supplier-termination', 'inventory-receipt-cash', 'emergency-receipt-cash', 'spoilage', 'closeStoreInventoryWriteoff']) assert.ok(rows.some(row => row.sourceType === kind), `R2b scenario posts ${kind}`);
    return { rows, state: { inventory: g.finance.balances.inventory, physicalInventory: supply.physicalInventoryValue(g) } };
  } },
];
for (const scenario of SCENARIOS) {
  const { rows, state = {} } = scenario.run();
  assert.ok(rows.length > 0, `${scenario.slice} ${scenario.label}: scenario posts at least one row`);
  for (const row of rows) assert.deepEqual(fractionalFields(row), [], `${scenario.slice} ${scenario.label}: ${row.category} ${row.sourceType} is whole yen`);
  for (const [key, value] of Object.entries(state)) assert.ok(Number.isSafeInteger(value), `${scenario.slice} ${scenario.label}: ${key}=${value} is whole yen`);
}

console.log(`PASS yen ceiling rounding guard: ${pending.size} pending file(s), ${SCENARIOS.length} migrated scenario(s)`);
