'use strict';

// Issue #729 (P0-04): selling a property left the seller's building state and book behind,
// and buying reused a stale acquisition basis.
// - sellProperty() kept depreciationPerWeek/buildingCost and real-estate.js's book values;
//   buyProperty() kept the old purchasePrice while charging the current price, so a rebuy
//   put a ~1e8 gap into the balance sheet and a disposed building kept "depreciating".
// - even a first purchase weeks after the start used the book real-estate.js derived at
//   week 1 instead of the price actually paid.
// - the engine also expensed p.depreciationPerWeek as a CASH cost every week, on top of the
//   building's finance fixed-asset depreciation (approved for removal as part of #729).
// Runs against the full production script set.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}

function newGame(seed) {
  const loaded = loadGame({ headless: true, random: lcg(seed) });
  const engine = new loaded.engineModule.TycoonEngine();
  engine.configure({ playerName: 'Lifecycle', companyName: 'Lifecycle Co', difficulty: 'normal' });
  const finance = loaded.modules.finance;
  engine.g.companyCash = 2_000_000_000;
  engine.g.finance = finance.defaultFinanceState(engine.g);
  return { engine, finance };
}

function assertValid(finance, g, label) {
  const v = finance.validate(g);
  assert.equal(v.ok, true, `${label}: ${v.errors.join(' / ')}`);
}

// While a building is held, weeks can also be hit by two unrelated, separately tracked defects
// (#751 rounding reconciliation reverting cash, and an unledgered property-insurance loss), so
// the lifecycle actions are checked in isolation: each action must leave the balance-sheet
// difference exactly where it found it.
function bsDiff(finance, g) { return finance.buildStatements(g, '52').balanceSheet.balanceDifference; }
function assertActionBalanced(finance, g, label, action) {
  const before = bsDiff(finance, g);
  const result = action();
  assert.ok(Math.abs(bsDiff(finance, g) - before) < 0.01, `${label}: balance-sheet difference moved from ${before} to ${bsDiff(finance, g)}`);
  return result;
}

const cashDepreciationRows = g => g.finance.transactions.filter(t => t.sourceType === 'weekly-propertyDepreciation' && t.amount > 0);
const round2 = v => Math.round(v * 100) / 100;

// 1. Land -> build -> hold -> sell -> rebuy keeps the books balanced at every step.
{
  const { engine, finance } = newGame(729);
  const land = engine.g.properties.find(p => !p.owner && p.kind === '土地' && p.price < 300_000_000);
  assert.ok(land, 'fixture needs an unowned plot of land');
  assert.equal(engine.buyProperty(land.id, 'company'), true);
  assertValid(finance, engine.g, 'after buy');
  assert.equal(engine.buildOnLand(land.id, '本社ビル'), true);
  assertValid(finance, engine.g, 'after build');
  for (let i = 0; i < 20; i++) {
    assert.notEqual(engine.advanceWeek(false), false);
    assert.equal(engine.g.lastReport.propertyDepreciation, 0, `week ${engine.g.week}: no engine-level property depreciation`);
  }
  assert.equal(cashDepreciationRows(engine.g).length, 0, 'no cash-draining property depreciation while holding');
  // The price paid for bare land stays land even after a building goes up on it (the building
  // is its own finance fixed asset), so the land is never depreciated as if it were a building.
  assert.equal(land.realEstate.landBookValue, land.purchasePrice, 'acquisition split: land stays land');
  assert.equal(land.realEstate.buildingBookValue, 0);
  assert.equal(engine.g.finance.transactions.some(t => t.sourceType === 'property-depreciation' && t.sourceID === land.id), false, 'bare land bought now is never depreciated');

  assert.equal(assertActionBalanced(finance, engine.g, 'sell', () => engine.sellProperty(land.id)), true);
  assert.equal(land.owner, null);
  assert.equal(land.depreciationPerWeek, 0, 'seller depreciation must not survive the sale');
  assert.equal(land.buildingCost, 0, 'seller building cost must not survive the sale');
  assert.equal('landBookValue' in (land.realEstate || {}), false, 'seller book must not survive the sale');
  assert.equal(engine.g.finance.fixedAssets.filter(a => a.propertyID === land.id && a.status === 'active').length, 0);

  const paid = land.price, cashBefore = engine.g.companyCash;
  assert.equal(assertActionBalanced(finance, engine.g, 'rebuy', () => engine.buyProperty(land.id, 'company')), true);
  assert.equal(round2(cashBefore - engine.g.companyCash), round2(paid));
  assert.equal(land.purchasePrice, paid, 'rebuy starts a fresh acquisition basis');
  assert.equal(round2(finance.propertyBookOf(land)), round2(paid), 'property book equals the price just paid');
  for (let i = 0; i < 2; i++) assert.notEqual(engine.advanceWeek(false), false);
  assert.equal(engine.g.lastReport.propertyDepreciation, 0, 'a disposed building never depreciates again');
  assert.equal(cashDepreciationRows(engine.g).length, 0);
  const disposedID = engine.g.finance.fixedAssets.find(a => a.propertyID === land.id && a.status === 'disposed').assetID;
  assert.equal(engine.g.finance.transactions.some(t => t.week > engine.g.week - 2 && String(t.sourceID).includes(disposedID)), false, 'no postings against the disposed building');
}

