'use strict';
// Whole-yen seeded full run (docs/economic-engine/YEN_CEILING_ROUNDING_CONTRACT.md §6, slice R9a).
// A new game on the full production runtime runs a fixed seed per founding route. Every ledger row
// it posts must be whole yen, and so must company and personal cash and debt after every week.
// Competitor and PE-rival money is NPC-internal and stays outside this check until R8b (§8).
// A second part loads a fractional pre-R9 state (§1.1): a capped payment and a fractional
// book-value disposal post the amounts as stored, state and ledger agree, and the books validate.
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const WEEKS = 104;
const CONTRIBUTION = 500_000_000;
const PERSONAL_FIXTURE_CASH = 1_500_000_000;
const ROUTES = Object.freeze([
  { businessID: 'ramen', seed: 0x91a00001 },
  { businessID: 'conveni', seed: 0x91a00002 },
  { businessID: 'gym', seed: 0x91a00003 },
  { businessID: 'realEstateAgency', seed: 0x91a00004 }
]);
const EFFECTS = ['amount', 'cashEffect', 'profitEffect', 'assetEffect', 'liabilityEffect', 'equityEffect'];
const BALANCES = ['companyCash', 'personalCash', 'companyDebt', 'personalDebt'];

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}
function fractionalFields(row) { return EFFECTS.filter(key => row[key] !== undefined && !Number.isSafeInteger(Number(row[key]))); }
assert.deepEqual(fractionalFields({ amount: 13, cashEffect: -13 }), []);
assert.deepEqual(fractionalFields({ amount: 12.3, cashEffect: -12.3 }), ['amount', 'cashEffect'], 'the row check rejects fractions');

function newGame(index, route) {
  const loaded = loadGame({ headless: true, random: lcg(0x91a10000 + index) });
  const engine = new loaded.engineModule.TycoonEngine();
  engine.configure({ playerName: `Yen ${route.businessID}`, companyName: `Yen ${route.businessID} Co`, difficulty: 'normal', scenario: 'free' });
  loaded.modules.simulationRng.reseed(engine.g, route.seed);
  return { loaded, engine };
}

// Rows are checked once, by identity, so that ledger archiving cannot hide or repeat a row.
function checkNewRows(g, seen, label) {
  let count = 0;
  for (const row of g.finance.transactions) {
    if (seen.has(row)) continue;
    seen.add(row);
    count++;
    assert.deepEqual(fractionalFields(row), [], `${label}: ${row.category} ${row.sourceType} ${row.sourceID || ''} is whole yen`);
  }
  return count;
}
function checkBalances(g, label) {
  for (const key of BALANCES) assert.ok(Number.isSafeInteger(Number(g[key] || 0)), `${label}: ${key}=${g[key]} is whole yen`);
}

const results = [];
for (let index = 0; index < ROUTES.length; index++) {
  const route = ROUTES[index];
  const { loaded, engine } = newGame(index, route), g = engine.g;
  const seen = new WeakSet();
  g.personalCash = PERSONAL_FIXTURE_CASH;
  checkBalances(g, `${route.businessID} start`);
  assert.equal(engine.contributeFounderCapital(CONTRIBUTION), true, `${route.businessID}: founder contribution`);
  const tenant = g.tenants.filter(row => !row.occupiedBy)
    .sort((a, b) => Number(b.traffic || 0) - Number(a.traffic || 0) || Number(a.deposit || 0) - Number(b.deposit || 0) || String(a.id).localeCompare(String(b.id)))[0];
  assert.ok(tenant, `${route.businessID}: a founding tenant`);
  assert.notEqual(engine.openStore({ tenantID: tenant.id, businessID: route.businessID, name: `${route.businessID} yen 1号店`, operatingHours: 3 }), false, `${route.businessID}: first store opens`);
  let rows = checkNewRows(g, seen, `${route.businessID} setup`);
  checkBalances(g, `${route.businessID} setup`);
  for (let week = 1; week <= WEEKS; week++) {
    assert.notEqual(engine.advanceWeek(false), false, `${route.businessID}: week ${week} advances`);
    const label = `${route.businessID} week ${week}`;
    rows += checkNewRows(g, seen, label);
    checkBalances(g, label);
  }
  const validation = loaded.modules.finance.validate(g);
  assert.equal(validation.ok, true, `${route.businessID}: finance.validate: ${(validation.errors || []).join(' / ')}`);
  assert.ok(rows > WEEKS, `${route.businessID}: the run posts ledger rows (${rows})`);
  results.push({ businessID: route.businessID, rows, finalCash: g.companyCash, finalDebt: g.companyDebt });
}

