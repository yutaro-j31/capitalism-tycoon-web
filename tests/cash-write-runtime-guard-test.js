'use strict';
// Track B1 runtime guard (Owner decision 2026-10-20): complements the lexical
// cash-writer ratchet. Representative strategy runs execute with every root
// companyCash / personalCash assignment attributed to the production function that
// made it. The observed writer set must equal the reviewed baseline, and the guard
// must not change the simulation result.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SCENARIOS, SEEDS, makeRandom, runScenario } = require('./strategy-balance-runner');
const { loadGame } = require('./harness');
const { installCashWriteGuard } = require('./fixtures/cash-write-guard');

const BASELINE_PATH = path.join(__dirname, 'fixtures', 'cash-write-runtime-baseline.json');
const CASES = Object.freeze([
  ['ramen-bootstrap', SEEDS[0]],
  ['cram-school', SEEDS[1]],
  ['real-estate-agency', SEEDS[2]],
]);

// Self-check: the guard sees writes, keeps plain data semantics and survives root replacement.
{
  const loaded = loadGame({ random: makeRandom(1) });
  const guard = installCashWriteGuard(loaded);
  const engine = new loaded.engineModule.TycoonEngine();
  engine.configure({ playerName: 'guard', companyName: 'guard', difficulty: 'normal', scenario: 'free' });
  const before = engine.g.companyCash;
  engine.g.companyCash += 1;
  assert.equal(engine.g.companyCash, before + 1, 'guarded field must read back the written value');
  assert.equal(guard.writes.get('(test)'), 1, 'a write from outside production code must be attributed to (test)');
  const copy = structuredClone(engine.g);
  assert.equal(Object.getOwnPropertyDescriptor(copy, 'companyCash').value, before + 1, 'clones must carry plain values');
  assert.equal(JSON.parse(JSON.stringify(engine.g)).companyCash, before + 1, 'JSON must carry plain values');
  engine.g = copy;
  copy.personalCash -= 1;
  assert.equal(guard.writes.get('(test)'), 2, 'a replaced root must be guarded again');
}

const observed = new Set();
for (const [scenarioID, seed] of CASES) {
  const scenario = SCENARIOS.find(row => row.id === scenarioID);
  assert.ok(scenario, `missing strategy scenario: ${scenarioID}`);
  const plain = runScenario(scenario, seed);
  let guard = null;
  const guarded = runScenario(scenario, seed, { onLoad: loaded => { guard = installCashWriteGuard(loaded); } });
  assert.ok(guard && guard.writes.size > 0, `${scenarioID}: the guard observed no cash writes`);
  // Each run has its own vm realm, so compare serialized results (also pins key order).
  assert.equal(JSON.stringify(guarded), JSON.stringify(plain), `${scenarioID}: the guard changed the simulation result`);
  for (const site of guard.writes.keys()) {
    assert.ok(/^js\/[\w./-]+\.js#/.test(site), `${scenarioID}: cash write outside production code or unattributed: ${site}`);
    observed.add(site);
  }
}

const sites = [...observed].sort();
if (process.env.UPDATE_CASH_WRITE_RUNTIME_BASELINE === '1') {
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify({ cases: CASES, sites }, null, 2)}\n`);
  console.log(`cash write runtime baseline written: ${sites.length} sites`);
}
const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
assert.deepEqual(baseline.cases, CASES.map(row => [...row]), 'baseline cases differ from the test cases');
const added = sites.filter(site => !baseline.sites.includes(site));
const removed = baseline.sites.filter(site => !sites.includes(site));
assert.deepEqual({ added, removed }, { added: [], removed: [] },
  'root cash writer set changed; review the writer, then regenerate with UPDATE_CASH_WRITE_RUNTIME_BASELINE=1');
console.log(`cash write runtime guard passed: ${sites.length} attributed writer sites`);
