'use strict';

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const { engineModule, modules } = loadGame({ headless: true, random: () => 0.3141592653 });
const foundation = modules.deterministicEconomicFoundation;

assert.ok(foundation?.__installed, 'deterministic economic foundation must be installed');

function runMacroPath({
  seed,
  companyName = '固定会社',
  ticker = 'FIXD',
  playerName = '固定創業者',
  weeks = 156
}) {
  const state = engineModule.createInitialState({
    configured: true,
    companyName,
    playerName,
    difficulty: 'normal',
    scenario: 'free',
    seed
  });
  state.ticker = ticker;

  assert.equal(state.simulationRng.seed, seed, 'requested Phase 0.5 seed must be the persisted simulationRng seed');

  foundation.ensure(state);
  assert.equal(
    state.economicFoundation.seed,
    state.simulationRng.seed,
    'new-game economic foundation seed must derive from persisted simulationRng seed'
  );

  const drawsAtStart = state.simulationRng.draws;
  const path = [];

  for (let week = 1; week <= weeks; week++) {
    state.week = week;
    const row = foundation.step(state);
    path.push([
      row.week,
      row.phase,
      row.cycle,
      row.stress,
      row.economy,
      row.policyRate,
      row.inflationRate,
      row.exchangeRate,
      row.commodityIndex
    ]);
  }

  assert.equal(
    state.simulationRng.draws,
    drawsAtStart,
    'keyed economic-foundation draws must not consume the persisted simulation RNG stream'
  );

  return {
    requestedSeed: seed,
    simulationSeed: state.simulationRng.seed,
    foundationSeed: state.economicFoundation.seed,
    drawsAtStart,
    drawsAtEnd: state.simulationRng.draws,
    pathSignature: JSON.stringify(path)
  };
}

// Phase 0.5 seed-sweep guard: fixed identity, varied simulationRng seeds.
// If these collapse to one path, calibration statistics would be pseudo-replication.
{
  const seeds = [
    0x500001, 0x500002, 0x500003, 0x500004,
    0x500005, 0x500006, 0x500007, 0x500008
  ];
  const runs = seeds.map(seed => runMacroPath({ seed, companyName: '固定会社', ticker: 'FIXD', playerName: '固定創業者' }));

  assert.equal(new Set(runs.map(row => row.simulationSeed)).size, seeds.length, 'every requested seed must reach persisted simulationRng uniquely');
  assert.equal(new Set(runs.map(row => row.foundationSeed)).size, seeds.length, 'economic foundation seed roots must vary with simulationRng');
  assert.equal(new Set(runs.map(row => row.pathSignature)).size, seeds.length, 'different simulationRng seeds must exercise distinct macro paths');
}

// Phase 0.5 nuisance guard: fixed simulationRng seed, varied identity labels.
// Names/tickers/player labels must not secretly select the economy.
{
  const seed = 0x5eed1234;
  const cases = [
    { companyName: '同名固定A', ticker: 'AAA', playerName: '創業者A' },
    { companyName: '完全に別の会社名', ticker: 'ZZZ', playerName: '創業者B' },
    { companyName: 'テスト会社-03', ticker: 'QWER', playerName: '別名' }
  ].map(identity => runMacroPath({ seed, ...identity }));

  for (const row of cases) {
    assert.equal(row.simulationSeed, seed);
    assert.equal(row.foundationSeed, seed);
    assert.equal(row.pathSignature, cases[0].pathSignature, 'company/ticker/player labels must not choose the macro path');
  }
}

// Explicit replay case: same seed and identity must reproduce exactly.
{
  const a = runMacroPath({ seed: 0x1234abcd, companyName: 'Replay Co', ticker: 'RPLY', playerName: 'Replay' });
  const b = runMacroPath({ seed: 0x1234abcd, companyName: 'Replay Co', ticker: 'RPLY', playerName: 'Replay' });
  assert.deepEqual(a, b, 'same explicit seed must replay the same macro path and seed provenance');
}

console.log('Phase 0.5 seed provenance and nuisance-independence contract passed');
