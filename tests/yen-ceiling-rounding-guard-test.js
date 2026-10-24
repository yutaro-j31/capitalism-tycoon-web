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
  { slice: 'R2c', label: 'head office: office deposit, hiring, executives, directives, key people and weekly HQ costs', run() {
    const { engine, modules } = newGame(1401), g = engine.g, workforce = modules.workforce;
    g.inflation = 1.0137;
    const office = g.rentalOffices.reduce((a, b) => (a.deposit < b.deposit ? a : b));
    Object.assign(office, { deposit: 1_234_567.4, rent: 98_765.3 });
    const branch = g.rentalOffices.find(o => o.id !== office.id);
    Object.assign(branch, { deposit: 765_432.1, rent: 43_210.7 });
    const count = g.finance.transactions.length;
    assert.equal(engine.contractOffice(office.id), true);
    assert.equal(g.contractedOfficeDeposit, 1_234_568, 'the office deposit paid is rounded up and kept');
    assert.equal(engine.contractBranchOffice(branch.id), true);
    assert.equal(g.branchOffices[0].deposit, 765_433, 'the branch keeps the deposit paid');
    assert.equal(engine.establishDepartment('product'), true);
    // The CXO referral needs HR; install it directly (its unlock needs stores this scenario does not model).
    g.departments.hr = { ...modules.data.MASTER.departments.find(d => d.id === 'hr'), established: true };
    assert.equal(engine.refreshExecutives(), true, 'a CXO referral fee drawn from a fractional range');
    workforce.generateCandidates(g);
    const candidate = g.workforceCandidates.find(c => c.status === 'open' && !c.storeID);
    assert.ok(candidate, 'a corporate candidate');
    candidate.recruitmentFee = 123_456.7; // a candidate generated before R2c may still carry cents
    assert.equal(workforce.hireCandidate(g, candidate.candidateID, modules.finance).cost, 123_457);
    const exec = g.executiveMarket[0];
    exec.desiredSalary = 1;
    assert.equal(engine.hireExecutive(exec.id, 12_345_678.9, exec.desiredSO || .005), true, 'a generous offer is accepted');
    assert.equal(engine.addDirective(exec.role, 'cost', 1_000_000.4), true);
    assert.equal(engine.startCampaign('product', '採用強化', 500_000.6), true);
    assert.equal(engine.hireKeyPerson(), true);
    const keyPerson = g.keyPersonnel[g.keyPersonnel.length - 1];
    keyPerson.salary = 9_876_543.21;
    assert.equal(engine.trainKeyPerson(keyPerson.id), true);
    assert.equal(engine.retainKeyPerson(keyPerson.id), true);
    while (g.week % 4 !== 3) assert.equal(engine.advanceWeek(false), true);
    assert.equal(engine.advanceWeek(false), true, 'a week that pays executive payroll');
    const HQ = new Set(['contractOffice', 'contractBranchOffice', 'refreshExecutives', 'workforceCandidateHire', 'hireExecutive', 'addDirective', 'startCampaign', 'hireKeyPerson', 'trainKeyPerson', 'retainKeyPerson',
      'weekly-execPayroll', 'weekly-deptCost', 'weekly-officeCost', 'weekly-projectCost', 'weekly-severanceCost', 'parityWeeklyAdjustment', 'completionWeeklyAdjustment']);
    const rows = rowsSince(g, count, row => HQ.has(row.sourceType));
    for (const kind of ['contractOffice', 'contractBranchOffice', 'refreshExecutives', 'workforceCandidateHire', 'hireExecutive', 'addDirective', 'startCampaign', 'hireKeyPerson', 'trainKeyPerson', 'retainKeyPerson', 'weekly-execPayroll', 'weekly-deptCost', 'weekly-officeCost', 'parityWeeklyAdjustment', 'completionWeeklyAdjustment'])
      assert.ok(rows.some(row => row.sourceType === kind), `R2c scenario posts ${kind}`);
    return { rows, state: { departmentSeverance: workforce.departmentSeverance(g, 'product'), weeklyPayroll: workforce.weeklyPayroll(g), totalOfficeWeeklyCost: engine.totalOfficeWeeklyCost() } };
  } },
  { slice: 'R2c', label: 'office and branch cancellation refunds are capped at the deposit paid', run() {
    const { engine } = newGame(1402), g = engine.g;
    const office = g.rentalOffices.reduce((a, b) => (a.deposit < b.deposit ? a : b));
    office.deposit = 1_000_000.3;
    const branch = g.rentalOffices.find(o => o.id !== office.id);
    branch.deposit = 333_333.3;
    assert.equal(engine.contractOffice(office.id), true);
    assert.equal(engine.contractBranchOffice(branch.id), true);
    const count = g.finance.transactions.length;
    assert.equal(engine.closeBranchOffice(g.branchOffices[0].id), true);
    assert.equal(engine.cancelOffice(), true);
    assert.equal(g.contractedOfficeDeposit, undefined, 'the paid deposit is forgotten once the office is cancelled');
    const rows = rowsSince(g, count, row => row.sourceType === 'cancelOffice' || row.sourceType === 'closeBranchOffice');
    const byKind = Object.fromEntries(rows.map(row => [row.sourceType, row]));
    assert.deepEqual([byKind.cancelOffice.cashEffect, byKind.cancelOffice.assetEffect, byKind.cancelOffice.profitEffect], [600_001, -1_000_001, -400_000], 'refund ceil(1,000,001 × .6); loss derived');
    assert.deepEqual([byKind.closeBranchOffice.cashEffect, byKind.closeBranchOffice.assetEffect, byKind.closeBranchOffice.profitEffect], [200_001, -333_334, -133_333]);
    return { rows, state: { companyCash: g.companyCash } };
  } },
  { slice: 'R2d', label: 'product ventures: development, funnel weeks, maintenance, actions, retirement, sale, buyout and transport rebuild', run() {
    const { engine, modules } = newGame(1501), g = engine.g;
    // Product development needs the product department; install it directly (establishing it needs a head office).
    g.departments.product = { ...modules.data.MASTER.departments.find(d => d.id === 'product'), established: true };
    const count = g.finance.transactions.length;
    const blueprints = modules.data.PRODUCT_BLUEPRINTS.slice(0, 3);
    for (const bp of blueprints) assert.equal(engine.launchProduct(bp.id, `R2d ${bp.id}`), true);
    for (const p of g.productVentures) p.serverCost += 0.3; // a fractional server cost feeds the development cost
    assert.equal(engine.advanceWeek(false), true, 'a development week');
    for (const p of g.productVentures) Object.assign(p, { progress: 99, weeksToLaunch: 1 });
    for (let week = 0; week < 3; week++) assert.equal(engine.advanceWeek(false), true, 'release and funnel weeks');
    const [kept, bought, retired] = g.productVentures;
    assert.ok(g.productVentures.every(p => p.status === 'released' && Number.isSafeInteger(p.revenue) && Number.isSafeInteger(p.cost)), 'funnel revenue and cost are whole');
    assert.equal(engine.productAction(kept.id, 'marketing', 100_000.3), true);
    assert.equal(engine.startProductSunset(retired.id), true);
    for (let week = 0; week < 4; week++) assert.equal(engine.advanceWeek(false), true, 'sunset weeks');
    assert.equal(engine.retireProduct(retired.id), true);
    // An offer generated before R2d may still carry cents.
    g.productBuyoutOffers.unshift({ id: 'r2d-offer', productID: bought.id, productName: bought.name, buyerName: 'R2d', offerAmount: 12_345_678.9, premium: .1, createdWeek: g.week, expiresWeek: g.week + 8, status: 'pending' });
    assert.equal(engine.acceptProductBuyoutOffer('r2d-offer'), true);
    const offer = g.productBuyoutOffers.find(row => row.id === 'r2d-offer');
    assert.equal(offer.offerAmount, 12_345_679, 'the accepted offer keeps the amount actually received');
    kept.valuation = 3_456_789.4;
    assert.equal(engine.sellProduct(kept.id), true);
    g.subsidiaries.push({ id: 'r2d-sub', name: 'R2d物流', industry: '物流', valuation: 123_456_789.7 });
    assert.equal(engine.startTransportRebuild('r2d-sub', 'digital'), true);
    const PRODUCT = ['launchProduct', 'weekly-productRevenue', 'weekly-productCost', 'productMaintenance', 'expansionWeeklyAdjustment', 'productAction', 'productRetirement', 'productBuyoutOffer', 'sellProduct', 'startTransportRebuild'];
    const rows = rowsSince(g, count, row => PRODUCT.includes(row.sourceType));
    for (const kind of PRODUCT) assert.ok(rows.some(row => row.sourceType === kind), `R2d scenario posts ${kind}`);
    const amount = kind => rows.find(row => row.sourceType === kind).amount;
    assert.deepEqual([amount('productAction'), amount('productBuyoutOffer'), amount('sellProduct'), amount('startTransportRebuild')], [100_001, 12_345_679, 3_456_790, 5_555_556], 'user amount, legacy offer, sale value and ceil(123,456,789.7 × .045)');
    return { rows, state: { companyCash: g.companyCash, acceptedOffer: offer.offerAmount, maxProductExit: g.hallOfRecords ? g.hallOfRecords.maxProductExit : 0 } };
  } },
  { slice: 'R2d', label: 'weekly adjustments: legacy product, franchise income, quarterly tax, supply chain, vertical integration, personal depreciation', run() {
    const loaded = loadGame({ headless: true, random: lcg(1502) });
    const { engine: engineModule, finance, market, supply, data } = loaded.modules;
    const state = engineModule.createInitialState({ configured: true });
    const business = state.businesses.find(row => !market.isTargetBusinessID(row.id) && !supply.isTargetBusinessID(row.id));
    Object.assign(business, { price: 123.45, unitCost: 45.67, demand: 0.25 });
    Object.assign(state, { week: 12, companyCash: 1_000_000_000, personalCash: 100_000_000, companyDebt: 0, properties: [], startups: [], competitors: [], market: [], subsidiaries: [], maSubsidiaries: [], overseasSubsidiaries: [], sportsTeams: [], personalInvestments: [], luxuryAssets: [], activeMissionIDs: [], completedMissionIDs: (data.MISSION_DEFS || []).map(row => row.id) });
    state.stores = [{ id: 'r2d-store', businessID: business.id, prefID: state.prefs[0].id, name: 'R2d', status: 'open', condition: 99, operatingHours: 3, openingWeek: 1, weeksToOpen: 0, lastSales: 0, lastProfit: 0, marketResult: null }];
    // A pre-economics product without a digital blueprint runs the legacy revenue/cost paths.
    state.productVentures = [{ id: 'r2d-legacy', name: 'Legacy', blueprintID: 'legacy', category: 'SaaS', status: 'released', economicsVersion: 0, quality: 60, brand: 30, users: 12_345, paidUsers: 321, price: 1234.5, serverCost: 150_000.3, market: 500_000, risk: .2, valuation: 50_000_000, revenue: 0, cost: 0, profit: 0, releaseWeek: 1 }];
    state.supplierContracts = [{ contractID: 'r2d-contract', id: 'local-quality', name: 'R2d supplier', businessID: business.id, active: true, discount: .02, quality: 10, reliability: 2, weeklyFee: 35_000 }];
    state.verticalIntegrationAssets = [{ assetID: 'r2d-vertical', id: 'pos-platform', name: 'POS', businessID: 'all', cost: 45_000_000, weeklyCost: 320_000, costReduction: .025, risk: 100, active: true, condition: 100 }];
    state.franchiseStoresByBusinessID = { [business.id]: 3 };
    state.quarterlyPretaxProfit = 1_234_567.89; // week 13 closes the quarter
    state.finance = finance.defaultFinanceState(state);
    const engine = new engineModule.TycoonEngine(state), g = engine.g, count = g.finance.transactions.length;
    g.inventoryByBusinessID[business.id].disruptionWeeks = 2; // a shortage week posts the lost margin
    g.personalRealEstateHoldings = [{ assetID: 'r2d-home', name: 'R2d home', status: 'owned', purchasePrice: 12_345_677, bookValue: 12_345_677, currentValue: 12_345_677, weeklyRent: 20_000, acquiredWeek: 1 }];
    assert.equal(engine.advanceWeek(false), true);
    assert.equal(g.week, 13);
    const WEEKLY = ['weekly-productRevenue', 'weekly-productCost', 'weekly-franchiseRevenue', 'weekly-taxExpense', 'weekly-taxPayment', 'expansionWeeklyAdjustment'];
    const rows = rowsSince(g, count, row => WEEKLY.includes(row.sourceType));
    for (const kind of WEEKLY) assert.ok(rows.some(row => row.sourceType === kind), `R2d scenario posts ${kind}`);
    assert.ok(g.supplyChainEvents.some(text => text.includes('欠品')) && g.supplyChainEvents.some(text => text.includes('修繕費')), 'the shortage and the vertical incident both fire');
    const home = g.personalRealEstateHoldings[0];
    assert.equal(home.bookValue, 12_345_677 - 9_497, 'ceil((12,345,677 − ceil(12,345,677 × .2)) / 1040)');
    return { rows, state: { companyCash: g.companyCash, supply: g.expandedWeeklyAdjustments.supply, product: g.expandedWeeklyAdjustments.product, homeBook: home.bookValue } };
  } },
  { slice: 'R3a', label: 'company real estate: negotiated acquisition split, depreciation, rental week and a legacy collateral loan', run() {
    const { engine, modules } = newGame(1601), g = engine.g, realEstate = modules.realEstate;
    const count = g.finance.transactions.length;
    // The offer is rounded up from a fractional listed price and the agreed price is split exactly into land and building.
    let property = null;
    for (const candidate of g.properties.filter(p => !p.owner && p.buildingType)) {
      candidate.price = 10_000_001.3;
      realEstate.ensure(g);
      const result = engine.negotiatePropertyPrice(candidate.id, 'company', .95);
      if (result && result.accepted) { property = candidate; break; }
    }
    assert.ok(property, 'a negotiation is accepted');
    const x = property.realEstate;
    assert.equal(property.purchasePrice, 9_500_002, 'ceil(10,000,001.3 × .95)');
    assert.equal(x.landBookValue + x.buildingBookValue, 9_500_002, 'land + building book = the amount paid');
    Object.assign(x, { buildingOriginalCost: 1_000_001, buildingBookValue: 1_000_001 });
    assert.equal(engine.enablePropertyRental(property.id, { monthlyRent: 100_000.3, targetOccupancy: .9 }), true);
    // A secured loan from a save made before complete-cycle took over the public API is still serviced weekly here.
    g.realEstate.loans.push({ loanID: 'r3a-loan', propertyID: property.id, owner: 'company', principal: 1_000_001, outstandingPrincipal: 1_000_001, interestRate: .0451, termWeeks: 13, remainingWeeks: 13, status: 'active', originatedWeek: 1, lastPaymentWeek: 0, missedPayments: 0 });
    g.companyDebt += 1_000_001;
    for (let week = 0; week < 3; week++) { g.week += 1; realEstate.processWeek(engine); realEstate.processMarketWeek(engine); }
    const KINDS = ['negotiatePropertyPrice', 'property-depreciation', 'property-rent', 'property-maintenance', 'property-collateral-interest', 'property-collateral-principal'];
    const rows = rowsSince(g, count, row => KINDS.includes(row.sourceType) || row.sourceType === 'property-market-event');
    for (const kind of KINDS) assert.ok(rows.some(row => row.sourceType === kind), `R3a scenario posts ${kind}`);
    assert.equal(rows.find(row => row.sourceType === 'property-depreciation').amount, 770, 'ceil((1,000,001 − ceil(1,000,001 × .2)) / 1040)');
    const first = [...rows.filter(row => row.sourceType.startsWith('property-collateral-')).slice(0, 2)].map(row => row.amount);
    assert.deepEqual(first, [868, 76_923], 'the payment is rounded once; interest is the charge, principal the remainder');
    const loan = g.realEstate.loans.find(row => row.loanID === 'r3a-loan');
    const state = { companyCash: g.companyCash, companyDebt: g.companyDebt, loanOutstanding: loan.outstandingPrincipal, landBook: x.landBookValue, buildingBook: x.buildingBookValue, repairReserve: x.repairReserve };
    // A loan from a save made before R3a-1 can carry a fractional balance: its final instalment pays that balance exactly
    // (§3.5) instead of leaving a residue that keeps accruing ¥1 of interest.
    g.realEstate.loans.push({ loanID: 'r3a-legacy', propertyID: property.id, owner: 'company', principal: 10_000.3, outstandingPrincipal: 10_000.3, interestRate: .045, termWeeks: 1, remainingWeeks: 1, status: 'active', originatedWeek: 1, lastPaymentWeek: 0, missedPayments: 0 });
    g.week += 1;
    const legacy = [...realEstate.processLoans(engine, g.week)].find(row => row.loanID === 'r3a-legacy');
    assert.deepEqual([legacy.interest, legacy.principal, legacy.status], [9, 10_000.3, 'paid'], 'the final instalment clears a fractional legacy balance');
    return { rows, state };
  } },
  { slice: 'R3a', label: 'company real-estate finance: mortgage refinance, prepayment, partial payment, specialist loan service/refinance, agency credit line', run() {
    const { engine, modules } = newGame(1701), g = engine.g;
    const [mortgaged, secured] = g.properties.filter(p => !p.owner && p.buildingType);
    for (const p of [mortgaged, secured]) Object.assign(p, { owner: 'company', purchasePrice: 100_000_000, marketValue: 100_000_003, value: 100_000_003 });
    modules.realEstate.ensure(g);
    const count = g.finance.transactions.length;
    // Mortgage: target ceil(100,000,003 × .65), fee ceil(target × .012); net derived.
    assert.deepEqual({ ...engine.refinancePropertyMortgage(mortgaged.id, 'fixed') }, { oldBalance: 0, newBalance: 65_000_002, fee: 780_001, netProceeds: 64_220_001 });
    // A week with ¥1 of cash: the interest charge is paid first and the unpaid rest is capitalised.
    const cash = g.companyCash;
    g.week += 1; g.companyCash = 1; modules.realEstateMortgageRefinancing.processWeek(engine); g.companyCash += cash;
    g.week += 1; modules.realEstateMortgageRefinancing.processWeek(engine);
    assert.equal(engine.prepayPropertyMortgage(mortgaged.id, 1234.3), 1235);
    // The 13-week cash forecast reserves exactly the whole-yen payments the writer will make (the mortgage is the only loan here).
    const forecast = modules.finance.buildStatements(g, '13').forecast.rows;
    let balance = mortgaged.mortgageBalance, left = mortgaged.mortgageRemainingWeeks, expected = 0;
    for (let week = 0; week < 13; week++) { const due = modules.realEstateMortgageRefinancing.scheduledPayment(balance, .032, left); expected += due.due; balance -= due.principal; left -= 1; }
    assert.equal(forecast.reduce((sum, row) => sum + row.debtRepayment + row.interest, 0), expected, 'the forecast follows the mortgage schedule');
    // Specialist loan: principal ceil(10,000,001.3); prepayment ceil(1234.3); refinance fee ceil(payoff × .015).
    secured.realEstate.monthlyRent = 5_000_000;
    const loan = engine.borrowAgainstProperty(secured.id, 10_000_001.3, { spread: .0251, termWeeks: 53 });
    assert.ok(loan && loan.originalPrincipal === 10_000_002);
    assert.equal(engine.prepayRealEstateLoan(loan.id, 1234.3), true);
    g.week += 1; modules.realEstateCompleteCycle.processLoans(g);
    const fresh = engine.refinanceRealEstateLoan(loan.id, { spread: .0251, termWeeks: 53 });
    assert.ok(fresh, 'the specialist loan is refinanced');
    // Agency credit line: a public draw and repayment round the request up.
    assert.equal(modules.realEstateAgencyCreditLine.draw(g, 1234.3), 1235);
    assert.equal(modules.realEstateAgencyCreditLine.repay(g, 1000.4), 1001);
    const SOURCES = new Set(['propertyMortgage', 'propertySecuredLoan', 'realEstateAgencyCreditLine']);
    const rows = rowsSince(g, count, row => SOURCES.has(row.sourceType));
    for (const kind of ['propertyMortgage:debtBorrowing', 'propertyMortgage:interestExpense', 'propertyMortgage:debtRepayment', 'propertySecuredLoan:debtBorrowing', 'propertySecuredLoan:debtRepayment', 'propertySecuredLoan:interestExpense', 'propertySecuredLoan:otherOperating', 'realEstateAgencyCreditLine:debtBorrowing', 'realEstateAgencyCreditLine:debtRepayment'])
      assert.ok(rows.some(row => `${row.sourceType}:${row.category}` === kind), `R3a finance scenario posts ${kind}`);
    const mortgageLoan = g.finance.loans.find(row => row.loanID === `property-mortgage-${mortgaged.id}`);
    const state = { companyCash: g.companyCash, companyDebt: g.companyDebt, mortgageBalance: mortgaged.mortgageBalance, mortgageInterestPaid: mortgaged.mortgageInterestPaid, mortgagePrincipalPaid: mortgaged.mortgagePrincipalPaid, mortgageForecastPrincipal: mortgageLoan.weeklyPrincipalPayment, specialistBalance: fresh.balance, specialistPayment: fresh.weeklyPayment };
    // Saves made before R3a-2 can carry a fractional balance: the final instalment pays it exactly (§3.5) and the loan ends.
    Object.assign(mortgaged, { mortgageBalance: 10_000.3, mortgageRemainingWeeks: 1 });
    Object.assign(fresh, { balance: 10_000.3, weeksRemaining: 1 });
    g.week += 1; modules.realEstateMortgageRefinancing.processWeek(engine); modules.realEstateCompleteCycle.processLoans(g);
    assert.deepEqual([mortgaged.mortgageBalance, fresh.balance, fresh.status], [0, 0, 'paid'], 'the final instalments clear fractional legacy balances');
    return { rows, state };
  } },
  { slice: 'R3a', label: 'company real-estate projects and disposal: development, insurance, property tax, redevelopment write-off, sale', run() {
    const { engine, modules } = newGame(1801), g = engine.g;
    const [developed, redeveloped, sold] = g.properties.filter(p => !p.owner && p.buildingType);
    for (const p of [developed, redeveloped, sold]) Object.assign(p, { owner: 'company', purchasePrice: 100_000_000, marketValue: 100_000_003, value: 100_000_003 });
    modules.realEstate.ensure(g);
    for (const p of [developed, redeveloped, sold]) Object.assign(p.realEstate, { landBookValue: 40_000_001, buildingBookValue: 60_000_000, buildingOriginalCost: 60_000_000 });
    const count = g.finance.transactions.length;
    // Development: contract ceil(1,000,000.3), deposit ceil(15%), each weekly instalment ceil(remaining / weeks left).
    assert.ok(engine.startPropertyDevelopment(developed.id, 'renovation', { totalCost: 1_000_000.3, durationWeeks: 7 }));
    assert.ok(engine.buyPropertyInsurance(developed.id, { premiumPerWeek: 1000.3 }));
    for (let week = 0; week < 2; week++) { g.week += 1; modules.realEstateDevelopment.processWeek(engine); }
    const project = modules.realEstateDevelopment.ensure(g).projects[0];
    assert.deepEqual([project.totalCost, project.paidCost], [1_000_001, 150_001 + 141_667 * 2]);
    // Redevelopment: the quoted cost is the cost paid, and a cancellation writes off exactly that.
    const redevelopment = engine.startPropertyRedevelopment(redeveloped.id, Object.keys(modules.realEstateRedevelopmentProjects.PROJECTS)[0]);
    assert.ok(redevelopment && Number.isSafeInteger(redevelopment.cost));
    assert.equal(engine.cancelPropertyRedevelopment(redeveloped.id), true);
    // Sale: gross and fees round up once; net and gain are derived.
    const sale = engine.settlePropertyDisposition({ propertyID: sold.id, reason: 'voluntary-sale', grossSalePrice: 90_000_000.3, fees: 2_000_000.3, saleWeek: g.week });
    assert.deepEqual([sale.salePrice, sale.fee, sale.net, sale.gain], [90_000_001, 2_000_001, 88_000_000, -12_000_001]);
    const KINDS = ['property-development', 'property-insurance', 'property-tax', 'property-tax-payment', 'property-redevelopment-capex', 'property-redevelopment-write-off', 'property-disposition', 'property-disposition-fee'];
    const rows = rowsSince(g, count, row => KINDS.includes(row.sourceType));
    for (const kind of KINDS) assert.ok(rows.some(row => row.sourceType === kind), `R3a projects scenario posts ${kind}`);
    assert.equal(rows.find(row => row.sourceType === 'property-tax').amount, 23_077, 'ceil(100,000,001 × 1.2% / 52)');
    return { rows, state: { companyCash: g.companyCash, paidCost: project.paidCost, developedBuildingBook: developed.realEstate.buildingBookValue, redevelopmentSpent: redeveloped.redevelopmentSpentTotal } };
  } },
  { slice: 'R3b', label: 'tenant contracts: signing, weekly rent, complaints, renewal concession, listing and brokerage', run() {
    const { engine, modules } = newGame(1901), g = engine.g;
    const [leased, listed] = g.properties.filter(p => !p.owner && p.buildingType);
    for (const p of [leased, listed]) Object.assign(p, { owner: 'company', purchasePrice: 100_000_000, marketValue: 100_000_003, value: 100_000_003 });
    modules.realEstate.ensure(g);
    for (const p of [leased, listed]) Object.assign(p.realEstate, { landBookValue: 40_000_001, buildingBookValue: 60_000_000, buildingOriginalCost: 60_000_000, monthlyRent: 333_333.3, rentalEnabled: true, occupancy: .9, condition: 1 });
    const count = g.finance.transactions.length;
    // The quoted rent and deposit are the amounts contracted and received.
    const quote = [...engine.getPropertyTenantQuotes(leased.id)].find(q => q.profileID === 'growth');
    assert.deepEqual([quote.monthlyRent, quote.deposit], [350_000, 350_000], 'ceil(333,333.3 × 1.05) and one month of deposit');
    const contract = engine.signPropertyTenant(leased.id, 'growth');
    assert.equal(contract.depositBalance, 350_000);
    for (let week = 0; week < 3; week++) { g.week += 1; modules.realEstateTenantContracts.processWeek(engine); }
    const live = engine.getPropertyTenantContract(leased.id);
    live.openComplaints = 2;
    assert.ok(engine.resolvePropertyTenantComplaints(leased.id), 'complaint cost ceil(max(30,000, rent × .2 × 2))');
    // The renewal quote and the renewal actually agreed use the same whole-yen amounts.
    live.expiresWeek = g.week + 5; // renewal options open in the last 13 weeks of the term
    const option = [...engine.getPropertyTenantRenewalOptions(leased.id)].find(x => x.id === 'retention');
    const renewal = engine.offerPropertyTenantRenewal(leased.id, 'retention');
    if (renewal && renewal.accepted) assert.equal(engine.getPropertyTenantContract(leased.id).monthlyRent, option.newMonthlyRent);
    assert.ok(Number.isSafeInteger(option.newMonthlyRent) && Number.isSafeInteger(option.concession));
    // Listing with an agency: the brokerage fee on the new contract is ceil(rent × .5).
    assert.ok(engine.startPropertyTenantListing(listed.id, 'agency'));
    for (let week = 0; week < 3; week++) { g.week += 1; modules.realEstateTenantLeasing.processWeek(engine); }
    const application = [...engine.getPropertyTenantApplications(listed.id)][0];
    assert.ok(application, 'the listing produces an applicant');
    const signed = engine.approvePropertyTenantApplication(application.applicationID);
    assert.ok(signed && Number.isSafeInteger(signed.brokerageFee) && signed.brokerageFee > 0);
    const KINDS = ['property-tenant-deposit', 'property-tenant-rent', 'property-tenant-complaint-resolution', 'property-tenant-marketing', 'property-tenant-brokerage'];
    const rows = rowsSince(g, count, row => KINDS.includes(row.sourceType) || row.sourceType === 'property-tenant-renewal-concession');
    for (const kind of KINDS) assert.ok(rows.some(row => row.sourceType === kind), `R3b scenario posts ${kind}`);
    assert.equal(rows.find(row => row.sourceType === 'property-tenant-rent').amount, 72_498, 'ceil(350,000 / 4.345 × .9)');
    return { rows, state: { companyCash: g.companyCash, monthlyRent: live.monthlyRent, depositBalance: live.depositBalance, rentCollected: live.rentCollectedTotal, arrears: live.arrears, brokerageFee: signed.brokerageFee } };
  } },
  { slice: 'R3b', label: 'tenant collections, rent guarantee and security deposit settlement', run() {
    const { engine, modules } = newGame(1902), g = engine.g;
    const [leased] = g.properties.filter(p => !p.owner && p.buildingType);
    Object.assign(leased, { owner: 'company', purchasePrice: 100_000_000, marketValue: 100_000_003, value: 100_000_003 });
    modules.realEstate.ensure(g);
    Object.assign(leased.realEstate, { landBookValue: 40_000_001, buildingBookValue: 60_000_000, buildingOriginalCost: 60_000_000, monthlyRent: 333_333.3, rentalEnabled: true, occupancy: .9, condition: 1 });
    assert.ok(engine.signPropertyTenant(leased.id, 'growth'));
    const contract = engine.getPropertyTenantContract(leased.id);
    // Whole-yen balances; the amounts derived from them carry fractions before rounding.
    Object.assign(contract, { monthlyRent: 333_337, arrears: 123_457, missedWeeks: 1 });
    const count = g.finance.transactions.length;
    // Guarantee: weekly premium ceil(333,337 × .011); a claim pays min(ceil(arrears × .75), limit, arrears).
    assert.ok(engine.setPropertyRentGuarantee(leased.id, 'standard'));
    g.week += 1; modules.realEstateRentGuarantee.processWeek(engine);
    const claim = engine.claimPropertyRentGuarantee(leased.id);
    assert.ok(claim, 'the guarantee pays the arrears claim');
    // Collections: a legal action costs its whole constant; any recovery is min(ceil(arrears × rate), arrears).
    assert.ok(engine.collectPropertyTenantArrears(leased.id, 'legal'));
    // Security deposit: the half-month policy sets ceil(333,337 × .5); settlement applies min(arrears, held).
    assert.ok(engine.setPropertySecurityDeposit(leased.id, 'premium'));
    assert.equal(engine.getPropertyTenantContract(leased.id).securityDepositHeld, 166_669);
    engine.getPropertyTenantContract(leased.id).status = 'ended'; // the deposit is settled when the tenancy ends
    assert.ok(engine.settlePropertySecurityDeposit(leased.id));
    const KINDS = ['property-rent-guarantee-premium', 'property-rent-guarantee', 'property-tenant-collection'];
    const rows = rowsSince(g, count, row => KINDS.includes(row.sourceType) || ['property-tenant-recovery', 'property-security-deposit'].includes(row.sourceType));
    for (const kind of KINDS) assert.ok(rows.some(row => row.sourceType === kind), `R3b collections scenario posts ${kind}`);
    assert.equal(rows.find(row => row.sourceType === 'property-rent-guarantee-premium').amount, 3_667, 'ceil(333,337 × .011)');
    const after = contract;
    return { rows, state: { companyCash: g.companyCash, arrears: after.arrears, guaranteePayout: after.guaranteePayoutTotal, premiumPaid: after.guaranteePremiumPaid, depositApplied: after.securityDepositApplied, depositReturned: after.securityDepositReturned } };
  } },
  { slice: 'R4a', label: 'personal real estate: corp account, property tax, redevelopment, short-term letting, long-let NOI and sale', ledger: false, run() {
    const { engine, modules } = newGame(2001), g = engine.g;
    assert.ok(engine.buyPersonalRealEstate('studio-tokyo'));
    assert.ok(engine.buyPersonalRealEstate('commercial-osaka'));
    const [studio, osaka] = g.personalRealEstateHoldings.filter(x => x.status === 'owned');
    // Valuations and market rents drift to fractions; every amount settled from them is rounded up.
    Object.assign(studio, { currentValue: 18_000_000.7, weeklyRent: 31_000.4 });
    Object.assign(osaka, { currentValue: 65_000_000.3, weeklyRent: 106_000.6 });
    // Corp: whole setup cost; a dividend request rounds up and is capped at the corp's cash.
    assert.ok(engine.establishPersonalRealEstateCorp());
    assert.ok(engine.contributePersonalRealEstateToCorp(osaka.assetID));
    modules.personalRealEstateCorp.creditOwnerAccount(g, osaka, 1_000_000);
    assert.ok(engine.withdrawPersonalRealEstateCorpDividend(12_345.6));
    const corp = modules.personalRealEstateCorp.ensure(g);
    assert.equal(corp.withdrawnTotal, 12_346, 'ceil(12,345.6)');
    // Property tax: instalment = ceil(ceil(65,000,000.3 × .014) / 4), debited from the corp.
    g.week = osaka.purchasedWeek + 13;
    modules.personalRealEstateTaxes.processWeek(engine);
    assert.equal(osaka.propertyTaxPaid, Math.ceil(Math.ceil(65_000_000.3 * .014) / 4));
    // Redevelopment: cost ceil(value × rate); book value steps up to ceil(valuation) plus the cost.
    const [quote] = engine.getPersonalRealEstateRedevelopmentProjects(studio.assetID);
    assert.ok(engine.startPersonalRealEstateRedevelopment(studio.assetID, quote.id));
    modules.personalRealEstateRedevelopment.complete(studio);
    // Short-term letting: conversion cost, gross and expense are rounded up; NOI is their difference.
    assert.ok(engine.switchPersonalRealEstateRentalMode(studio.assetID, 'short'));
    modules.personalRealEstateShortTerm.processWeek(engine, studio);
    const personal = { personalCash: g.personalCash, corpCash: corp.cash, corpWithdrawn: corp.withdrawnTotal, taxPaid: osaka.propertyTaxPaid, taxArrears: osaka.propertyTaxArrears, redevelopmentSpent: studio.redevelopmentSpentTotal, studioBook: studio.bookValue, conversionPaid: studio.shortTermConversionPaid, shortGross: studio.rentalOps.lastGrossRent, shortExpense: studio.rentalOps.lastOperatingExpense, shortNOI: studio.rentalOps.lastNOI };
    // Sale: the price is ceil(valuation) and the whole net proceeds land in personal cash.
    const before = g.personalCash;
    assert.ok(engine.sellPersonalRealEstate(studio.assetID));
    assert.equal(studio.salePrice, Math.ceil(studio.currentValue));
    // Long-let week (corp-owned): the contract rent and the week's expense are rounded up, so the corp's NOI credit is whole.
    Object.assign(osaka.rentalOps, { occupancyStatus: 'occupied', contractWeeklyRent: 106_001, lastProcessedWeek: -1 });
    const count = g.finance.transactions.length;
    assert.equal(engine.advanceWeek(false), true);
    const rows = rowsSince(g, count, row => /personal/i.test(String(row.sourceType || '')));
    return { rows, state: { ...personal, saleProceeds: g.personalCash - before, longGross: osaka.rentalOps.lastGrossRent, longExpense: osaka.rentalOps.lastOperatingExpense, longNOI: osaka.rentalOps.lastNOI, corpCashAfterWeek: corp.cash } };
  } },
  { slice: 'R4b', label: 'personal mortgage: borrow, weekly service, prepayment and foreclosure', ledger: false, run() {
    const { engine, modules } = newGame(2101), g = engine.g, mortgage = modules.personalRealEstateMortgage;
    assert.ok(engine.buyPersonalRealEstate('studio-tokyo'));
    assert.ok(engine.buyPersonalRealEstate('commercial-osaka'));
    const [studio, osaka] = g.personalRealEstateHoldings.filter(x => x.status === 'owned');
    Object.assign(studio, { currentValue: 18_000_000.7 });
    Object.assign(osaka, { currentValue: 65_000_000.3 });
    const count = g.finance.transactions.length;
    // Borrow: ceiling = ceil(value × LTV) and fee = ceil(available × rate).
    assert.ok(engine.borrowPersonalRealEstateMortgage(studio.assetID, 'fixed'));
    assert.equal(studio.mortgageBalance, Math.ceil(18_000_000.7 * .6));
    assert.equal(studio.mortgageFeePaid, Math.ceil(studio.mortgageBalance * .012));
    // Weekly service: the payment is rounded up once; interest is the charge, principal the remainder.
    g.week += 1;
    const [serviced] = mortgage.processWeek(engine);
    assert.ok(serviced && !serviced.foreclosed && serviced.interest > 0 && serviced.principal > 0, 'the week is serviced');
    // Prepayment: the request rounds up and is capped at the balance.
    assert.ok(engine.prepayPersonalRealEstateMortgage(studio.assetID, 123_456.4));
    assert.equal(studio.mortgagePrincipalPaid, serviced.principal + 123_457);
    // Foreclosure: the forced sale settles at ceil(value × .85) and the net lands in personal cash.
    assert.ok(engine.borrowPersonalRealEstateMortgage(osaka.assetID, 'variable'));
    mortgage.foreclose(engine, osaka);
    assert.equal(osaka.salePrice, Math.ceil(65_000_000.3 * .85));
    const rows = rowsSince(g, count, () => true);
    return { rows, state: { personalCash: g.personalCash, personalDebt: g.personalDebt, balance: studio.mortgageBalance, interestPaid: studio.mortgageInterestPaid, principalPaid: studio.mortgagePrincipalPaid, feePaid: studio.mortgageFeePaid, osakaFee: osaka.mortgageFeePaid, foreclosureSale: osaka.salePrice } };
  } },
  { slice: 'R4c', label: 'personal stock margin: borrow, weekly interest, prepayment and forced liquidation', ledger: false, run() {
    const { engine, modules } = newGame(2201), g = engine.g, margin = modules.personalStockMargin;
    const [stock] = g.market;
    Object.assign(stock, { price: 1_234.57, issuedShares: 100_000_000 });
    g.personalStocks = { [stock.id]: { qty: 10_001, avg: 1_000.3 } };
    const count = g.finance.transactions.length;
    // Borrow: ceiling = ceil(portfolio value × LTV).
    assert.ok(engine.borrowPersonalStockMargin('standard'));
    assert.equal(margin.balanceOf(g), Math.ceil(1_234.57 * 10_001 * .5));
    // Weekly interest is ceil(balance × rate / 52), paid from personal cash.
    g.week += 1;
    const week = margin.processWeek(engine);
    assert.equal(week.interest, Math.ceil(margin.balanceOf(g) * margin.annualRateFor('standard') / 52));
    // Prepayment: the request rounds up and is capped at the balance.
    const before = margin.balanceOf(g);
    assert.ok(engine.prepayPersonalStockMargin(12_345.6));
    assert.equal(before - margin.balanceOf(g), 12_346);
    // A price collapse forces liquidation; sale proceeds are whole and the shortfall moves to personal debt.
    stock.price = 300.33;
    g.personalCash = 0;
    g.week += 1;
    const forced = margin.processWeek(engine);
    assert.ok(forced.liquidated, 'the margin call liquidates the holding');
    const loan = margin.ensure(g);
    const rows = rowsSince(g, count, () => true);
    return { rows, state: { personalCash: g.personalCash, personalDebt: g.personalDebt, balance: loan.balance, interestPaid: loan.interestPaid, interestCapitalized: loan.interestCapitalized, raised: forced.raised, repaid: forced.repaid, shortfall: forced.shortfall } };
  } },
  { slice: 'R4d-1', label: 'personal luxury and investment redemptions, generic borrow/repay and personal debt interest', run() {
    const { engine } = newGame(2301), g = engine.g;
    const count = g.finance.transactions.length;
    // Luxury: a sale settles at ceil(value × .95).
    assert.ok(engine.buyLuxury('watch'));
    const [watch] = g.luxuryAssets;
    watch.currentValue = 6_500_000.3;
    let before = g.personalCash;
    assert.ok(engine.sellLuxury(watch.id));
    assert.equal(g.personalCash - before, Math.ceil(6_500_000.3 * .95));
    // Personal investment: the amount rounds up; a redemption is ceil(value) less ceil(carry).
    assert.ok(engine.buyPersonalInvestment('vc-fund', 15_000_000.4));
    const [fund] = g.personalInvestments;
    assert.equal(fund.principal, 15_000_001);
    fund.currentValue = 18_123_456.7;
    before = g.personalCash;
    assert.ok(engine.sellPersonalInvestment(fund.id));
    assert.equal(g.personalCash - before, Math.ceil(18_123_456.7) - Math.ceil((18_123_456.7 - 15_000_001) * .2));
    // Generic borrow and repay round the request up, for both accounts.
    assert.ok(engine.borrow(1_234_567.2, 'company'));
    assert.ok(engine.repay(234_567.2, 'company'));
    assert.ok(engine.borrow(2_345_678.1, 'personal'));
    assert.equal(g.personalDebt, 2_345_679);
    assert.ok(engine.repay(345_678.1, 'personal'));
    // A request at a fractional credit limit borrows the whole yen below it.
    const room = engine.personalCreditLimit() - g.personalDebt;
    assert.ok(engine.borrow(room, 'personal'));
    assert.ok(g.personalDebt <= engine.personalCreditLimit());
    const rows = rowsSince(g, count, row => ['borrow', 'repay'].includes(row.sourceType) || /debt/i.test(String(row.category || '')));
    return { rows, state: { personalCash: g.personalCash, personalDebt: g.personalDebt, companyCash: g.companyCash, companyDebt: g.companyDebt } };
  } },
  { slice: 'R4d-2', label: 'personal branches of property purchase, startup investment, IPO founder sale and company sale', run() {
    const { engine } = newGame(2401), g = engine.g;
    const count = g.finance.transactions.length;
    // Property purchase (either owner) pays ceil(listed price).
    const [land, lot] = g.properties.filter(p => !p.owner);
    land.price = 12_345_678.4; lot.price = 23_456_789.6;
    assert.ok(engine.buyProperty(land.id, 'personal'));
    assert.equal(land.purchasePrice, 12_345_679);
    assert.ok(engine.buyProperty(lot.id, 'company'));
    // Startup investment rounds the amount up.
    const startup = g.startups.find(s => s.alive);
    assert.ok(startup, 'a live startup exists');
    assert.ok(engine.investStartup(startup.id, Math.max(startup.minTicket, 10_000_000) + .3, 'personal'));
    // IPO: company raise and founder sale are each rounded up.
    Object.assign(g, { hasHeadOffice: true, boardEstablished: true });
    g.departments.accounting = true;
    for (let week = 1; week <= 52; week += 1) g.reports.push({ week, profit: 1_000_000, revenue: 0, expenses: 0 });
    const ipoBefore = g.personalCash;
    assert.ok(engine.executeIPO('東証グロース', 0), 'the IPO executes');
    const founderSale = g.personalCash - ipoBefore;
    // Company sale: founder proceeds round up.
    const saleBefore = g.personalCash;
    assert.ok(engine.completeCompanySale({ exitPrice: 3_000_000_000.5, founderProceeds: 1_234_567_890.2, showEnding: false }));
    assert.equal(g.personalCash - saleBefore, 1_234_567_891);
    const rows = rowsSince(g, count, row => ['buyProperty', 'investStartup', 'parentCompanyIPO'].includes(row.sourceType));
    return { rows, state: { personalCash: g.personalCash, companyCash: g.companyCash, landPurchase: land.purchasePrice, lotPurchase: lot.purchasePrice, founderSale, invested: startup.totalInvestedPersonal } };
  } },
  { slice: 'R5a', label: 'bank loan borrowing and weekly service', run() {
    const { engine, modules } = newGame(2501), g = engine.g, bank = modules.bankLoansCovenants;
    const count = g.finance.transactions.length;
    // Borrowing rounds the request up; the quoted weekly payment and the covenant cash floor are whole.
    const quote = bank.quote(g, 3_333_333.3, 52);
    assert.equal(quote.principal, 3_333_334);
    assert.ok(Number.isSafeInteger(quote.weeklyPayment) && Number.isSafeInteger(quote.covenants.minCash));
    assert.ok(bank.borrow(g, 3_333_333.3, 52), 'the bank loan is drawn');
    const loan = g.finance.loans.find(l => l.sourceType === 'bankLoansCovenants');
    const expectedInterest = Math.ceil(loan.outstandingPrincipal * loan.interestRate / 52);
    assert.equal(quote.weeklyPayment, Math.ceil(3_333_334 * (1 + quote.annualRate * 52 / 52) / 52));
    // Weekly service: interest = ceil(balance × rate / 52) is the charge, principal the rest of the payment.
    g.week += 1;
    bank.service(g);
    const rows = rowsSince(g, count, row => ['bankLoansCovenants'].includes(row.sourceType));
    assert.ok(rows.some(row => row.category === 'interestExpense') && rows.some(row => row.category === 'debtRepayment'), 'a week is serviced');
    assert.equal(rows.find(row => row.category === 'interestExpense').amount, expectedInterest, 'interest rounds up');
    return { rows, state: { companyCash: g.companyCash, companyDebt: g.companyDebt } };
  } },
  { slice: 'R5b', label: 'debt maturity principal and refinancing fee', run() {
    const { engine, modules } = newGame(2601), g = engine.g, debtService = modules.playerDebtService;
    assert.ok(engine.borrow(33_333_331, 'company'));
    const count = g.finance.transactions.length;
    const r = debtService.refinancingState(engine);
    r.nextMaturityWeek = g.week;
    const debt = g.companyDebt;
    debtService.processDebtMaturity(engine);
    const rows = rowsSince(g, count, row => row.sourceType === 'debt-refinancing');
    const principal = rows.find(row => row.category === 'debtRepayment');
    assert.ok(principal, 'the maturity repays principal');
    assert.equal(principal.amount, Math.min(debt, Math.ceil(debt * r.principalShare)), 'required principal rounds up');
    return { rows, state: { companyCash: g.companyCash, companyDebt: g.companyDebt } };
  } },
  { slice: 'R5c-1', label: 'share buyback at a fractional price', run() {
    const { engine, modules } = newGame(2701), g = engine.g;
    Object.assign(g, { publicCompany: true, sharesOut: 1_000_000, founderShares: 300_000, treasuryBuybackShares: 0, competitorOwnedRatio: 0, stockPrice: 123.4567, ticker: 'YENC' });
    g.market = g.market.filter(row => row.id !== 'YENC');
    g.market.push({ id: 'YENC', name: g.companyName, sector: 'コングロマリット', price: 123.4567, previous: 123.4567, dividendYield: 0, volatility: 0, trend: 0, marketCap: 123.4567 * 1_000_000, per: 20, pbr: 2, issuedShares: 1_000_000, dividendPerShare: 0, shareholders: {} });
    engine.updateOwnershipRatios();
    const count = g.finance.transactions.length;
    assert.equal(engine.buybackOwnShares(1_000_000), true);
    const rows = rowsSince(g, count, row => row.sourceType === 'shareholderReturns');
    const qty = Math.floor(1_000_000 / 123.4567);
    assert.equal(rows[0].amount, Math.ceil(qty * 123.4567), 'cost = ceil(quantity × price)');
    assert.equal(modules.finance.buybackReconciliationStatus(g).ok, true);
    return { rows, state: { companyCash: g.companyCash, treasuryBook: g.finance.balances.treasuryStock } };
  } },
  { slice: 'R5c-2', label: 'quarterly dividend gross and founder net', run() {
    const { engine, modules } = newGame(2801), g = engine.g, finance = modules.finance;
    Object.assign(g, { week: 12, publicCompany: true, sharesOut: 1_000_000, founderShares: 300_000, treasuryBuybackShares: 100_000, stockPrice: 100, ticker: 'YEND' });
    g.market = g.market.filter(row => row.id !== 'YEND');
    g.market.push({ id: 'YEND', name: g.companyName, sector: 'コングロマリット', price: 100, previous: 100, dividendYield: 0, volatility: 0, trend: 0, marketCap: 100_000_000, per: 20, pbr: 2, issuedShares: 1_000_000, dividendPerShare: 0, shareholders: {} });
    engine.updateOwnershipRatios();
    g.finance = finance.defaultFinanceState(g); g.finance.ledgerCoverageVersion = finance.LEDGER_COVERAGE_VERSION; finance.ensureFinance(g);
    const count = g.finance.transactions.length;
    assert.equal(engine.setDividend(.123456789), true);
    const personalBefore = g.personalCash;
    assert.equal(engine.advanceWeek(false), true);
    const row = g.finance.transactions.slice(count).find(t => t.category === 'dividend');
    assert.ok(row, 'the quarter pays a dividend');
    assert.equal(row.amount, Math.ceil(.123456789 * 900_000), 'gross = ceil(per share × outstanding)');
    const d = row.dividendDistribution;
    assert.equal(d.personalNet, Math.min(Math.ceil(d.evidence.gross * d.founderRatio * .797), Math.floor(d.evidence.gross * d.founderRatio)));
    assert.equal(finance.dividendReconciliationStatus(g).ok, true);
    return { rows: [row], state: { founderNet: d.personalNet, payerReduction: d.payerReduction } };
  } },
  { slice: 'R3c-1', label: 'property insurance premium, incident loss and claim payout', run() {
    const { engine, modules } = newGame(3101), g = engine.g, insurance = modules.realEstatePropertyInsurance;
    const [prop] = g.properties.filter(p => !p.owner && p.buildingType);
    Object.assign(prop, { owner: 'company', marketValue: 123_456_789.3, value: 123_456_789.3, buildingCondition: 0 });
    modules.realEstate.ensure(g);
    assert.ok(engine.setPropertyInsurance(prop.id, 'basic'));
    const count = g.finance.transactions.length;
    // Run weeks until an incident lands and its claim is paid; every amount settles in whole yen.
    for (let week = g.week + 1; week <= g.week + 600 && !g.finance.transactions.slice(count).some(t => t.sourceType === 'property-insurance-payout'); week++) {
      g.week = week; insurance.processWeek(engine);
      if (prop.pendingInsuranceIncident) engine.claimPropertyInsurance(prop.id);
    }
    const KINDS = ['property-insurance-premium', 'property-insurance-loss', 'property-insurance-payout'];
    const rows = rowsSince(g, count, row => KINDS.includes(row.sourceType));
    for (const kind of KINDS) assert.ok(rows.some(row => row.sourceType === kind), `R3c-1 scenario posts ${kind}`);
    assert.equal(rows.find(row => row.sourceType === 'property-insurance-premium').amount, Math.ceil(123_456_789.3 * .00018), 'premium = ceil(value × rate)');
    return { rows, state: { companyCash: g.companyCash, premiumPaid: prop.insurancePremiumPaid, lossTotal: prop.insuranceLossTotal, payoutTotal: prop.insurancePayoutTotal } };
  } },
  { slice: 'R3c-2', label: 'property maintenance reserve, repair and management fee', run() {
    const { engine, modules } = newGame(3201), g = engine.g;
    const [prop] = g.properties.filter(p => !p.owner && p.buildingType);
    Object.assign(prop, { owner: 'company', marketValue: 123_456_789.3, value: 123_456_789.3, buildingCondition: 40 });
    modules.realEstate.ensure(g);
    assert.ok(engine.setPropertyMaintenancePolicy(prop.id, 'preventive'));
    assert.ok(engine.setPropertyManagementPlan(prop.id, 'standard'));
    const count = g.finance.transactions.length;
    g.week += 1;
    modules.realEstatePropertyMaintenance.processWeek(engine);
    modules.realEstatePropertyManagement.processWeek(engine);
    engine.repairProperty(prop.id);
    const KINDS = ['property-maintenance-reserve', 'property-management', 'property-maintenance-repair'];
    const rows = rowsSince(g, count, row => KINDS.includes(row.sourceType));
    for (const kind of KINDS) assert.ok(rows.some(row => row.sourceType === kind), `R3c-2 scenario posts ${kind}`);
    assert.equal(rows.find(row => row.sourceType === 'property-management').amount, Math.ceil(123_456_789.3 * .00012), 'fee = ceil(value × rate)');
    return { rows, state: { companyCash: g.companyCash, reserve: prop.maintenanceReserve, spent: prop.maintenanceSpentTotal, managementFee: prop.managementFeePaid } };
  } },
  { slice: 'R3c-3', label: 'safety inspection, risk mitigation install and weekly mitigation maintenance', run() {
    const { engine, modules } = newGame(3301), g = engine.g;
    const [prop] = g.properties.filter(p => !p.owner && p.buildingType);
    Object.assign(prop, { owner: 'company', marketValue: 123_456_789.3, value: 123_456_789.3 });
    modules.realEstate.ensure(g);
    Object.assign(prop.realEstate, { buildingValue: 198_765_432.1 });
    const count = g.finance.transactions.length;
    assert.ok(engine.inspectPropertySafety(prop.id, 'standard'));
    assert.ok(engine.installPropertyMitigation(prop.id, 'flood_barrier'));
    g.week += 1;
    modules.realEstateRiskMitigation.processWeek(engine);
    const KINDS = ['property-safety-inspection', 'property-mitigation', 'property-mitigation-maintenance'];
    const rows = rowsSince(g, count, row => KINDS.includes(row.sourceType));
    for (const kind of KINDS) assert.ok(rows.some(row => row.sourceType === kind), `R3c-3 scenario posts ${kind}`);
    return { rows, state: { companyCash: g.companyCash } };
  } },
  { slice: 'R6d', label: 'group restructuring sale proceeds', run() {
    const { engine } = newGame(3401), g = engine.g;
    g.subsidiaries = [{ id: 'r6d-sale', name: 'R6d売却', ownership: 1, valuation: 123_456_787, carryingBookValue: 50_000_000, subsidiaryCash: 3_000_001, weeklyProfit: 10_000, growth: .02, risk: .2, status: 'active' }];
    engine.normalize();
    const count = g.finance.transactions.length;
    const sale = engine.groupRestructuringSalePreview('r6d-sale');
    assert.equal(sale.expectedSale, Math.ceil(123_456_787 * .92), 'proceeds = ceil(stake value × .92)');
    assert.notEqual(engine.executeGroupRestructuringSale('r6d-sale'), false);
    const rows = rowsSince(g, count, row => row.sourceType === 'groupRestructuringSale');
    assert.equal(rows.length, 1, 'the sale posts');
    return { rows, state: { companyCash: g.companyCash } };
  } },
  { slice: 'R6c', label: 'listed subsidiary secondary sale proceeds', run() {
    const { engine } = newGame(3501), g = engine.g;
    g.subsidiaries = [{ id: 'r6c-ipo', name: 'R6c上場', ownership: 1, valuation: 123_456_789, carryingBookValue: 50_000_000, subsidiaryCash: 3_000_001, weeklyProfit: 10_000, growth: .02, risk: .2, status: 'active', publicCompany: true }];
    engine.normalize();
    const count = g.finance.transactions.length;
    const view = engine.subsidiaryIPOSecondarySalePreview('r6c-ipo', .10);
    assert.equal(view.proceeds, Math.ceil(12_345_679 * .98), 'proceeds = ceil(gross × (1 − market discount))');
    assert.notEqual(engine.sellSubsidiaryIPOStake('r6c-ipo', .10), false);
    const rows = rowsSince(g, count, row => row.sourceType === 'sellSubsidiaryIPOStake');
    assert.equal(rows.length, 1, 'the sale posts');
    return { rows, state: { companyCash: g.companyCash } };
  } },
  { slice: 'R6a', label: 'M&A offer price and advisory fee', run() {
    const { engine, modules } = newGame(3601), g = engine.g;
    Object.assign(g, { companyCash: 2_000_000_000, stockPrice: 1000, sharesOut: 1_000_000 });
    g.departments.investment = { established: true };
    for (const role of ['CEO', 'CSO', 'CFO']) g.executives[role] = { role, skill: 90 };
    g.acquisitionTargets = [{ id: 'r6a-target', name: 'R6a買収先', domain: '物流', valuation: 100_000_000, sales: 80_000_000, operatingProfit: 9_000_000, growth: .08, risk: .18, synergy: .12, friendly: true, expiresWeek: g.week + 30 }];
    engine.normalize();
    assert.ok(engine.openMADealRoom('r6a-target'));
    const deal = g.maDealRooms.find(d => d.targetID === 'r6a-target');
    engine.advanceMADealRound(deal.id);
    assert.ok(engine.startMADueDiligence(deal.id, 'screening'));
    g.week += 1;
    modules.maDealRoom.processDealWeek(g, g.week);
    engine.advanceMADealRound(deal.id);
    const count = g.finance.transactions.length;
    assert.ok(engine.submitMAOffer(deal.id, { method: 'friendly', offerPrice: 150_000_123.4 }));
    assert.equal(deal.currentOffer.offerPrice, 150_000_124, 'the offer price rounds up');
    const rows = rowsSince(g, count, row => row.sourceType === 'maAdvisory');
    assert.equal(rows.length, 1, 'the advisory fee posts');
    assert.equal(rows[0].amount, Math.ceil(150_000_124 * .0015), 'advisory fee = ceil(price × 0.15%)');
    return { rows, state: { companyCash: g.companyCash } };
  } },
  { slice: 'R6b-1', label: 'PE exit waterfall, GP/LP split and carry', ledger: false, run() {
    const { engine, modules } = newGame(3701), g = engine.g, pf = modules.peFund;
    const fund = pf.createFund(g, { size: 1_000_000_000, gpCommit: 30_000_000, y0: g.week, terms: { fee: .02, carry: .2, hurdle: .08 } });
    const deal = { id: 'r6b1-deal', fundPortion: 200_000_000, coinvestPortion: 100_000_001, acquiredWeek: g.week - 104 };
    const count = g.finance.transactions.length, personal = g.personalCash;
    const s = pf.settleExitProceeds(g, fund, deal, 456_789_012.3, g.week);
    assert.equal(s.grossProceeds, 456_789_013, 'exit proceeds round up');
    assert.equal(s.fundShare + s.coinvestShare, s.grossProceeds, 'fund and co-invest shares add up to the proceeds');
    assert.equal(s.fundCarry, Math.ceil((s.fundShare - 200_000_000 - s.fundHurdleAmount) * .2), 'fund carry = ceil(excess over hurdle × carry)');
    assert.equal(s.distributedToFund, s.fundShare - s.fundCarry);
    assert.equal(fund.gpDistributed + fund.lpDistributed, s.distributedToFund, 'GP and LP distributions add up to the fund distribution');
    assert.equal(g.personalCash - personal, s.gpPrincipalAndGain + s.gpCarry, 'the GP receives exactly what the settlement previews');
    const rows = rowsSince(g, count, () => true);
    return { rows, state: { personalCash: g.personalCash, gpDistributed: fund.gpDistributed, lpDistributed: fund.lpDistributed, gpCarryPaid: fund.gpCarryPaid, fundCarry: s.fundCarry, coinvestCarry: s.coinvestCarry, returnedToCoinvestors: s.returnedToCoinvestors } };
  } },
  { slice: 'R6b-1', label: 'PE management fee and team payroll', run() {
    const { engine, modules } = newGame(3702), g = engine.g, pf = modules.peFund;
    const fund = pf.createFund(g, { size: 1_000_000_001, gpCommit: 0, y0: g.week, terms: { fee: .0183, carry: .2, hurdle: .08 } });
    assert.equal(pf.annualManagementFee(fund), Math.ceil(1_000_000_001 * .0183), 'annual fee = ceil(size × rate)');
    const count = g.finance.transactions.length;
    pf.processManagementFeePeriods(g, fund, fund.y0 + 52);
    const rows = rowsSince(g, count, row => row.sourceType === 'peManagementFee' || row.sourceType === 'peTeamPayroll');
    assert.ok(rows.some(row => row.sourceType === 'peManagementFee'), 'the management fee posts');
    return { rows, state: { companyCash: g.companyCash } };
  } },
  { slice: 'R6b-2', label: 'PE weekly portfolio result, lever spends and value-creation amounts', ledger: false, run() {
    const { engine, modules } = newGame(3801), g = engine.g, pf = modules.peFund, ops = modules.pePortfolioOperations;
    const count = g.finance.transactions.length;
    pf.recordExit(g, { exitType: 'buyout', realizedAmount: 200_000_000, investedAmount: 8_000_000, foundedWeek: 1, exitedWeek: 52, profitableWeekStreak: 260, employeeCount: 30 });
    const fund = pf.createFund(g, { size: 10_000_000_000, gpCommit: 0, terms: { fee: .02, carry: .2, hurdle: .08 }, y0: g.week });
    const deal = ops.acquirePillarCompany(g, fund.id, { businessID: 'gym', enterpriseValue: 1_234_567_891, useCoinvest: false, week: g.week });
    assert.ok(deal?.portfolioCompany, 'R6b-2 scenario acquires a portfolio company');
    const pc = deal.portfolioCompany;
    pc.cash = 2_000_000_000;
    assert.ok(ops.settlePortfolioOperatingWeek(deal, { week: pc.lastProcessedWeek + 1, profit: 12_345.6, revenue: 45_678.9 }));
    assert.equal(pc.weeklyProfit, 12_346, 'the weekly result rounds up once');
    const preview = ops.previewManagementAction(g, fund.id, deal.id, 'expandPortfolioStore');
    assert.equal(preview.cost, Math.ceil(1_234_567_891 * .05), 'expansion cost = ceil(EV × 5%)');
    const before = pc.cash;
    assert.ok(ops.expandPortfolioStore(g, fund.id, deal.id));
    assert.equal(before - pc.cash, preview.cost, 'the expansion spends what the preview shows');
    const vc = modules.peValueCreation, legacyDeal = { investedAmount: 123_456_701, currentValuation: 123_456_701.3, improvementScore: 90 };
    assert.equal(vc.initiativeCost(legacyDeal), Math.ceil(123_456_701 * .02), 'initiative cost = ceil(invested × 2%)');
    assert.equal(vc.weeklyRevenueFor(legacyDeal), Math.ceil(123_456_701 * .03), 'weekly revenue = ceil(invested × 3%)');
    const rows = rowsSince(g, count, () => true);
    return { rows, state: { portfolioCash: pc.cash, fundCash: fund.cash, weeklyRevenue: pc.weeklyRevenue, legacyWeeklyProfit: vc.weeklyProfitFor(legacyDeal), legacyExitValue: vc.exitValue(legacyDeal) } };
  } },
  { slice: 'R7a', label: 'founder capital injection during a cash crisis', run() {
    const { engine, modules } = newGame(3901), g = engine.g;
    Object.assign(g, { week: 2, companyCash: -1_000_000, personalCash: 10_000_000, companyCredit: 80 });
    modules.playerCrisis.evaluate(g);
    assert.equal(g.playerCrisis.status, 'distressed', 'R7a scenario starts in a cash crisis');
    const count = g.finance.transactions.length, personal = g.personalCash;
    assert.notEqual(engine.injectFounderCapital(1_234_567.4), false, 'the crisis allows a founder injection');
    assert.equal(personal - g.personalCash, 1_234_568, 'the injection request rounds up');
    const rows = rowsSince(g, count, () => true);
    return { rows, state: { companyCash: g.companyCash, personalCash: g.personalCash } };
  } },
  { slice: 'R7b', label: 'executive hiring bonus and weekly executive payroll', run() {
    const { engine, modules } = newGame(4001), g = engine.g, mod = modules.executivesDepartmentAssignments;
    mod.generate(g);
    const candidate = g.executiveManagement.candidates[0];
    candidate.salary = 123_456.7;
    const count = g.finance.transactions.length, cash = g.companyCash;
    assert.ok(mod.hire(g, candidate.id), 'R7b scenario hires an executive');
    assert.equal(cash - g.companyCash, Math.ceil(123_456.7) * 4, 'the hiring charge is four weeks of salary rounded up');
    const rows = rowsSince(g, count, () => true);
    return { rows, state: { companyCash: g.companyCash } };
  } },
];
for (const scenario of SCENARIOS) {
  const { rows, state = {} } = scenario.run();
  // Personal writers never post to the company ledger (company/personal separation), so a personal
  // scenario asserts that it posted no row and is checked through its state fields instead.
  if (scenario.ledger === false) assert.equal(rows.length, 0, `${scenario.slice} ${scenario.label}: personal writers post no company ledger row`);
  else assert.ok(rows.length > 0, `${scenario.slice} ${scenario.label}: scenario posts at least one row`);
  assert.ok(scenario.ledger !== false || Object.keys(state).length > 0, `${scenario.slice} ${scenario.label}: a personal scenario checks state`);
  for (const row of rows) assert.deepEqual(fractionalFields(row), [], `${scenario.slice} ${scenario.label}: ${row.category} ${row.sourceType} is whole yen`);
  for (const [key, value] of Object.entries(state)) assert.ok(Number.isSafeInteger(value), `${scenario.slice} ${scenario.label}: ${key}=${value} is whole yen`);
}

console.log(`PASS yen ceiling rounding guard: ${pending.size} pending file(s), ${SCENARIOS.length} migrated scenario(s)`);
