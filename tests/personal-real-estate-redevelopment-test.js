'use strict';

// R4 remaining item "開発・再開発". The company-side real-estate-redevelopment-projects.js
// already models this against g.properties -- and its code even already branches
// cash/owner handling for a personal owner -- but there is no gameplay path that ever
// creates a personally-owned g.properties row (per docs/feature-requests.md's own warning:
// personal real estate lives entirely in the separate g.personalRealEstateHoldings
// array/catalog; conflating the two systems is a dead end). This reuses the exact same
// PROJECTS table (改装/用途転換/建替え, same costRate/valueRate/conditionGain/durationWeeks)
// against personalRealEstateHoldings's own fields instead, funded from personalCash only,
// with no company-ledger involvement -- matching every other personal-real-estate module.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 260819903) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 260819903) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  engine.g.personalCash = 100_000_000;
  return { modules, ctx, engine };
}

function buyHolding(engine) {
  assert.equal(engine.buyPersonalRealEstate('studio-tokyo'), true);
  return engine.g.personalRealEstateHoldings[0];
}

// 1. Starting a project charges the exact quoted cost from personalCash only, and blocks a
// second concurrent project on the same holding.
{
  const { engine } = newGame();
  const companyCashBefore = engine.g.companyCash;
  const holding = buyHolding(engine);
  const quotes = engine.getPersonalRealEstateRedevelopmentProjects(holding.assetID);
  assert.equal(quotes.length, 3, '改装/用途転換/建替えの3件が提示される');
  const before = engine.g.personalCash;
  assert.equal(engine.startPersonalRealEstateRedevelopment(holding.assetID, 'refresh'), true);
  assert.equal(before - engine.g.personalCash, quotes.find(q => q.id === 'refresh').cost);
  assert.equal(engine.g.companyCash, companyCashBefore, '会社資金には一切触れない');
  assert.equal(engine.startPersonalRealEstateRedevelopment(holding.assetID, 'conversion'), false, '同時に2件目は開始できない');
  assert.equal(engine.getPersonalRealEstateRedevelopmentProjects(holding.assetID).length, 0, '進行中は見積もりが出ない');
}

// 2. Insufficient cash blocks the start and charges nothing.
{
  const { engine } = newGame();
  const holding = buyHolding(engine);
  const cost = engine.getPersonalRealEstateRedevelopmentProjects(holding.assetID).find(q => q.id === 'rebuild').cost;
  engine.g.personalCash = cost - 1;
  assert.equal(engine.startPersonalRealEstateRedevelopment(holding.assetID, 'rebuild'), false);
  assert.equal(engine.g.personalCash, cost - 1);
  assert.equal(holding.redevelopmentProjectID, undefined);
}

// 3. On completion, valuation, book value and condition all move exactly as documented, and
// the holding resumes normal rental processing afterward. Rent income is suppressed for the
// exact duration of the project (durationWeeks), never longer or shorter.
{
  const { engine } = newGame();
  const holding = buyHolding(engine);
  const quote = engine.getPersonalRealEstateRedevelopmentProjects(holding.assetID).find(q => q.id === 'refresh');
  assert.equal(engine.startPersonalRealEstateRedevelopment(holding.assetID, 'refresh'), true);
  const startWeek = engine.g.week;
  for (let i = 0; i < quote.durationWeeks - 1; i++) {
    assert.notEqual(engine.advanceWeek(false), false);
    assert.equal(holding.redevelopmentProjectID, 'refresh', `${i + 1}週目はまだ進行中`);
    assert.equal(holding.rentalOps.condition, 90, '進行中は状態が変化しない（工事中は入居者がいない）');
  }
  const preValue = holding.currentValue, preBook = holding.bookValue;
  assert.notEqual(engine.advanceWeek(false), false);
  assert.equal(engine.g.week, startWeek + quote.durationWeeks, '指定週数ちょうどで完了する');
  assert.equal(holding.redevelopmentProjectID, '', '完了後はprojectIDがクリアされる');
  assert.ok(holding.currentValue > preValue, '完了時に評価額が上がる');
  assert.ok(holding.bookValue > preBook, '完了時に帳簿価額が上がる');
  assert.equal(holding.rentalOps.condition, 100, `状態は90+${quote.conditionGain}をクランプした100になる`);
  assert.equal(holding.redevelopmentCompletedTotal, 1);

  const rentBefore = engine.g.personalCash;
  assert.notEqual(engine.advanceWeek(false), false);
  assert.ok(Number.isFinite(engine.g.personalCash - rentBefore), '完了後は通常の賃貸処理が再開する');
}

