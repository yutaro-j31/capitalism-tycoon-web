'use strict';

// T1 (docs/PE_MODE_TASKS.md): competing PE roster + deterministic participation
// judgement. This does not touch js/ma-deal-room.js's existing single-competitor
// bidding flow, so these tests only cover js/pe-rivals.js in isolation.

const assert = require('node:assert/strict');
const fs = require('node:fs');

function load() {
  delete globalThis.__capitalismTycoonModules;
  globalThis.localStorage = { store: {}, getItem(k) { return this.store[k] || null; }, setItem(k, v) { this.store[k] = String(v); }, removeItem(k) { delete this.store[k]; } };
  globalThis.document = { addEventListener() {} };
  globalThis.window = globalThis;
  for (const m of ['../js/runtime.js', '../js/data.js', '../js/workforce.js', '../js/supply.js', '../js/competitor.js', '../js/competitor-projects.js', '../js/competitor-entry.js', '../js/competitor-credit.js', '../js/competitor-distress.js', '../js/market.js', '../js/finance.js', '../js/engine.js', '../js/save-v9.js', '../js/ma-integration.js', '../js/ma-deal-room.js', '../js/pe-rivals.js']) {
    delete require.cache[require.resolve(m)];
    require(m);
  }
  const modules = globalThis.__capitalismTycoonModules;
  modules.maIntegration.installMAIntegration(modules.engine.TycoonEngine);
  modules.maDealRoom.installMADealRoom(modules.engine.TycoonEngine);
  return { modules, TycoonEngine: modules.engine.TycoonEngine, pe: modules.peRivals };
}

// Every runtime module (js/runtime.js's __capitalismTycoonModules registry) is designed to
// be registered exactly once per process, so this file -- unlike a full-suite harness --
// calls load() a single time and reuses its TycoonEngine/pe handles across scenarios below.
const { TycoonEngine, pe } = load();

function target(overrides = {}) {
  return { id: 't-1', name: 'テスト対象', domain: '外食', valuation: 100_000_000, sales: 70_000_000, operatingProfit: 8_000_000, growth: .1, risk: .1, synergy: .05, friendly: true, expiresWeek: 9999, ...overrides };
}

// 1. state.peRivals holds exactly the 5-firm fixed roster from docs/PE_MODE_DESIGN.md §5.
{
  const engine = new TycoonEngine();
  assert.equal(engine.g.peRivals.length, 5, 'roster must have exactly 5 firms');
  const byId = Object.fromEntries(engine.g.peRivals.map(f => [f.id, f]));
  assert.equal(byId['foreign-major'].aggressiveness, 1.06);
  assert.equal(byId['local-firm'].aggressiveness, 1.02);
  assert.equal(byId['turnaround-specialist'].aggressiveness, .95);
  assert.equal(byId['strategic-buyer'].aggressiveness, 1.12);
  assert.equal(byId['emerging-fund'].aggressiveness, 1.04);
}

// 2. Old saves (missing peRivals entirely) load without error and end up with the roster.
{
  const legacy = new TycoonEngine().g;
  delete legacy.peRivals;
  legacy.saveVersion = 9;
  assert.doesNotThrow(() => new TycoonEngine(legacy), 'loading a save without peRivals must not throw');
  const loaded = new TycoonEngine(legacy);
  assert.equal(loaded.g.peRivals.length, 5, 'legacy save must end up with the 5-firm roster after normalize');
}

// 2b. A save with a corrupted/partial peRivals value also recovers safely.
{
  const legacy = new TycoonEngine().g;
  legacy.peRivals = [{ id: 'foreign-major' }]; // truncated / malformed
  legacy.saveVersion = 9;
  const loaded = new TycoonEngine(legacy);
  assert.equal(loaded.g.peRivals.length, 5, 'malformed peRivals must be repaired to the 5-firm roster');
}

