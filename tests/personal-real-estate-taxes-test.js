'use strict';

// feature-requests.md R4. A personal holding cost nothing to simply own beyond upkeep and the
// management fee, so its headline yield was close to what the player actually kept. Real
// property is taxed on assessed value whether or not it earns, which is exactly the pressure a
// vacant building should feel: the rent stops, the tax bill does not.
//
// js/personal-real-estate-taxes.js reuses the shape of the company side's property tax (a rate
// on assessed value, billed in instalments) but keeps the money personal -- personalCash only,
// never the company ledger. One flat rate rather than the company's three regimes, because
// charging the pricier lots more cancelled out against their yields almost exactly and made
// the choice between offers meaningless.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 260819555) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 260819555, cash = 300_000_000) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  engine.g.personalCash = cash;
  return { modules, ctx, engine, taxes: modules.personalRealEstateTaxes };
}

function withHolding(seed = 260819555, offer = 'logistics-aichi', cash = 300_000_000) {
  const bag = newGame(seed, cash);
  assert.equal(bag.engine.buyPersonalRealEstate(offer), true);
  bag.asset = bag.engine.g.personalRealEstateHoldings[0];
  return bag;
}

function keepVacant(asset) {
  asset.rentalOps.occupancyStatus = 'vacant';
  asset.rentalOps.contractWeeklyRent = 0;
}

// 1. Registered like every other module here.
{
  const { taxes } = newGame();
  assert.ok(taxes, 'personalRealEstateTaxes モジュールが登録されている');
  assert.equal(taxes.__installed, true);
}

// 2. The bill is a rate on assessed value, split into equal instalments.
{
  const { asset, taxes } = withHolding();
  assert.equal(taxes.annualTaxFor(asset), Math.round(asset.currentValue * taxes.ANNUAL_RATE));
  assert.equal(taxes.instalmentFor(asset), Math.round(taxes.annualTaxFor(asset) / taxes.INSTALMENTS));
  assert.equal(taxes.INSTALMENTS * taxes.WEEKS_PER_INSTALMENT, 52, '分割回数×間隔が1年になる');
}

// 3. Assessed value follows the property, so a building that appreciates is taxed more.
{
  const { asset, taxes } = withHolding();
  const before = taxes.annualTaxFor(asset);
  asset.currentValue = asset.purchasePrice * 2;
  assert.ok(taxes.annualTaxFor(asset) > before, '評価額が上がれば税額も上がる');
}

// 4. Bills are keyed to weeks of ownership, not a global calendar, so a property bought
// mid-year is not charged for a quarter it did not own.
{
  const { asset, taxes } = withHolding();
  asset.purchasedWeek = 10;
  assert.equal(taxes.instalmentDue(asset, 10), false, '購入した週にはまだ課税されない');
  assert.equal(taxes.instalmentDue(asset, 10 + taxes.WEEKS_PER_INSTALMENT), true, '保有13週目で最初の納付');
  assert.equal(taxes.instalmentDue(asset, 10 + taxes.WEEKS_PER_INSTALMENT + 1), false);
  assert.equal(taxes.instalmentDue(asset, 10 + taxes.WEEKS_PER_INSTALMENT * 2), true, '以降13週ごと');
}

// 5. Exactly four bills a year through the real game loop, totalling roughly the annual rate
// (only roughly, because the assessed value drifts week to week).
{
  const { engine, asset, taxes } = withHolding();
  let charges = 0;
  for (let i = 0; i < 52; i++) {
    const before = Number(asset.propertyTaxPaid) || 0;
    assert.notEqual(engine.advanceWeek(false), false);
    if ((Number(asset.propertyTaxPaid) || 0) > before) charges++;
  }
  assert.equal(charges, taxes.INSTALMENTS, '1年で4回課税される');
  const annual = taxes.annualTaxFor(asset);
  assert.ok(asset.propertyTaxPaid > annual * .8 && asset.propertyTaxPaid < annual * 1.2, `年間納税額が年税額と概ね一致する (${asset.propertyTaxPaid} vs ${annual})`);
}