// 3b. The completion math itself, isolated from the weekly market-cycle drift that also
// touches currentValue every tick: complete() adds exactly valueGain to currentValue and
// exactly cost on top of the pre-completion value for bookValue -- not some other multiple.
{
  const { engine, modules } = newGame();
  const holding = buyHolding(engine);
  const quote = engine.getPersonalRealEstateRedevelopmentProjects(holding.assetID).find(q => q.id === 'conversion');
  holding.redevelopmentProjectID = 'conversion';
  holding.redevelopmentValueGain = quote.valueGain;
  holding.redevelopmentCost = quote.cost;
  const valueBefore = holding.currentValue, bookBefore = holding.bookValue;
  modules.personalRealEstateRedevelopment.complete(holding);
  assert.equal(holding.currentValue, Math.round((valueBefore + quote.valueGain) * 100) / 100, 'currentValueはvalueGain分だけ厳密に増える');
  assert.equal(holding.bookValue, Math.round((Math.max(bookBefore, valueBefore) + quote.cost) * 100) / 100, 'bookValueはcost分だけ厳密に増える');
}

// 4. Selling a holding mid-project is blocked; selling after completion works normally.
{
  const { engine } = newGame();
  const holding = buyHolding(engine);
  const quote = engine.getPersonalRealEstateRedevelopmentProjects(holding.assetID).find(q => q.id === 'refresh');
  engine.startPersonalRealEstateRedevelopment(holding.assetID, 'refresh');
  assert.equal(engine.sellPersonalRealEstate(holding.assetID), false, '工事中は売却できない');
  assert.equal(holding.status, 'owned');
  for (let i = 0; i < quote.durationWeeks; i++) engine.advanceWeek(false);
  assert.equal(engine.sellPersonalRealEstate(holding.assetID), true, '完了後は売却できる');
}

// 5. Cancelling a project clears the tracking fields and refunds nothing (matches the
// company-side real-estate-redevelopment-projects.js cancel behavior).
{
  const { engine } = newGame();
  const holding = buyHolding(engine);
  engine.startPersonalRealEstateRedevelopment(holding.assetID, 'refresh');
  const cashAfterStart = engine.g.personalCash;
  assert.equal(engine.cancelPersonalRealEstateRedevelopment(holding.assetID), true);
  assert.equal(holding.redevelopmentProjectID, '');
  assert.equal(engine.g.personalCash, cashAfterStart, 'キャンセルしても費用は返らない');
  assert.equal(engine.startPersonalRealEstateRedevelopment(holding.assetID, 'conversion'), true, 'キャンセル後は新しい計画を開始できる');
}

// 6. Backward compatibility: an old save with no redevelopment fields at all loads and
// operates safely (no crash, no spurious in-progress state). saveVersion stays 9.
{
  const { engine, modules } = newGame();
  const holding = buyHolding(engine);
  delete holding.redevelopmentProjectID;
  delete holding.redevelopmentCompleteWeek;
  assert.equal(engine.getPersonalRealEstateRedevelopmentProjects(holding.assetID).length, 3, '旧セーブでも見積もりが正常に出る');
  assert.notEqual(engine.advanceWeek(false), false);
  engine.save();
  const reloaded = modules.engine.TycoonEngine.load();
  assert.equal(reloaded.g.saveVersion, 9);
}

// 7. Determinism / RNG budget: starting, cancelling and the weekly completion check all draw
// no random numbers.
{
  const { engine } = newGame();
  const holding = buyHolding(engine);
  let calls = 0;
  const originalRandom = Math.random;
  Math.random = () => { calls++; return originalRandom(); };
  try {
    assert.equal(engine.startPersonalRealEstateRedevelopment(holding.assetID, 'refresh'), true);
    assert.equal(engine.cancelPersonalRealEstateRedevelopment(holding.assetID), true);
  } finally {
    Math.random = originalRandom;
  }
  assert.equal(calls, 0, '開始・キャンセルはMath.randomを消費しない');
}

console.log('personal real estate redevelopment tests passed');
