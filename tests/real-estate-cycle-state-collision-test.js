'use strict';

// g.realEstateCycle is the numeric property-cycle index (0.65-1.55). engine.js reads it to
// price company properties and advances it weekly, expansion.js averages it with economy to
// move personal property values, and macro-cycle.js nudges it per regime.
//
// real-estate-complete-cycle.js used to claim the same key for its own object state, and its
// ensure() replaced whatever was there with {} if it was not already an object. So every week
// the number was destroyed, and macro-cycle.js silently rebuilt a 1 from
// finite(state.realEstateCycle, 1). Nothing ever threw -- expansion.js's clamp() falls back to
// its min on a non-finite input, so the corruption just looked like a quiet, cycle-less market
// where the index never accumulated and never trended.
//
// The module's state now lives under g.realEstateMarket, and a save written during the
// collision is migrated across so its loans, rivals and history survive.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 260819909) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 260819909) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  return { modules, ctx, engine };
}

// 1. The two states are separate keys, with the right type on each.
{
  const { engine } = newGame();
  engine.advanceWeek(false);
  assert.equal(typeof engine.g.realEstateCycle, 'number', 'realEstateCycle は数値インデックスであり続ける');
  assert.ok(Number.isFinite(engine.g.realEstateCycle));
  assert.equal(typeof engine.g.realEstateMarket, 'object', 'モジュールのstateは別キーに載る');
  assert.ok(Array.isArray(engine.g.realEstateMarket.loans));
}

// 2. The index survives a week of play instead of being flattened back to 1. Before the fix it
// was destroyed and rebuilt every week, so it could never hold a value of its own.
{
  const { engine } = newGame();
  const seen = [];
  for (let i = 0; i < 20; i++) { assert.notEqual(engine.advanceWeek(false), false); seen.push(engine.g.realEstateCycle); }
  for (const value of seen) assert.equal(typeof value, 'number', '毎週かならず数値のまま');
  assert.ok(new Set(seen.map(v => v.toFixed(4))).size > 1, '週ごとに値が動く（毎週1へリセットされない）');
}

// 3. The index stays inside the range the engine clamps it to.
{
  const { engine } = newGame();
  for (let i = 0; i < 40; i++) {
    engine.advanceWeek(false);
    assert.ok(engine.g.realEstateCycle >= .6 && engine.g.realEstateCycle <= 1.6, `サイクル指数が想定域に収まる (${engine.g.realEstateCycle})`);
  }
}

// 4. The module's own state still accumulates -- the fix must not cost it its history.
{
  const { modules, engine } = newGame();
  for (let i = 0; i < 30; i++) engine.advanceWeek(false);
  const market = engine.g.realEstateMarket;
  assert.ok(Array.isArray(market.history));
  assert.ok(Array.isArray(market.rivals) && market.rivals.length > 0, 'ライバルが生成され保持される');
  assert.ok(market.macro && Number.isFinite(market.macro.landIndex), 'マクロ指標が保持される');
  assert.equal(typeof modules.realEstateCompleteCycle.ensure(engine.g), 'object');
}

// 5. Migration: a save written while the collision existed has its object under
// realEstateCycle. That state must move to realEstateMarket rather than being discarded, and
// the numeric index must be handed back.
{
  const { modules, engine } = newGame();
  const legacyState = {
    schemaVersion: 1,
    loans: [{ id: 'L1', amount: 1000 }],
    rivals: [{ id: 'RIVAL-9', name: '旧ライバル' }],
    events: [{ id: 'E1' }],
    history: [{ week: 3 }],
    vehicles: [{ id: 'V1', type: 'reit' }],
    macro: { policyRate: .02, inflation: .01, landIndex: 123, constructionIndex: 100, rentIndex: 100, cycle: 'normal' },
    lastProcessedWeek: 5
  };
  engine.g.realEstateCycle = legacyState;
  delete engine.g.realEstateMarket;
  const migrated = modules.realEstateCompleteCycle.ensure(engine.g);
  assert.equal(typeof engine.g.realEstateCycle, 'number', '旧セーブでも数値インデックスへ戻る');
  assert.equal(migrated.loans[0].id, 'L1', 'ローンが引き継がれる');
  assert.equal(migrated.rivals[0].id, 'RIVAL-9', 'ライバルが引き継がれる');
  assert.equal(migrated.vehicles[0].id, 'V1', 'ビークルが引き継がれる');
  assert.equal(migrated.history[0].week, 3, '履歴が引き継がれる');
  assert.equal(migrated.macro.landIndex, 123, 'マクロ指標が引き継がれる');
  assert.equal(engine.g.realEstateMarket, migrated);
}

