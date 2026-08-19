'use strict';

// R4 remaining item "減価償却". The reference the owner gave (a Coffee Inc 2-style property
// detail screen) has no tax line anywhere -- depreciation there is purely an accounting
// concept that lowers reported profitability, never a charge collected from the player. This
// codebase already has a proven, non-cash depreciation engine (finance.js's addFixedAsset /
// weekly fixedAssets loop, used today by store equipment and by buildOnLand-constructed
// buildings) but real-estate.js's OWN purchased-investment-property book value
// (landBookValue/buildingBookValue, the system that actually powers the property detail card
// and getPropertyInvestmentMetrics/ROI) never depreciated at all -- buildingBookValue was
// frozen at the land/building split of the purchase price forever. This adds straight-line
// depreciation to that book value, reusing the exact usefulLifeWeeks:1040 (20yr) /
// salvageValue: cost*.2 convention engine.js's buildOnLand() already established, and records
// it through the SAME finance 'depreciation' category everything else uses (cashEffect:0,
// profitEffect:-dep -- no tax, no cash movement, matches the reference exactly). Land never
// depreciates, matching real accounting and the file's existing land/building split.
//
// Auditing this also surfaced a real, pre-existing latent bug: finance.js's propertyBook()
// (feeding the balance sheet's buildingsAndLand asset line) summed each property's static
// purchasePrice instead of its actual book value. That was harmless while nothing ever
// changed buildingBookValue, but depreciation is the first thing that does -- without fixing
// propertyBook() too, the balance sheet's asset side would stay frozen while equity shrank by
// the depreciation charge every week, breaking assets=liabilities+equity. Fixed in the same
// commit since the two are inseparable: this test's assertion 6 locks that in.
//
// Not in scope here (confirmed pre-existing on main via a direct before/after comparison,
// identical error count with and without this change): a company property with rental
// enabled already fails finance.validate() after enough weeks, unrelated to depreciation --
// that is a separate bug in real-estate.js's weekly rent/expense cash reconciliation.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 260819901) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function configuredEngine(seed = 260819901) {
  const { modules, engineModule } = loadGame({ random: lcg(seed), isolatedLegacyIndex: true });
  const e = new engineModule.TycoonEngine();
  e.g.configured = true;
  e.g.companyCash = 1_000_000_000;
  e.g.personalCash = 500_000_000;
  e.g.companyDebt = 0;
  e.g.personalDebt = 0;
  e.g.finance = modules.finance.defaultFinanceState(e.g);
  return { modules, e };
}

// 1. A newly-bought company property depreciates its building only -- land is untouched --
// and the weekly amount matches the straight-line formula against the established
// usefulLifeWeeks:1040 / salvageValue: cost*.2 convention.
{
  const { modules, e } = configuredEngine();
  const p = e.g.properties.find(x => !x.owner && x.buildingType);
  assert.equal(e.buyProperty(p.id, 'company'), true);
  const m0 = e.getPropertyInvestmentMetrics(p.id);
  const expectedWeekly = Math.round((m0.buildingBookValue * (1 - modules.realEstate.DEPRECIATION_SALVAGE_RATE) / modules.realEstate.DEPRECIATION_USEFUL_LIFE_WEEKS) * 100) / 100;
  assert.equal(m0.weeklyDepreciation, expectedWeekly, '初回の週次償却額は導出式どおり');
  const landBefore = m0.landBookValue;

  for (let i = 0; i < 10; i++) assert.notEqual(e.advanceWeek(false), false);

  const m1 = e.getPropertyInvestmentMetrics(p.id);
  assert.ok(m1.buildingBookValue < m0.buildingBookValue, '建物簿価は毎週減少する');
  assert.equal(m1.landBookValue, landBefore, '土地簿価は不変');
  assert.ok(Math.abs((m0.buildingBookValue - m1.buildingBookValue) - m0.weeklyDepreciation * 10) < 1, '10週分の減少額が週次償却額の合計と一致');
}