// 3. Determinism: same target + same week always returns the same participants, no
// matter how many times or in what order it is evaluated, and it is stable across
// save/reload.
{
  const engine = new TycoonEngine();
  const t = target({ valuation: 1_500_000_000, synergy: .2, operatingProfit: -1 });
  const first = pe.participatingRivals(engine.g, t, 42).map(f => f.id);
  const second = pe.participatingRivals(engine.g, t, 42).map(f => f.id);
  assert.deepEqual(second, first, 'repeated calls with identical inputs must return identical participants');

  const reversedRosterEngine = new TycoonEngine();
  reversedRosterEngine.g.peRivals = [...reversedRosterEngine.g.peRivals].reverse();
  const thirdRaw = pe.participatingRivals(reversedRosterEngine.g, t, 42);
  assert.deepEqual(new Set(thirdRaw.map(f => f.id)), new Set(first), 'roster array order must not change who participates');

  engine.save();
  const reloaded = TycoonEngine.load();
  const afterReload = pe.participatingRivals(reloaded.g, t, 42).map(f => f.id);
  assert.deepEqual(afterReload, first, 'save/reload must not change deterministic participation');
}

// 4. Different weeks for the same target can produce different participants (the
// judgement is not a static property of the target alone).
{
  const engine = new TycoonEngine();
  const t = target({ valuation: 1_500_000_000 });
  const resultsByWeek = new Set();
  for (let week = 1; week <= 30; week++) resultsByWeek.add(JSON.stringify(pe.participatingRivals(engine.g, t, week).map(f => f.id)));
  assert.ok(resultsByWeek.size > 1, 'participation should vary across weeks for the same target');
}

// 5. All 5 firms can participate for some (target, week) combination -- eligibility
// conditions from §5 are each individually satisfiable and reachable through the
// deterministic appearance roll.
{
  const engine = new TycoonEngine();
  const scenarios = {
    'foreign-major': target({ valuation: 1_500_000_000 }),
    'local-firm': target({ valuation: 80_000_000 }),
    'turnaround-specialist': target({ operatingProfit: -5_000_000, risk: .3 }),
    'strategic-buyer': target({ synergy: .18 }),
    'emerging-fund': target({})
  };
  for (const [firmID, scenarioTarget] of Object.entries(scenarios)) {
    let seen = false;
    for (let week = 1; week <= 500 && !seen; week++) {
      if (pe.participatingRivals(engine.g, scenarioTarget, week).some(f => f.id === firmID)) seen = true;
    }
    assert.ok(seen, `${firmID} must be able to participate in at least one (target, week)`);
  }
}

// 6. Eligibility conditions actually gate participation: a target engineered to fail
// every condition never draws any of the 5 firms. Weeks are past emerging-fund's
// early-game-only window (pe.EARLY_GAME_WEEK_LIMIT) so that condition cannot fire either.
{
  const engine = new TycoonEngine();
  const neverEligible = target({ valuation: 500_000_000, operatingProfit: 5_000_000, risk: .1, synergy: .02 });
  for (let week = pe.EARLY_GAME_WEEK_LIMIT + 1; week <= pe.EARLY_GAME_WEEK_LIMIT + 400; week += 7) {
    assert.deepEqual(pe.participatingRivals(engine.g, neverEligible, week), [], `week ${week} should draw no participants for an ineligible target`);
  }
}

// 7. participatingRivals(state, null/undefined, week) is handled safely.
{
  const engine = new TycoonEngine();
  assert.deepEqual(pe.participatingRivals(engine.g, null, 1), []);
  assert.deepEqual(pe.participatingRivals(engine.g, undefined, 1), []);
}

// 8. This task must not touch the existing single-competitor bidding flow.
{
  const src = fs.readFileSync('js/ma-deal-room.js', 'utf8');
  assert.ok(src.includes('competingBid'), 'sanity: ma-deal-room.js still has the legacy competingBid flow');
  assert.ok(!src.includes('peRivals'), 'ma-deal-room.js must not be wired to peRivals yet (that is a later task)');
}

// 9. No new Math.random()/Date.now()/randomUUID usage.
{
  const src = fs.readFileSync('js/pe-rivals.js', 'utf8');
  assert.ok(!src.includes('Math.random()'));
  assert.ok(!src.includes('Date.now()'));
  assert.ok(!src.includes('randomUUID'));
}

console.log('pe rivals tests passed');
