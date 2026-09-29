'use strict';

// The expansion.js player actions spend company cash. Each one must write the matching
// company-ledger transaction, or finance.validate() reports a cash / balance-sheet mismatch for
// the rest of the game (#795).

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seedValue) {
  let seed = seedValue >>> 0;
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; };
}

function freshGame() {
  const loaded = loadGame({ headless: true, random: lcg(0x79500003) });
  const { modules } = loaded;
  const engine = new loaded.engineModule.TycoonEngine();
  engine.configure({ playerName: 'Ledger', companyName: 'Ledger Co', difficulty: 'normal', scenario: 'free' });
  modules.simulationRng.reseed(engine.g, 0x795003);
  const contribution = 300_000_000_000 - engine.g.companyCash;
  engine.g.personalCash += contribution;
  assert.equal(engine.contributeFounderCapital(contribution), true, 'company cash arrives through the ledger');
  for (let i = 1; i <= 3; i++) {
    const tenant = engine.g.tenants.find(t => !t.occupiedBy);
    assert.equal(engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: `台帳ラーメン${i}`, operatingHours: 3 }), true);
  }
  const office = engine.g.rentalOffices.find(o => !o.contracted);
  assert.equal(engine.contractOffice(office.id), true, 'head office through the ledger-recorded path');
  assertValid(modules, engine, 'setup');
  return { modules, engine };
}

function assertValid(modules, engine, label) {
  const validation = modules.finance.validate(engine.g);
  assert.equal(validation.ok, true, `${label}: finance.validate: ${validation.errors.join(' / ')}`);
}

function measure(modules, engine, label, action) {
  const before = engine.g.companyCash;
  const ids = new Set(engine.g.finance.transactions.map(t => t.transactionID));
  assert.equal(action(), true, `${label} succeeds`);
  const added = engine.g.finance.transactions.filter(t => !ids.has(t.transactionID));
  const moved = engine.g.companyCash - before;
  const recorded = added.reduce((sum, t) => sum + t.cashEffect, 0);
  assert.ok(moved < 0, `precondition: ${label} spends company cash`);
  assert.ok(Math.abs(moved - recorded) < 1, `${label}: company cash moved ${moved} but the ledger recorded ${recorded}`);
  assertValid(modules, engine, label);
  return added;
}

// 1. Supplier contract setup fee: an expense.
{
  const { modules, engine } = freshGame();
  const [row] = measure(modules, engine, 'contractSupplier', () => engine.contractSupplier('local-quality', 'ramen'));
  assert.equal(row.profitEffect, row.cashEffect, 'the setup fee is expensed');
}

// 2. Vertical integration: capital expenditure held as a depreciating fixed asset.
{
  const { modules, engine } = freshGame();
  const offer = modules.expansion.VERTICAL_INTEGRATION_OFFERS.find(o => o.id === 'pos-platform');
  const [row] = measure(modules, engine, 'addVerticalIntegration', () => engine.addVerticalIntegration('pos-platform'));
  assert.equal(row.category, 'capitalExpenditure');
  assert.equal(row.assetEffect, offer.cost);
  const asset = engine.g.verticalIntegrationAssets.at(-1);
  const fixed = engine.g.finance.fixedAssets.find(a => a.assetID === `vertical-integration-${asset.assetID}`);
  assert.equal(fixed?.acquisitionCost, offer.cost, 'the investment is a fixed asset');
  for (let week = 0; week < 4; week++) assert.notEqual(engine.advanceWeek(false), false);
  assert.ok(fixed.accumulatedDepreciation > 0, 'and it depreciates');
  assertValid(modules, engine, 'vertical integration after four weeks');
}

// 3. R&D project: an R&D expense.
{
  const { modules, engine } = freshGame();
  assert.equal(engine.establishDepartment('product'), true, 'precondition: product department');
  const [row] = measure(modules, engine, 'startRDProject', () => engine.startRDProject('payment'));
  assert.equal(row.category, 'researchAndDevelopment');
  assert.equal(row.profitEffect, row.cashEffect);
}

// 4. Takeover defense of a listed company: an expense.
{
  const { modules, engine } = freshGame();
  engine.g.publicCompany = true;
  const [row] = measure(modules, engine, 'activateDefense(irCampaign)', () => engine.activateDefense('irCampaign'));
  assert.equal(row.profitEffect, row.cashEffect);
}

// 5. MBO of a majority-held listed company: the buy-out is an investment at cost.
{
  const { modules, engine } = freshGame();
  assert.equal(engine.establishDepartment('investment'), true, 'precondition: investment department');
  const stock = [...engine.g.market].filter(s => !s.suspended && !s.privateCompany).sort((a, b) => a.price * a.issuedShares - b.price * b.issuedShares)[0];
  const majority = Math.floor(stock.issuedShares * .5) + 1;
  // buyStock caps one purchase well below a majority, so the fixture books the majority block
  // the way buyStock does: company cash out, an investmentPurchase row, the holding at cost.
  const blockCost = majority * stock.price;
  engine.g.companyCash -= blockCost;
  modules.finance.event(engine.g, 'investmentPurchase', blockCost, { cashEffect: -blockCost, assetEffect: blockCost, sourceType: 'testMajorityBlock', sourceID: stock.id });
  engine.g.companyStocks[stock.id] = { qty: majority, avg: stock.price };
  assertValid(modules, engine, 'after the majority purchase');
  const [row] = measure(modules, engine, 'executeMBO', () => engine.executeMBO(stock.id));
  assert.equal(row.category, 'investmentPurchase');
  assert.equal(row.assetEffect, -row.cashEffect);
  const holding = engine.g.companyStocks[stock.id];
  assert.equal(holding.qty, stock.issuedShares);
}

console.log('expansion actions ledger tests passed');