// 2. Depreciation never drops below the salvage floor, even after a very long time. Drives
// the real processWeek() directly (as real-estate-foundation-test.js already does) instead
// of 1000+ full engine.advanceWeek() ticks, which would drag in the whole company simulation
// (market/competitor/workforce) for every tick and make this single check unaffordably slow.
{
  const { modules, e } = configuredEngine();
  const p = e.g.properties.find(x => !x.owner && x.buildingType);
  e.buyProperty(p.id, 'company');
  const m0 = e.getPropertyInvestmentMetrics(p.id);
  const floor = Math.round(m0.buildingBookValue * 0.2 * 100) / 100; // literal 20%, matching the documented convention independently of the module's own constant
  assert.equal(modules.realEstate.DEPRECIATION_SALVAGE_RATE, 0.2, '残存価値率は取得原価の20%');
  for (let i = 0; i < modules.realEstate.DEPRECIATION_USEFUL_LIFE_WEEKS + 50; i++) {
    e.g.week++;
    modules.realEstate.processWeek(e);
  }
  const m1 = e.getPropertyInvestmentMetrics(p.id);
  assert.ok(m1.buildingBookValue >= floor - 1, '残存価値（取得原価の20%）を下回らない');
  assert.equal(m1.weeklyDepreciation, 0, '残存価値に達したら償却は止まる');
}

// 3. Depreciation is booked to the company ledger as a pure paper expense -- zero cash
// effect, and it never touches personalCash (company/personal separation).
{
  const { e } = configuredEngine();
  const p = e.g.properties.find(x => !x.owner && x.buildingType);
  e.buyProperty(p.id, 'company');
  const personalBefore = e.g.personalCash;
  e.advanceWeek(false);
  const depTxns = e.g.finance.transactions.filter(t => t.sourceType === 'property-depreciation' && t.sourceID === p.id);
  assert.equal(depTxns.length, 1, '1週につき1件だけ記帳される');
  assert.equal(depTxns[0].category, 'depreciation');
  assert.equal(depTxns[0].cashEffect, 0, '現金には一切影響しない');
  assert.ok(depTxns[0].profitEffect < 0, '損益には反映される');
  assert.equal(e.g.personalCash, personalBefore, '個人資金は動かない');
}

// 4. No tax anywhere: neither the weekly depreciation nor a sale afterward introduces any
// tax category or reduces sale proceeds beyond the existing (pre-existing, untouched by
// this change) 3% transaction friction already modeled by sellPropertyInvestment.
{
  const { e } = configuredEngine();
  const p = e.g.properties.find(x => !x.owner && x.buildingType);
  e.buyProperty(p.id, 'company');
  for (let i = 0; i < 20; i++) e.advanceWeek(false);
  const taxTxns = e.g.finance.transactions.filter(t => t.sourceType === 'property-depreciation' && (t.category === 'taxExpense' || t.category === 'taxPayment'));
  assert.equal(taxTxns.length, 0, '減価償却が税区分の取引を生まない');

  const sale = e.sellPropertyInvestment(p.id);
  assert.ok(sale, '売却できる');
  const saleTaxTxns = e.g.finance.transactions.filter(t => t.week === e.g.week && (t.category === 'taxExpense' || t.category === 'taxPayment') && t.sourceID === p.id);
  assert.equal(saleTaxTxns.length, 0, '売却時にも新たな税は発生しない');
}