// 2. First purchase several weeks in: the book is the price paid, not the week-1 estimate.
{
  const { engine, finance } = newGame(730);
  const land = engine.g.properties.find(p => !p.owner && p.kind === '土地' && p.price < 300_000_000);
  for (let i = 0; i < 10; i++) assert.notEqual(engine.advanceWeek(false), false);
  const paid = land.price;
  assert.equal(engine.buyProperty(land.id, 'company'), true);
  assert.equal(round2(finance.propertyBookOf(land)), round2(paid));
  assertValid(finance, engine.g, 'first purchase at week 11');
}

// 3. A ready-built catalog building held by the company drains no cash as "depreciation".
{
  const { engine, finance } = newGame(731);
  const building = engine.g.properties.find(p => !p.owner && p.kind !== '土地' && Number(p.depreciationPerWeek) > 0 && p.price < 500_000_000);
  assert.ok(building, 'fixture needs an unowned catalog building');
  assert.equal(engine.buyProperty(building.id, 'company'), true);
  for (let i = 0; i < 4; i++) {
    const cash = engine.g.companyCash, count = engine.g.finance.transactions.length;
    assert.notEqual(engine.advanceWeek(false), false);
    assert.equal(engine.g.lastReport.propertyDepreciation, 0, `week ${engine.g.week}: catalog depreciationPerWeek is not a cash expense`);
    const ledger = engine.g.finance.transactions.slice(count).reduce((a, t) => a + t.cashEffect, 0);
    assert.ok(Math.abs((engine.g.companyCash - cash) - ledger) < 0.1, `week ${engine.g.week}: cash moves only with the ledger`);
  }
  assert.equal(cashDepreciationRows(engine.g).length, 0, 'catalog depreciationPerWeek is not a cash expense');
  assert.equal(engine.g.lastReport.propertyDepreciation, 0);
  assertValid(finance, engine.g, 'catalog building held 4 weeks');
  // real-estate.js has been depreciating the building share, so the carried book is below the
  // purchase price: the sale must remove exactly that carried book.
  assert.ok(finance.propertyBookOf(building) < building.purchasePrice, 'fixture: carried book has moved off the purchase price');
  assert.equal(assertActionBalanced(finance, engine.g, 'sell catalog building', () => engine.sellProperty(building.id)), true);
  assertValid(finance, engine.g, 'catalog building sold');
}

// 4. Personal ownership follows the same lifecycle and never touches the company books.
{
  const { engine, finance } = newGame(732);
  engine.g.personalCash = 500_000_000;
  const land = engine.g.properties.find(p => !p.owner && p.kind === '土地' && p.price < 300_000_000);
  const tx = engine.g.finance.transactions.length;
  assert.equal(engine.buyProperty(land.id, 'personal'), true);
  assert.equal(land.purchasePrice, land.price);
  assert.equal(engine.sellProperty(land.id), true);
  assert.equal(land.depreciationPerWeek, 0);
  assert.equal(engine.g.finance.transactions.length, tx, 'personal property stays off the company ledger');
  assertValid(finance, engine.g, 'personal lifecycle');
}

console.log('property lifecycle ledger tests passed');