// 6. The bill comes out of personal cash, and by exactly the instalment amount.
{
  const { engine, asset, taxes } = withHolding();
  asset.purchasedWeek = engine.g.week;
  const instalment = taxes.instalmentFor(asset);
  const cashBefore = engine.g.personalCash;
  engine.g.week += taxes.WEEKS_PER_INSTALMENT;
  taxes.processWeek(engine);
  assert.equal(engine.g.personalCash, cashBefore - instalment, '納税額がそのままpersonalCashから引かれる');
  assert.equal(asset.propertyTaxPaid, instalment);
  assert.equal(asset.propertyTaxArrears, 0);
}

// 7. This is the point of the feature: a vacant building still owes tax. Rent stops, the bill
// does not.
{
  const { engine, asset, taxes } = withHolding();
  keepVacant(asset);
  asset.purchasedWeek = engine.g.week;
  const cashBefore = engine.g.personalCash;
  engine.g.week += taxes.WEEKS_PER_INSTALMENT;
  taxes.processWeek(engine);
  assert.ok(engine.g.personalCash < cashBefore, '空室でも課税される');
  assert.equal(asset.propertyTaxPaid, taxes.instalmentFor(asset));
}

// 8. An unpayable bill becomes visible arrears rather than being silently skipped, and cash
// never goes negative from it.
{
  const { engine, asset, taxes } = withHolding();
  keepVacant(asset);
  asset.purchasedWeek = engine.g.week;
  const instalment = taxes.instalmentFor(asset);
  engine.g.personalCash = 0;
  engine.g.week += taxes.WEEKS_PER_INSTALMENT;
  taxes.processWeek(engine);
  assert.equal(engine.g.personalCash, 0, '無い金は引かれない');
  assert.equal(asset.propertyTaxArrears, instalment, '払えなかった分が未納として残る');
  assert.equal(asset.propertyTaxPaid, 0);
}

// 9. Arrears roll into the next bill instead of being forgotten.
{
  const { engine, asset, taxes } = withHolding();
  keepVacant(asset);
  asset.purchasedWeek = engine.g.week;
  const instalment = taxes.instalmentFor(asset);
  engine.g.personalCash = 0;
  engine.g.week += taxes.WEEKS_PER_INSTALMENT;
  taxes.processWeek(engine);
  assert.equal(asset.propertyTaxArrears, instalment);
  engine.g.personalCash = 500_000_000;
  engine.g.week += taxes.WEEKS_PER_INSTALMENT;
  const cashBefore = engine.g.personalCash;
  taxes.processWeek(engine);
  const secondBill = taxes.instalmentFor(asset);
  assert.equal(engine.g.personalCash, cashBefore - (secondBill + instalment), '未納分が次回請求に上乗せされる');
  assert.equal(asset.propertyTaxArrears, 0, '払えば未納は解消する');
}

// 10. Only one bill per week per property, even if the weekly pass runs twice.
{
  const { engine, asset, taxes } = withHolding();
  asset.purchasedWeek = engine.g.week;
  engine.g.week += taxes.WEEKS_PER_INSTALMENT;
  taxes.processWeek(engine);
  const paid = asset.propertyTaxPaid;
  taxes.processWeek(engine);
  assert.equal(asset.propertyTaxPaid, paid, '同じ週に二重課税されない');
}

// 11. Sold holdings stop being taxed.
{
  const { engine, asset, taxes } = withHolding();
  asset.purchasedWeek = engine.g.week;
  assert.equal(engine.sellPersonalRealEstate(asset.assetID), true);
  const cashBefore = engine.g.personalCash;
  engine.g.week += taxes.WEEKS_PER_INSTALMENT;
  taxes.processWeek(engine);
  assert.equal(engine.g.personalCash, cashBefore, '売却済みの物件には課税されない');
}

