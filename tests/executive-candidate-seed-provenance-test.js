'use strict';

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const { engineModule, modules } = loadGame({ headless: true, random: () => 0.2718281828 });
const executives = modules.executivesDepartmentAssignments;

assert.ok(executives?.__installed, 'executives department assignments must be installed');

function candidateSnapshot({
  seed,
  companyName = 'Seeded Holdings',
  ticker = 'SEED',
  playerName = 'Founder',
  week = 37
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
  state.week = week;

  assert.equal(state.simulationRng.seed, seed, 'explicit scenario seed must be persisted');
  const drawsBefore = state.simulationRng.draws;
  const candidates = executives.generate(state).map(row => ({
    id: row.id,
    name: row.name,
    role: row.role,
    skill: row.skill,
    salary: row.salary,
    fit: row.fit,
    status: row.status
  }));

  assert.equal(
    state.simulationRng.draws,
    drawsBefore,
    'keyed executive candidate generation must not consume the main simulation RNG stream'
  );

  return {
    seed: state.simulationRng.seed,
    drawsBefore,
    drawsAfter: state.simulationRng.draws,
    candidates
  };
}

// 1. Nuisance-input invariance: identity labels are not entropy.
{
  const seed = 0x8315eed;
  const cases = [
    { companyName: 'Alpha Holdings', ticker: 'ALPH', playerName: 'Alice' },
    { companyName: 'まったく別の会社', ticker: 'ZZZZ', playerName: '別の創業者' },
    { companyName: 'Third Fixture', ticker: 'THRD', playerName: 'Carol' }
  ].map(identity => candidateSnapshot({ seed, ...identity }));

  for (const row of cases) {
    assert.equal(row.seed, seed);
    assert.deepEqual(
      row.candidates,
      cases[0].candidates,
      'same simulation seed/week must produce identical executive candidates regardless of company/ticker/player labels'
    );
  }
}

// 2. Replay determinism: same seed + semantic key replays exactly.
{
  const a = candidateSnapshot({ seed: 0x8310001, week: 52 });
  const b = candidateSnapshot({ seed: 0x8310001, week: 52 });
  assert.deepEqual(a, b, 'same seed and week must replay the exact candidate set');
}

// 3. Seed sensitivity: different game seeds can select different candidates.
{
  const seeds = [0x8311001, 0x8311002, 0x8311003, 0x8311004];
  const signatures = seeds.map(seed => JSON.stringify(candidateSnapshot({ seed }).candidates));
  assert.ok(new Set(signatures).size > 1, 'different simulation seeds must be able to produce different candidate sets');
}

// 4. Save compatibility: normalize/ensure must not silently regenerate already persisted candidates.
{
  const state = engineModule.createInitialState({
    configured: true,
    companyName: 'Legacy Candidate Co',
    playerName: 'Founder',
    difficulty: 'normal',
    scenario: 'free',
    seed: 0x8312001
  });
  const persisted = {
    id: 'legacy-persisted-candidate',
    name: '保存済み候補',
    role: 'CFO',
    skill: 77,
    salary: 90000,
    fit: 'finance',
    status: 'candidate'
  };
  state.executiveManagement = {
    candidates: [persisted],
    executives: [],
    assignments: {},
    history: [{ week: 12, type: 'candidates-generated', count: 1 }]
  };
  const before = JSON.parse(JSON.stringify(state.executiveManagement.candidates));
  executives.ensure(state);
  assert.deepEqual(
    JSON.parse(JSON.stringify(state.executiveManagement.candidates)),
    before,
    'existing saved candidates must survive normalization unchanged until the player explicitly refreshes them'
  );
}

console.log('executive candidate seed provenance tests passed');
