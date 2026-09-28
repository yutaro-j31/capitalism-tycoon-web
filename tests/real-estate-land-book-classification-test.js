'use strict';

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seedValue) {
  let seed = seedValue >>> 0;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function newGame(seed = 0x75200001) {
  const loaded = loadGame({ random: lcg(seed), headless: true });
  const { modules, engineModule } = loaded;
  const e = new engineModule.TycoonEngine();
  e.g.configured = true;
  e.g.companyCash = 1_000_000_000;
  e.g.personalCash = 500_000_000;
  e.g.companyDebt = 0;
  e.g.personalDebt = 0;
  e.g.finance = modules.finance.defaultFinanceState(e.g);
  return { loaded, modules, e };
}

function freeLand(e) {
  const p = e.g.properties.find(row => !row.owner && row.kind === '土地');
  assert(p, 'bare land fixture exists');
  return p;
}

// 1. Bare land acquisition is 100% land book value and never emits property-depreciation.
{
  const { modules, e } = newGame();
  const p = freeLand(e);
  assert.equal(e.buyProperty(p.id, 'company'), true);
  const purchasePrice = p.purchasePrice;
  const before = e.getPropertyInvestmentMetrics(p.id);

  assert.equal(before.landBookValue, purchasePrice, 'bare-land acquisition cost is all land');
  assert.equal(before.buildingBookValue, 0, 'bare land has no building book');
  assert.equal(before.weeklyDepreciation, 0, 'bare land is nondepreciable');

  for (let i = 0; i < 20; i++) assert.notEqual(e.advanceWeek(false), false);

  const after = e.getPropertyInvestmentMetrics(p.id);
  assert.equal(after.landBookValue, purchasePrice, 'land book value remains unchanged after 20 weeks');
  assert.equal(after.buildingBookValue, 0, 'no building book appears over time');
  assert.equal(after.weeklyDepreciation, 0, 'land still has zero weekly depreciation');
  assert.equal(
    e.g.finance.transactions.filter(t => t.sourceType === 'property-depreciation' && t.sourceID === p.id).length,
    0,
    'bare land never emits property-depreciation'
  );
  const validation = modules.finance.validate(e.g);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

// 2. Building constructed on acquired land is depreciated exactly once by finance.fixedAssets.
// realEstate keeps only the original land acquisition book and must not add a second stream.
{
  const { modules, e } = newGame(0x75200002);
  const p = freeLand(e);
  assert.equal(e.buyProperty(p.id, 'company'), true);
  const purchasePrice = p.purchasePrice;
  assert.equal(e.buildOnLand(p.id, '本社ビル'), true);

  const building = e.g.finance.fixedAssets.find(a =>
    a.propertyID === p.id && a.assetType === 'building' && a.status === 'active'
  );
  assert(building, 'constructed building is represented as a finance fixed asset');

  assert.notEqual(e.advanceWeek(false), false);

  const metrics = e.getPropertyInvestmentMetrics(p.id);
  assert.equal(metrics.landBookValue, purchasePrice, 'constructed building does not contaminate land acquisition book');
  assert.equal(metrics.buildingBookValue, 0, 'realEstate does not duplicate a finance-tracked building');
  assert.equal(metrics.weeklyDepreciation, 0, 'realEstate depreciation is suppressed for finance-tracked building');

  const propertyDep = e.g.finance.transactions.filter(t =>
    t.sourceType === 'property-depreciation' && t.sourceID === p.id
  );
  const fixedDep = e.g.finance.transactions.filter(t =>
    t.sourceType === 'depreciation' && t.sourceID === building.assetID
  );
  assert.equal(propertyDep.length, 0, 'no duplicate property-depreciation stream');
  assert.equal(fixedDep.length, 1, 'exactly one fixed-asset building depreciation row in one week');
  assert.equal(fixedDep[0].cashEffect, 0, 'building depreciation is non-cash');

  const validation = modules.finance.validate(e.g);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

// 3. V3 save migration: historical bug put land purchase price into buildingBookValue and then
// depreciated it. V4 restores the acquisition price to landBookValue and posts the recovered
// historical write-down to priorPeriodAdjustments so A=L+E remains balanced. The migration is
// idempotent and saveVersion stays 9.
{
  const { modules, e } = newGame(0x75200003);
  const p = freeLand(e);
  assert.equal(e.buyProperty(p.id, 'company'), true);
  assert.equal(e.buildOnLand(p.id, '本社ビル'), true);
  modules.realEstate.ensure(e.g);

  const purchasePrice = p.purchasePrice;
  const erroneousDepreciation = 123_456;
  p.realEstate.landBookValue = 0;
  p.realEstate.buildingBookValue = purchasePrice - erroneousDepreciation;
  p.realEstate.buildingOriginalCost = purchasePrice;
  e.g.realEstate.schemaVersion = 3;

  modules.finance.event(e.g, 'depreciation', erroneousDepreciation, {
    cashEffect: 0,
    profitEffect: -erroneousDepreciation,
    assetEffect: -erroneousDepreciation,
    sourceType: 'property-depreciation',
    sourceID: p.id,
    idempotencyKey: `legacy-property-depreciation-${p.id}`,
    description: 'legacy erroneous land depreciation fixture'
  });

  const beforeAdjustment = Number(e.g.finance.balances.priorPeriodAdjustments || 0);
  const beforeValidation = modules.finance.validate(e.g);
  assert.equal(beforeValidation.ok, true, 'legacy wrong book is internally balanced before migration');

  modules.realEstate.ensure(e.g);

  assert.equal(e.g.realEstate.schemaVersion, 4);
  assert.equal(e.g.saveVersion, 9, 'top-level saveVersion remains 9');
  assert.equal(p.realEstate.landBookValue, purchasePrice, 'migration restores full land acquisition basis');
  assert.equal(p.realEstate.buildingBookValue, 0, 'migration removes false building basis');
  assert.equal(p.realEstate.buildingOriginalCost, 0, 'false building depreciation basis is cleared');
  assert.equal(
    Number(e.g.finance.balances.priorPeriodAdjustments),
    beforeAdjustment + erroneousDepreciation,
    'historical erroneous depreciation is reversed through prior-period equity adjustment'
  );
  assert.equal(e.g.realEstate.landBasisMigrationV4Adjustment, erroneousDepreciation);

  const afterValidation = modules.finance.validate(e.g);
  assert.equal(afterValidation.ok, true, afterValidation.errors.join('\n'));

  const stateAfterFirstMigration = JSON.stringify(e.g);
  modules.realEstate.ensure(e.g);
  assert.equal(JSON.stringify(e.g), stateAfterFirstMigration, 'V4 migration is idempotent');

  const building = e.g.finance.fixedAssets.find(a =>
    a.propertyID === p.id && a.assetType === 'building' && a.status === 'active'
  );
  assert(building, 'constructed building fixed asset survives migration');

  const propertyDepCount = e.g.finance.transactions.filter(t =>
    t.sourceType === 'property-depreciation' && t.sourceID === p.id
  ).length;
  const fixedDepCount = e.g.finance.transactions.filter(t =>
    t.sourceType === 'depreciation' && t.sourceID === building.assetID
  ).length;

  assert.notEqual(e.advanceWeek(false), false);
  assert.equal(
    e.g.finance.transactions.filter(t => t.sourceType === 'property-depreciation' && t.sourceID === p.id).length,
    propertyDepCount,
    'migrated land does not resume property-depreciation'
  );
  assert.equal(
    e.g.finance.transactions.filter(t => t.sourceType === 'depreciation' && t.sourceID === building.assetID).length,
    fixedDepCount + 1,
    'finance-tracked building continues with exactly one depreciation stream'
  );
  const finalValidation = modules.finance.validate(e.g);
  assert.equal(finalValidation.ok, true, finalValidation.errors.join('\n'));
}

console.log('real-estate land book classification tests passed');
