'use strict';
// Whole-yen ceiling rounding ratchet (docs/economic-engine/YEN_CEILING_ROUNDING_CONTRACT.md §6).
// Lexical: only files listed in pendingFiles may still round money to ¥0.01, and a listed file that no longer
// does is stale and must be removed. Runtime: each migration slice registers focused scenarios below whose
// ledger rows and written state fields must be whole yen.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'yen-ceiling-rounding-baseline.json'), 'utf8'));
const CENT_PATTERN = /\*\s*100\s*\)\s*\/\s*100(?![0-9])/;
const EXEMPT = /\/\*\s*not-money:\s*\S[^*]*\*\//;

assert.equal(baseline.schema, 1);
assert.ok(Array.isArray(baseline.pendingFiles));
assert.deepEqual([...baseline.pendingFiles], [...new Set(baseline.pendingFiles)].sort(), 'pendingFiles is sorted and unique');

assert.ok(CENT_PATTERN.test('const r=v=>Math.round(v*100)/100;') && CENT_PATTERN.test('Math.round(x * 100 ) / 100'), 'cent pattern matches its spacing variants');
assert.ok(!CENT_PATTERN.test('Math.round(x*100)/1000'), 'a different divisor is not a cent pattern');
assert.ok(EXEMPT.test('Math.round(rate*100)/100 /* not-money: rate */') && !EXEMPT.test('Math.round(x*100)/100 /* not-money: */'), 'exemption needs a stated reason');

function centLines(file) {
  return fs.readFileSync(path.join(root, file), 'utf8').split('\n')
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => CENT_PATTERN.test(line) && !EXEMPT.test(line));
}
const files = fs.readdirSync(path.join(root, 'js')).filter(name => name.endsWith('.js')).sort().map(name => `js/${name}`);
const pending = new Set(baseline.pendingFiles);
for (const file of pending) assert.ok(files.includes(file), `pendingFiles lists ${file}, which does not exist`);
const unlisted = [], stale = [];
for (const file of files) {
  const hits = centLines(file);
  if (hits.length && !pending.has(file)) unlisted.push(`${file}:${hits.map(hit => hit.number).join(',')}`);
  if (!hits.length && pending.has(file)) stale.push(file);
}
assert.deepEqual(unlisted, [], 'cent rounding outside pendingFiles; use economicOperation.ceilYen, or mark a non-money line with /* not-money: ... */');
assert.deepEqual(stale, [], 'stale pendingFiles entries; remove them from tests/fixtures/yen-ceiling-rounding-baseline.json');

// Runtime: the row check itself must reject fractions, so a slice scenario cannot pass vacuously.
const EFFECTS = ['amount', 'cashEffect', 'profitEffect', 'assetEffect', 'liabilityEffect', 'equityEffect'];
function fractionalFields(row) { return EFFECTS.filter(key => row[key] !== undefined && !Number.isSafeInteger(Number(row[key]))); }
assert.deepEqual(fractionalFields({ amount: 13, cashEffect: -13, profitEffect: 0 }), []);
assert.deepEqual(fractionalFields({ amount: 12.3, cashEffect: -12.3 }), ['amount', 'cashEffect']);

// Each migration slice appends { slice, label, run } where run() returns { rows, state } for its migrated writers,
// starting from whole-yen balances (contract §6). R0 adds the helpers only; no writer is migrated yet.
const SCENARIOS = [];
for (const scenario of SCENARIOS) {
  const { rows, state = {} } = scenario.run();
  assert.ok(rows.length > 0, `${scenario.slice} ${scenario.label}: scenario posts at least one row`);
  for (const row of rows) assert.deepEqual(fractionalFields(row), [], `${scenario.slice} ${scenario.label}: ${row.category} ${row.sourceType} is whole yen`);
  for (const [key, value] of Object.entries(state)) assert.ok(Number.isSafeInteger(value), `${scenario.slice} ${scenario.label}: ${key}=${value} is whole yen`);
}

console.log(`PASS yen ceiling rounding guard: ${pending.size} pending file(s), ${SCENARIOS.length} migrated scenario(s)`);