// 12. Company separation: nothing here touches companyCash or the company ledger. Compared
// against a parallel run without a holding, since a company with an office has weekly costs
// of its own either way.
{
  function run(buy) {
    const { modules, engine } = newGame(4242);
    const office = engine.g.rentalOffices.reduce((a, b) => (a.deposit < b.deposit ? a : b));
    assert.equal(engine.contractOffice(office.id), true);
    engine.g.companyCash = 5_000_000_000;
    engine.g.finance = modules.finance.defaultFinanceState(engine.g);
    if (buy) assert.equal(engine.buyPersonalRealEstate('logistics-aichi'), true);
    for (let i = 0; i < 14; i++) engine.advanceWeek(false);
    return { engine, modules };
  }
  const owning = run(true);
  const not = run(false);
  assert.equal(owning.engine.g.companyCash, not.engine.g.companyCash, '個人不動産の固定資産税はcompanyCashを動かさない');
  assert.equal(owning.engine.g.finance.transactions.length, not.engine.g.finance.transactions.length, '会社台帳に固定資産税の行は作られない');
  assert.equal(owning.modules.finance.validate(owning.engine.g).ok, true);
}

// 13. Zero new randomness.
{
  let calls = 0;
  const inner = lcg();
  const counting = () => { calls++; return inner(); };
  const { modules, ctx } = loadGame({ random: counting });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  engine.g.personalCash = 300_000_000;
  engine.buyPersonalRealEstate('logistics-aichi');
  const asset = engine.g.personalRealEstateHoldings[0];
  asset.purchasedWeek = engine.g.week;
  engine.g.week += modules.personalRealEstateTaxes.WEEKS_PER_INSTALMENT;
  const before = calls;
  modules.personalRealEstateTaxes.processWeek(engine);
  assert.equal(calls - before, 0, '課税処理はMath.randomを一切消費しない');
}

// 14. Determinism.
{
  function run() {
    const { engine } = withHolding(20260819);
    for (let i = 0; i < 30; i++) engine.advanceWeek(false);
    return JSON.stringify({ cash: engine.g.personalCash, holdings: engine.g.personalRealEstateHoldings });
  }
  assert.equal(run(), run(), '同じseed・同じ操作で同じ結果になる');
}

// 15. Save/reload keeps the tax record.
{
  const { modules, engine, asset } = withHolding();
  for (let i = 0; i < 14; i++) engine.advanceWeek(false);
  const paid = asset.propertyTaxPaid;
  assert.ok(paid > 0, '前提: 納税が発生している');
  engine.save();
  const reloaded = modules.engine.TycoonEngine.load();
  assert.equal(reloaded.g.personalRealEstateHoldings[0].propertyTaxPaid, paid, 'reload後も納税記録が残る');
  assert.equal(reloaded.g.saveVersion, 9);
}

// 16. Legacy holdings with no tax fields read as zero and start being billed normally.
{
  const { engine, asset, taxes } = withHolding();
  delete asset.propertyTaxPaid;
  delete asset.propertyTaxArrears;
  delete asset.propertyTaxProcessedWeek;
  const summary = engine.getPersonalRealEstateTax(asset.assetID);
  assert.equal(summary.paidTotal, 0, '旧セーブは納税ゼロとして読める');
  assert.equal(summary.arrears, 0);
  assert.ok(Number.isFinite(summary.instalment), '旧セーブでもNaNにならない');
  asset.purchasedWeek = engine.g.week;
  engine.g.week += taxes.WEEKS_PER_INSTALMENT;
  taxes.processWeek(engine);
  assert.ok(asset.propertyTaxPaid > 0, '旧セーブの物件も次の納付期から通常どおり課税される');
}

// 17. The drag on yield is real and material: a year of tax is a meaningful share of a year's
// NOI, which is what makes the choice of mortgage product matter.
{
  const { asset, taxes } = withHolding();
  const annualRent = asset.weeklyRent * 52;
  const annualTax = taxes.annualTaxFor(asset);
  assert.ok(annualTax > annualRent * .1, '年税額は年間家賃の1割を超える（無視できない負担）');
  assert.ok(annualTax < annualRent * .3, '年税額が年間家賃の3割を超えるほど重くはない');
}

// 18. Static source scan: no MutationObserver introduced.
{
  const fs = require('node:fs');
  const path = require('node:path');
  for (const file of ['../js/personal-real-estate-taxes.js', '../js/expansion.js']) {
    const src = fs.readFileSync(path.join(__dirname, file), 'utf8');
    assert.ok(!/new MutationObserver|new env\.MutationObserver/.test(src), `${file}に新しいMutationObserverを追加していない`);
  }
}

console.log('personal real estate taxes tests passed');