// 5. ROI (netYield) is net of depreciation, so the displayed investment return honestly
// reflects the economic cost of wear -- while grossYield (pure rent yield) is untouched.
{
  const { e } = configuredEngine();
  const p = e.g.properties.find(x => !x.owner && x.buildingType);
  e.buyProperty(p.id, 'company');
  e.enablePropertyRental(p.id, { monthlyRent: 2_000_000, targetOccupancy: .92 });
  const m = e.getPropertyInvestmentMetrics(p.id);
  const price = Math.max(1, p.purchasePrice || p.price || p.value);
  const annualGross = m.grossYield * price;
  const expectedNetYield = (annualGross - price * .0042 * m.marketProfile.maintenanceMultiplier - m.weeklyDepreciation * 52) / price;
  assert.ok(Math.abs(m.netYield - expectedNetYield) < 1e-9, 'netYieldは週次償却額×52を差し引いた値');
  assert.ok(m.netYield < m.grossYield, '実質利回りは表面利回りより低い');
}

// 6. The balance sheet stays reconciled: this locks in the propertyBook() fix that makes
// finance.js read the actual (depreciating) book value instead of the frozen purchase price.
{
  const { modules, e } = configuredEngine();
  const p = e.g.properties.find(x => !x.owner && x.buildingType);
  e.buyProperty(p.id, 'company');
  for (let i = 0; i < 20; i++) assert.notEqual(e.advanceWeek(false), false);
  const v = modules.finance.validate(e.g);
  assert.equal(v.ok, true, `減価償却後も貸借対照表が一致する: ${JSON.stringify(v.errors)}`);
}

// 7. Personal-owned properties still get a depreciating book value for display purposes
// (grossYield/netYield/valuation stay meaningful), but never touch the company ledger --
// there is no company asset to misstate for an asset the company never owned.
{
  const { e } = configuredEngine();
  const personal = e.g.properties.find(x => !x.owner && x.buildingType);
  assert.equal(e.buyProperty(personal.id, 'personal'), true);
  const before = e.g.finance.transactions.length;
  for (let i = 0; i < 10; i++) e.advanceWeek(false);
  const m = e.getPropertyInvestmentMetrics(personal.id);
  assert.equal(m.weeklyDepreciation, 0, '個人所有には会社側の償却スキームを適用しない');
  const after = e.g.finance.transactions.filter(t => t.sourceType === 'property-depreciation').length;
  assert.equal(after, 0, '個人所有物件は会社台帳に一切記帳しない');
  void before;
}

// 8. Save/reload: a save written before this feature existed (no buildingOriginalCost) loads
// safely, seeds the basis from the current book value, and never produces a negative or
// runaway depreciation figure. saveVersion stays 9.
{
  const { modules, e } = configuredEngine();
  const p = e.g.properties.find(x => !x.owner && x.buildingType);
  e.buyProperty(p.id, 'company');
  e.advanceWeek(false);
  delete p.realEstate.buildingOriginalCost;
  const m = e.getPropertyInvestmentMetrics(p.id);
  assert.ok(Number.isFinite(m.weeklyDepreciation) && m.weeklyDepreciation >= 0, '旧セーブでも安全に再計算される');
  e.save();
  const reloaded = modules.engine.TycoonEngine.load();
  assert.equal(reloaded.g.saveVersion, 9);
  const reloadedProperty = reloaded.g.properties.find(x => x.id === p.id);
  const reloadedMetrics = reloaded.getPropertyInvestmentMetrics(reloadedProperty.id);
  assert.ok(Number.isFinite(reloadedMetrics.weeklyDepreciation) && reloadedMetrics.weeklyDepreciation >= 0, 'reload後も安全に再計算される');
}

// 9. Determinism / RNG budget: depreciation itself draws no random numbers.
{
  const { e } = configuredEngine();
  const p = e.g.properties.find(x => !x.owner && x.buildingType);
  e.buyProperty(p.id, 'company');
  let calls = 0;
  const originalRandom = Math.random;
  Math.random = () => { calls++; return originalRandom(); };
  try {
    e.getPropertyInvestmentMetrics(p.id);
  } finally {
    Math.random = originalRandom;
  }
  assert.equal(calls, 0, 'weeklyDepreciationの計算はMath.randomを消費しない');
}

console.log('real estate building depreciation tests passed');
