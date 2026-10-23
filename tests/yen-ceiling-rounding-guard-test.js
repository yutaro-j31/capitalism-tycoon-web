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
];
for (const scenario of SCENARIOS) {
  const { rows, state = {} } = scenario.run();
  assert.ok(rows.length > 0, `${scenario.slice} ${scenario.label}: scenario posts at least one row`);
  for (const row of rows) assert.deepEqual(fractionalFields(row), [], `${scenario.slice} ${scenario.label}: ${row.category} ${row.sourceType} is whole yen`);
  for (const [key, value] of Object.entries(state)) assert.ok(Number.isSafeInteger(value), `${scenario.slice} ${scenario.label}: ${key}=${value} is whole yen`);
}

console.log(`PASS yen ceiling rounding guard: ${pending.size} pending file(s), ${SCENARIOS.length} migrated scenario(s)`);