// 6. Migration does not clobber a real state that already exists under the new key.
{
  const { modules, engine } = newGame();
  const existing = { schemaVersion: 1, loans: [{ id: 'KEEP' }], rivals: [], events: [], history: [], vehicles: [], macro: { policyRate: .01, inflation: .01, landIndex: 100, constructionIndex: 100, rentIndex: 100, cycle: 'normal' }, lastProcessedWeek: 0 };
  engine.g.realEstateMarket = existing;
  engine.g.realEstateCycle = { loans: [{ id: 'STALE' }], rivals: [], events: [], history: [], vehicles: [] };
  const kept = modules.realEstateCompleteCycle.ensure(engine.g);
  assert.equal(kept.loans[0].id, 'KEEP', '新キーに既にstateがあれば旧キーで上書きしない');
  assert.equal(typeof engine.g.realEstateCycle, 'number');
}

// 7. A non-finite index is repaired rather than propagated. This is what silently produced a
// cycle-less market before: a corrupt value read as its clamp floor everywhere downstream.
{
  const { modules, engine } = newGame();
  for (const broken of [NaN, undefined, null, 'x', {}]) {
    engine.g.realEstateCycle = broken;
    modules.realEstateCompleteCycle.ensure(engine.g);
    assert.equal(typeof engine.g.realEstateCycle, 'number', `${String(broken)} から数値へ復旧する`);
    assert.ok(Number.isFinite(engine.g.realEstateCycle));
  }
}

// 8. Personal property values now respond to the index. With the collision in place the value
// the weekly loop saw was whatever macro-cycle had just rebuilt, never the real cycle.
{
  function runAt(cycleValue) {
    const { engine } = newGame();
    engine.g.personalCash = 500_000_000;
    assert.equal(engine.buyPersonalRealEstate('logistics-aichi'), true);
    const asset = engine.g.personalRealEstateHoldings[0];
    asset.currentValue = 95_000_000;
    asset.rentalOps.lastProcessedWeek = null;
    engine.g.realEstateCycle = cycleValue;
    engine.g.economy = 1;
    engine.updatePersonalExpandedWeekly();
    return asset.currentValue;
  }
  const slump = runAt(.7);
  const flat = runAt(1);
  const boom = runAt(1.3);
  assert.ok(slump < flat && flat < boom, `サイクルが個人不動産の評価額に効く (${slump} < ${flat} < ${boom})`);
}

// 9. Company property values respond to the index too, through engine.js's own pricing.
{
  const { engine } = newGame();
  const property = engine.g.properties.find(p => Number.isFinite(Number(p.basePrice)));
  assert.ok(property, '前提: basePriceを持つ物件が存在する');
  engine.g.economy = 1;
  engine.g.realEstateCycle = .8;
  engine.updateProperties?.();
  const low = property.value;
  engine.g.realEstateCycle = 1.3;
  engine.updateProperties?.();
  const high = property.value;
  if (Number.isFinite(low) && Number.isFinite(high)) {
    assert.ok(high > low, `会社物件の評価額もサイクルに追随する (${low} → ${high})`);
  }
}

// 10. Determinism and RNG budget are untouched: this is a state-naming fix, not a model change.
{
  function run() {
    const { engine } = newGame(31415);
    for (let i = 0; i < 25; i++) engine.advanceWeek(false);
    return JSON.stringify({ cycle: engine.g.realEstateCycle, cash: engine.g.companyCash, week: engine.g.week });
  }
  assert.equal(run(), run(), '同じseedで同じ結果になる');

  let calls = 0;
  const inner = lcg();
  const counting = () => { calls++; return inner(); };
  const { ctx } = loadGame({ random: counting });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  engine.advanceWeek(false);
  const first = calls;
  engine.advanceWeek(false);
  assert.ok(calls - first > 0, '週次処理は従来どおり乱数を消費する（消費ゼロになっていない）');
}

// 11. Save/reload keeps both states on their own keys.
{
  const { modules, engine } = newGame();
  for (let i = 0; i < 10; i++) engine.advanceWeek(false);
  const cycle = engine.g.realEstateCycle;
  const rivals = engine.g.realEstateMarket.rivals.length;
  engine.save();
  const reloaded = modules.engine.TycoonEngine.load();
  assert.equal(typeof reloaded.g.realEstateCycle, 'number');
  assert.equal(reloaded.g.realEstateCycle, cycle, 'reload後も数値インデックスが一致する');
  assert.equal(reloaded.g.realEstateMarket.rivals.length, rivals, 'reload後もモジュールstateが残る');
  assert.equal(reloaded.g.saveVersion, 9);
}

console.log('real estate cycle state collision tests passed');