// Determinism: the same seed gives the same ledger.
{
  const run = () => {
    const { engine } = newGame(0, ROUTES[0]), g = engine.g;
    g.personalCash = PERSONAL_FIXTURE_CASH;
    engine.contributeFounderCapital(CONTRIBUTION);
    for (let week = 0; week < 8; week++) engine.advanceWeek(false);
    return JSON.stringify([g.companyCash, g.companyDebt, g.finance.transactions.map(row => [row.sourceType, row.amount, row.cashEffect])]);
  };
  assert.equal(run(), run(), 'two runs with the same seed post the same ledger');
}

// A pre-R9 state (§1.1, §3.5): fractional balances and a fractional book value are used as stored.
{
  const { loaded, engine } = newGame(9, ROUTES[0]), g = engine.g, finance = loaded.modules.finance;
  g.personalCash = PERSONAL_FIXTURE_CASH;
  assert.equal(engine.contributeFounderCapital(CONTRIBUTION), true);
  const tenant = g.tenants.find(row => !row.occupiedBy);
  assert.notEqual(engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: 'legacy', operatingHours: 3 }), false);
  const store = g.stores[g.stores.length - 1];
  assert.equal(engine.borrow(10_000_000, 'company'), true);
  // Rewrite the state the way a save created before R9 can hold it: a fractional debt and a
  // fractional book value, each moved consistently through the books.
  // A fixed asset recognised before R9 at a cent value, as a pre-R9 save can still hold one.
  const asset = finance.addFixedAsset(g, { assetID: 'legacy-cent-asset', acquisitionCost: 1_234_567.37, storeID: store.id, businessID: 'ramen', usefulLifeWeeks: 260 });
  assert.ok(asset && !Number.isSafeInteger(asset.bookValue), 'the legacy book value is fractional');
  finance.event(g, 'capitalExpenditure', asset.acquisitionCost, { cashEffect: -asset.acquisitionCost, assetEffect: asset.acquisitionCost, storeID: store.id, businessID: 'ramen', sourceType: 'legacyFraction', sourceID: asset.assetID, operationID: `fixed-asset-acquisition-${asset.assetID}`, idempotencyKey: `fixed-asset-acquisition-${asset.assetID}`, fixedAssetLifecycle: 'acquisition', fixedAssetID: asset.assetID, description: 'legacy fractional fixed asset' });
  g.companyCash -= asset.acquisitionCost;
  const debtShift = 0.25;
  g.companyDebt += debtShift;
  g.companyCash += debtShift;
  finance.event(g, 'debtBorrowing', debtShift, { cashEffect: debtShift, liabilityEffect: debtShift, sourceType: 'legacyFraction', sourceID: 'legacy-debt', idempotencyKey: 'legacy-fraction-debt', description: 'legacy fractional borrowing' });
  // Rebase the generic loan rows so that the debt rollforward sees the stored fractional debt.
  const loan = (g.loans || []).find(row => Number(row.balance) > 0);
  if (loan) loan.balance = Number(loan.balance) + debtShift;
  const before = { cash: g.companyCash, debt: g.companyDebt, count: g.finance.transactions.length };
  assert.ok(!Number.isSafeInteger(before.debt), 'the legacy debt is fractional');
  // The request rounds up past the fractional debt and is capped at it (§3.5).
  assert.equal(engine.prepayCompanyDebtVoluntarily(before.debt), true, 'a request for the whole fractional debt is accepted');
  const prepaid = g.finance.transactions.slice(before.count).find(row => row.sourceType === 'voluntaryDebtPrepayment');
  assert.equal(prepaid.amount, before.debt, 'the capped payment posts the stored fractional debt as is');
  assert.equal(g.companyDebt, 0);
  assert.equal(g.companyCash, before.cash - before.debt, 'state and ledger agree on the capped payment');
  // Closing the store disposes of all its active assets, the legacy one included.
  const bookBefore = g.finance.fixedAssets.filter(row => row.storeID === store.id && row.status === 'active').reduce((sum, row) => sum + row.bookValue, 0);
  const beforeClose = g.finance.transactions.length;
  assert.ok(!Number.isSafeInteger(bookBefore), 'the store book value is fractional');
  assert.equal(engine.closeStore(store.id), true);
  const disposal = g.finance.transactions.slice(beforeClose).find(row => row.fixedAssetLifecycle === 'disposal');
  assert.ok(disposal, 'the close disposes of the fixed asset');
  assert.ok(Math.abs(-disposal.assetEffect - bookBefore) < 0.005, 'the disposal removes the stored fractional book value');
  assert.ok(!Number.isSafeInteger(disposal.assetEffect), 'the fractional book value is posted as is, not rounded');
  const validation = finance.validate(g);
  assert.equal(validation.ok, true, `legacy fractional state validates: ${(validation.errors || []).join(' / ')}`);
}

console.log(`PASS yen ceiling seeded full run: ${WEEKS} weeks x ${ROUTES.length} routes ${JSON.stringify(results)}`);
