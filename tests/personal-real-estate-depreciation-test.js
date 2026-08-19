'use strict';

// R4. Symmetric to the company-side depreciation added for `g.properties`
// (js/real-estate.js) -- this applies the same idea to `g.personalRealEstateHoldings`.
//
// Unlike the company side, this is deliberately DISPLAY-ONLY: it introduces a `bookValue`
// that depreciates straight-line (reusing js/real-estate.js's exact
// DEPRECIATION_USEFUL_LIFE_WEEKS/DEPRECIATION_SALVAGE_RATE constants for one shared
// schedule), but it never feeds into `currentValue` (the market-cycle figure earlier R4
// passes measured and pinned -- CLAUDE.md: "係数の調整は行わない"), personalCash,
// personalNetWorth(), or sale proceeds in sellPersonalRealEstate. Reference: the owner's
// screenshot of a Coffee Inc 2-style property screen has no tax anywhere, so -- same as the
// company-side PR -- this adds no tax and moves no cash. It exists purely so the property
// detail card can show a depreciating book value alongside the market valuation, the way the
// screenshot breaks its numbers down.
//
// Personal holdings have no land/building split (a single price per offer), so unlike the
// company side, the whole purchase price depreciates -- there is no non-depreciating land
// component to carve out here.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 260819902) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 260819902, cash = 300_000_000) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  engine.g.personalCash = cash;
  return { modules, ctx, engine };
}

function withHolding(seed = 260819902, offer = 'logistics-aichi', cash = 300_000_000) {
  const bag = newGame(seed, cash);
  assert.equal(bag.engine.buyPersonalRealEstate(offer), true);
  bag.asset = bag.engine.g.personalRealEstateHoldings[0];
  return bag;
}

// 1. Buying seeds bookValue at purchase price, and the weekly amount matches the
// straight-line formula against real-estate.js's usefulLifeWeeks:1040 (20yr) /
// salvageValue: cost*.2 convention. Written as literals (not read from
// modules.realEstate.DEPRECIATION_*) on purpose: js/expansion.js falls back to these exact
// literals itself when real-estate.js doesn't export them (e.g. this branch predating that
// PR's merge), so the test has to pin the real numbers to mean anything either way.
{
  const { engine, asset } = withHolding();
  assert.equal(asset.bookValue, asset.purchasePrice, '購入直後は帳簿価額=購入額');
  const ops0 = engine.getPersonalRealEstateOperations(asset.assetID);
  const expectedWeekly = Math.round((asset.purchasePrice * (1 - 0.2) / 1040) * 100) / 100;
  assert.equal(ops0.weeklyDepreciation, expectedWeekly, '週次償却額は耐用1040週・残存20%から導出される');
}

// 2. bookValue decreases weekly, and never drops below the 20% salvage floor. The
// "eventually reaches the floor" check is done by starting bookValue just above the floor
// (rather than driving 1000+ real engine.advanceWeek() ticks through the whole company
// simulation, which -- as with the company-side test -- would make this single assertion
// unaffordably slow) and confirming a few more weekly ticks clamp it there and stop.
{
  const { engine, asset } = withHolding();
  const before = engine.getPersonalRealEstateOperations(asset.assetID).bookValue;
  for (let i = 0; i < 10; i++) assert.notEqual(engine.advanceWeek(false), false);
  const after10 = engine.getPersonalRealEstateOperations(asset.assetID);
  assert.ok(after10.bookValue < before, '帳簿価額は毎週減少する');

  const floor = Math.round(asset.purchasePrice * 0.2 * 100) / 100; // literal 20%, independent of the module constant
  asset.bookValue = floor + 5;
  for (let i = 0; i < 5; i++) assert.notEqual(engine.advanceWeek(false), false);
  const long = engine.getPersonalRealEstateOperations(asset.assetID);
  assert.ok(long.bookValue >= floor - 1, '残存価値（取得額の20%）を下回らない');
  assert.equal(long.weeklyDepreciation, 0, '残存価値に達したら償却は止まる');
}

// 3. Purely informational: depreciation never touches personalCash, currentValue, or
// personalNetWorth(). This is the key difference from the company-side PR's design, kept
// deliberate because currentValue's market-cycle formula is explicitly pinned and there is
// no personal tax system to route a real economic effect through. Proven functionally: with
// currentValue held fixed, driving bookValue all the way to its floor moves net worth by
// exactly zero; moving currentValue instead moves net worth by exactly that delta.
{
  const { engine, asset } = withHolding();
  const netWorthBefore = engine.personalNetWorth();
  asset.bookValue = 1;
  assert.equal(engine.personalNetWorth(), netWorthBefore, '帳簿価額をどれだけ変えても純資産は動かない');

  const cashBefore = engine.g.personalCash;
  asset.currentValue = asset.currentValue + 1_000_000;
  assert.equal(engine.personalNetWorth(), netWorthBefore + 1_000_000, '評価額(currentValue)の変化だけが純資産に反映される');
  assert.equal(engine.g.personalCash, cashBefore, 'いずれの操作も個人現金には触れない（読み取りのみの検証）');
}

// 4. No tax anywhere, and sale proceeds are still driven by currentValue -- depreciation does
// not touch sellPersonalRealEstate's payout math.
{
  const { engine, asset } = withHolding();
  for (let i = 0; i < 20; i++) engine.advanceWeek(false);
  const cashBefore = engine.g.personalCash;
  const currentValueAtSale = asset.currentValue;
  assert.equal(engine.sellPersonalRealEstate(asset.assetID), true);
  assert.ok(Math.abs((engine.g.personalCash - cashBefore) - currentValueAtSale) < currentValueAtSale * 0.02 + 1, '売却代金はcurrentValue基準のまま（帳簿価額は使わない）');
}

// 5. Save/reload: a save written before this feature existed (no bookValue field) loads
// safely and the display falls back to purchasePrice until the next weekly tick seeds it.
// saveVersion stays 9.
{
  const { modules, engine, asset } = withHolding();
  delete asset.bookValue;
  const ops = engine.getPersonalRealEstateOperations(asset.assetID);
  assert.equal(ops.bookValue, asset.purchasePrice, '旧セーブは購入額にフォールバックする');
  assert.ok(Number.isFinite(ops.weeklyDepreciation) && ops.weeklyDepreciation >= 0);

  engine.save();
  const reloaded = modules.engine.TycoonEngine.load();
  assert.equal(reloaded.g.saveVersion, 9);
  const reloadedAsset = reloaded.g.personalRealEstateHoldings.find(x => x.assetID === asset.assetID);
  assert.equal(reloadedAsset.bookValue, undefined, '欠けたままreloadされる（次の週次処理まで書き換えない）');
  assert.notEqual(reloaded.advanceWeek(false), false);
  const afterTick = reloaded.g.personalRealEstateHoldings.find(x => x.assetID === asset.assetID);
  assert.ok(Number.isFinite(afterTick.bookValue), '次の週次処理で安全に初期化される');
}

// 6. Determinism / RNG budget: reading weeklyDepreciation draws no random numbers.
{
  const { engine, asset } = withHolding();
  let calls = 0;
  const originalRandom = Math.random;
  Math.random = () => { calls++; return originalRandom(); };
  try {
    engine.getPersonalRealEstateOperations(asset.assetID);
  } finally {
    Math.random = originalRandom;
  }
  assert.equal(calls, 0, 'weeklyDepreciationの計算はMath.randomを消費しない');
}

console.log('personal real estate depreciation tests passed');
