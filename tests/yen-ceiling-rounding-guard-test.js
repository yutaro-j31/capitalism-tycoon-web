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
// starting from whole-yen balances (contract §6).
const { loadGame } = require('./harness');
function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}
function newGame(seed) {
  const loaded = loadGame({ headless: true, random: lcg(seed) });
  const engine = new loaded.engineModule.TycoonEngine();
  engine.configure({ playerName: 'Founder', companyName: 'Yen Co', difficulty: 'normal' });
  const finance = loaded.modules.finance;
  engine.g.companyCash = 500_000_000;
  engine.g.personalCash = 100_000_000;
  engine.g.finance = finance.defaultFinanceState(engine.g);
  return { engine, finance };
}
const rowsSince = (g, count, keep) => g.finance.transactions.slice(count).filter(keep);
const SCENARIOS = [
  { slice: 'R1', label: 'depreciation: weekly charge rounds up, the final charge is capped at book − salvage', run() {
    const { engine, finance } = newGame(1101), g = engine.g;
    finance.addFixedAsset(g, { assetID: 'r1-full', acquisitionCost: 1_000_000, salvageValue: 100_000, usefulLifeWeeks: 260 });
    finance.addFixedAsset(g, { assetID: 'r1-tail', acquisitionCost: 1_000_000, salvageValue: 100_000, usefulLifeWeeks: 260, accumulatedDepreciation: 899_950, bookValue: 100_050 });
    const count = g.finance.transactions.length;
    finance.recordWeekly(g, { stores: [], other: {}, beginningCash: g.companyCash });
    const rows = rowsSince(g, count, row => row.sourceType === 'depreciation');
    const byID = Object.fromEntries(rows.map(row => [row.sourceID, row.amount]));
    assert.deepEqual(byID, { 'r1-full': 3462, 'r1-tail': 50 }, '900,000 / 260 = 3461.54 rounds up to 3462; the tail is capped at 50');
    const [full, tail] = g.finance.fixedAssets.filter(a => a.assetID.startsWith('r1-'));
    assert.equal(tail.bookValue, 100_000);
    return { rows, state: { fullBook: full.bookValue, fullAccumulated: full.accumulatedDepreciation, tailBook: tail.bookValue, tailAccumulated: tail.accumulatedDepreciation } };
  } },
  { slice: 'R1', label: 'generic interest on company debt and the founder lender share', run() {
    const { engine } = newGame(1102), g = engine.g;
    assert.equal(engine.borrow(12_345_679, 'company'), true);
    assert.equal(engine.foundersLoanToCompany(3_000_001), true);
    const count = g.finance.transactions.length;
    engine.advanceWeek(false);
    const rows = rowsSince(g, count, row => row.sourceType === 'weekly-interest');
    return { rows, state: {} };
  } },
  { slice: 'R1', label: 'voluntary prepayment of a fractional request', run() {
    const { engine } = newGame(1103), g = engine.g;
    assert.equal(engine.borrow(20_000_000, 'company'), true);
    const count = g.finance.transactions.length;
    assert.equal(engine.prepayCompanyDebtVoluntarily(1_234_567.3), true);
    const rows = rowsSince(g, count, row => row.sourceType === 'voluntaryDebtPrepayment');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].amount, 1_234_568, 'a requested ¥0.3 rounds up to the next yen');
    const before = g.finance.transactions.length;
    assert.equal(engine.prepayCompanyDebtVoluntarily(5e-10), false, 'a request that rounds to ¥0 is rejected, not reported as paid');
    assert.equal(g.finance.transactions.length, before);
    return { rows, state: { companyCash: g.companyCash, companyDebt: g.companyDebt } };
  } },
];
for (const scenario of SCENARIOS) {
  const { rows, state = {} } = scenario.run();
  assert.ok(rows.length > 0, `${scenario.slice} ${scenario.label}: scenario posts at least one row`);
  for (const row of rows) assert.deepEqual(fractionalFields(row), [], `${scenario.slice} ${scenario.label}: ${row.category} ${row.sourceType} is whole yen`);
  for (const [key, value] of Object.entries(state)) assert.ok(Number.isSafeInteger(value), `${scenario.slice} ${scenario.label}: ${key}=${value} is whole yen`);
}

console.log(`PASS yen ceiling rounding guard: ${pending.size} pending file(s), ${SCENARIOS.length} migrated scenario(s)`);
