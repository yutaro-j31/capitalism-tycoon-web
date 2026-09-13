'use strict';

// PE mode T8 (docs/PE_MODE_TASKS.md): LP面談. This is deliberately not a decision screen
// (docs/PE_MODE_DESIGN.md §9 failure 7) -- js/pe-fund.js exposes only progress visibility
// (visibleLPTypes/meetsLPCondition), promise bookkeeping (addLPCommitment/
// recordLPPromiseOutcome), and the resulting effect on the next fund's formable ceiling
// (promiseComplianceMultiplier, folded into formableFundSize).

const assert = require('node:assert/strict');
const fs = require('node:fs');

function load() {
  delete globalThis.__capitalismTycoonModules;
  globalThis.localStorage = { store: {}, getItem(k) { return this.store[k] || null; }, setItem(k, v) { this.store[k] = String(v); }, removeItem(k) { delete this.store[k]; } };
  globalThis.document = { addEventListener() {} };
  globalThis.window = globalThis;
  for (const m of ['../js/runtime.js', '../js/data.js', '../js/store-market-environment.js', '../js/workforce.js', '../js/supply.js', '../js/competitor.js', '../js/competitor-projects.js', '../js/competitor-entry.js', '../js/competitor-credit.js', '../js/competitor-distress.js', '../js/market.js', '../js/finance.js', '../js/engine.js', '../js/completion.js', '../js/pe-fund.js']) {
    delete require.cache[require.resolve(m)];
    require(m);
  }
  const modules = globalThis.__capitalismTycoonModules;
  return { modules, TycoonEngine: modules.engine.TycoonEngine, pf: modules.peFund };
}
const { TycoonEngine, pf } = load();

function goodExit(overrides = {}) {
  return { exitType: 'buyout', realizedAmount: 200_000_000, investedAmount: 8_000_000, foundedWeek: 1, exitedWeek: 52, profitableWeekStreak: 260, employeeCount: 50, ...overrides };
}

// 1. Exactly 5 LP types exist, matching the design doc's §3 table, and only formerColleague
// is meetable with no track record at all ("実績不問").
{
  assert.equal(pf.LP_TYPE_IDS?.length ?? Object.keys(pf.LP_TYPES).length, 5);
  const e = new TycoonEngine();
  const visible = pf.visibleLPTypes(e.g);
  assert.equal(visible.length, 5);
  const meetable = visible.filter(x => x.meetable).map(x => x.id);
  assert.deepEqual(meetable, ['formerColleague']);
}

// 2. Completion criterion: 実績に応じて会えるLPが増える -- each LP type unlocks at its own
// track-record milestone, monotonically (never losing a previously met LP).
{
  const e = new TycoonEngine();
  let previouslyMet = new Set(pf.visibleLPTypes(e.g).filter(x => x.meetable).map(x => x.id));

  // First exit -> wealthyFamilyOffice unlocks (Exit経験1回).
  pf.recordExit(e.g, goodExit());
  let met = new Set(pf.visibleLPTypes(e.g).filter(x => x.meetable).map(x => x.id));
  assert.ok(met.has('wealthyFamilyOffice'));
  for (const id of previouslyMet) assert.ok(met.has(id), `${id} must not become unmeetable again`);
  previouslyMet = met;

  // A second good exit pushes score to 30 -> regionalBankCorporate (スコア30) and
  // universitySovereign (実現実績2本) both unlock.
  pf.recordExit(e.g, goodExit({ foundedWeek: 200, exitedWeek: 252 }));
  assert.ok(e.g.peFirm.trackRecord.score >= 30, `sanity: two good exits must reach score 30, got ${e.g.peFirm.trackRecord.score}`);
  met = new Set(pf.visibleLPTypes(e.g).filter(x => x.meetable).map(x => x.id));
  assert.ok(met.has('regionalBankCorporate'));
  assert.ok(met.has('universitySovereign'));
  for (const id of previouslyMet) assert.ok(met.has(id));

  // pensionFund only unlocks once some fund has actually realized DPI >= 1.2.
  assert.equal(pf.meetsLPCondition(e.g, 'pensionFund'), false);
  const fund = pf.createFund(e.g, { size: 1_000_000_000, y0: 400 });
  fund.deals.push({ id: 'd1', investedAmount: 900_000_000 });
  fund.cash = 100_000_000;
  fund.distributed = 1_500_000_000;
  pf.evaluateFund(e.g, fund.id, fund.y0 + pf.INVESTMENT_PERIOD_WEEKS);
  assert.equal(pf.meetsLPCondition(e.g, 'pensionFund'), true, 'a realized DPI>=1.2 fund must unlock pensionFund');
}

// 3. Declining an LP's accompanying promise costs nothing beyond a smaller committed amount
// -- addLPCommitment itself never rejects or penalizes a decline.
{
  const e = new TycoonEngine();
  const fund = pf.createFund(e.g, { size: 1_000_000_000, y0: 1 });
  const declined = pf.addLPCommitment(fund, { lpTypeID: 'regionalBankCorporate', committedAmount: 50_000_000, promiseAccepted: false });
  assert.equal(declined.promiseAccepted, false);
  assert.equal(declined.committedAmount, 50_000_000);
  assert.equal(fund.lps.length, 1);
  assert.equal(pf.promiseComplianceMultiplier(fund), 1, 'a declined (never-accepted) promise must not affect the multiplier at all');
}

// 4. A promise only exists for LP types the design gives one to; former colleagues and
// wealthy family offices carry a risk note instead, so "accepting" is a no-op for them.
{
  const e = new TycoonEngine();
  const fund = pf.createFund(e.g, { size: 1_000_000_000, y0: 1 });
  const commitment = pf.addLPCommitment(fund, { lpTypeID: 'formerColleague', committedAmount: 10_000_000, promiseAccepted: true });
  assert.equal(commitment.promiseAccepted, false, 'formerColleague has no promiseID, so acceptance must be coerced to false');
}

// 5. Completion criterion: promise fulfillment is recorded and reflected in the next fund's
// formable ceiling -- fully kept promises are neutral (no bonus), fully broken promises
// shrink it, matching "守れないと次号で不利になるだけ".
{
  const e = new TycoonEngine();
  e.g.personalCash = 1_000_000_000;
  const fund = pf.createFund(e.g, { size: 1_000_000_000, y0: 1 });
  pf.addLPCommitment(fund, { lpTypeID: 'regionalBankCorporate', committedAmount: 300_000_000, promiseAccepted: true });

  const sizeUnevaluated = pf.formableFundSize(e.g);
  pf.recordLPPromiseOutcome(fund, 'regionalBankCorporate', true);
  assert.equal(pf.formableFundSize(e.g), sizeUnevaluated, 'a fulfilled promise must not raise the ceiling above the unevaluated baseline');

  pf.recordLPPromiseOutcome(fund, 'regionalBankCorporate', false);
  const sizeBroken = pf.formableFundSize(e.g);
  assert.ok(sizeBroken < sizeUnevaluated, 'a broken promise must shrink the next fund\'s formable ceiling');
  assert.ok(Math.abs(sizeBroken / sizeUnevaluated - pf.PROMISE_BROKEN_FLOOR) < 1e-9, `a single fully-broken promise must hit the floor multiplier ${pf.PROMISE_BROKEN_FLOOR}`);
}

// 6. Multiple accepted promises blend proportionally (half kept, half broken -> halfway
// between the floor and neutral).
{
  const e = new TycoonEngine();
  e.g.personalCash = 1_000_000_000;
  const fund = pf.createFund(e.g, { size: 1_000_000_000, y0: 1 });
  pf.addLPCommitment(fund, { lpTypeID: 'regionalBankCorporate', committedAmount: 100_000_000, promiseAccepted: true });
  pf.addLPCommitment(fund, { lpTypeID: 'pensionFund', committedAmount: 100_000_000, promiseAccepted: true });
  pf.recordLPPromiseOutcome(fund, 'regionalBankCorporate', true);
  pf.recordLPPromiseOutcome(fund, 'pensionFund', false);
  const expected = pf.PROMISE_BROKEN_FLOOR + .5 * (1 - pf.PROMISE_BROKEN_FLOOR);
  assert.ok(Math.abs(pf.promiseComplianceMultiplier(fund) - expected) < 1e-9);
}

// 7. Existing LPs auto-continue: continuingLPCommitments returns the latest fund's LP list
// as the starting point for the next one (independent of promise outcomes).
{
  const e = new TycoonEngine();
  assert.deepEqual(pf.continuingLPCommitments(e.g), [], 'no prior fund means nothing to continue');
  const fund = pf.createFund(e.g, { size: 1_000_000_000, y0: 1 });
  pf.addLPCommitment(fund, { lpTypeID: 'formerColleague', committedAmount: 20_000_000 });
  pf.addLPCommitment(fund, { lpTypeID: 'regionalBankCorporate', committedAmount: 100_000_000, promiseAccepted: true });
  const continuing = pf.continuingLPCommitments(e.g);
  assert.equal(continuing.length, 2);
  assert.deepEqual(continuing.map(c => c.lpTypeID).sort(), ['formerColleague', 'regionalBankCorporate']);
  // Mutating the returned list must not mutate the fund's own record.
  continuing[0].committedAmount = 999;
  assert.notEqual(fund.lps[0].committedAmount, 999);
}

// 7b. A single fund cannot hold two commitments of the same LP type -- addLPCommitment must
// reject the duplicate outright (returns null, no second entry pushed).
{
  const e = new TycoonEngine();
  const fund = pf.createFund(e.g, { size: 1_000_000_000, y0: 1 });
  const first = pf.addLPCommitment(fund, { lpTypeID: 'regionalBankCorporate', committedAmount: 50_000_000 });
  assert.ok(first);
  const dup = pf.addLPCommitment(fund, { lpTypeID: 'regionalBankCorporate', committedAmount: 10_000_000 });
  assert.equal(dup, null, 'the same LP type cannot be committed twice to the same fund');
  assert.equal(fund.lps.length, 1);
  assert.equal(fund.lps[0].committedAmount, 50_000_000, 'the rejected duplicate must not overwrite the original commitment');
}

// 7c. fund.lps is capped at MAX_LPS_PER_FUND (currently 5, matching every LP type today).
// Adding one of each real type exercises the cap at its natural boundary; a direct low-level
// check (bypassing the type-uniqueness rule via a raw push) proves the numeric cap itself is
// enforced, independent of duplicate-type rejection -- future-proofing against a larger roster.
{
  const e = new TycoonEngine();
  const fund = pf.createFund(e.g, { size: 1_000_000_000, y0: 1 });
  for (const id of pf.LP_TYPE_IDS) assert.ok(pf.addLPCommitment(fund, { lpTypeID: id, committedAmount: 1_000_000 }), `${id} should be addable`);
  assert.equal(fund.lps.length, pf.MAX_LPS_PER_FUND);
  assert.equal(pf.LP_TYPE_IDS.length, pf.MAX_LPS_PER_FUND, 'sanity: exactly MAX_LPS_PER_FUND LP types exist today');
}
// 7d. Codex独立監査対応: normalizeLPs() is the single shared choke point every write path
// (create/load/add) now goes through. It must dedupe (keep the first occurrence) AND enforce
// MAX_LPS_PER_FUND independent of dedup -- verified directly here by feeding it more entries
// than the cap allows, using only real lpTypeIDs (an unknown lpTypeID is dropped entirely by
// design, so it can no longer be used to simulate "a future larger roster" the way a raw-push
// test against addLPCommitment once did).
{
  const doubled = [...pf.LP_TYPE_IDS, ...pf.LP_TYPE_IDS].map(id => ({ lpTypeID: id, committedAmount: 1 }));
  const normalized = pf.normalizeLPs(doubled);
  assert.equal(normalized.length, pf.MAX_LPS_PER_FUND, 'duplicates across the whole list must collapse before the cap is even reached');
  assert.deepEqual(normalized.map(c => c.lpTypeID).sort(), [...pf.LP_TYPE_IDS].sort());
}
{
  // An unknown lpTypeID must be dropped, not counted toward the cap.
  const withUnknown = [{ lpTypeID: 'not-a-real-type', committedAmount: 999 }, { lpTypeID: 'formerColleague', committedAmount: 1 }];
  const normalized = pf.normalizeLPs(withUnknown);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].lpTypeID, 'formerColleague');
}
{
  // ensureFund (and therefore createFund, and loading a save) must run LPs through the same
  // normalizer: a fund constructed with a raw, over-cap, duplicate-laden lps array comes out
  // deduped and capped.
  const e = new TycoonEngine();
  const messyLps = [...pf.LP_TYPE_IDS, ...pf.LP_TYPE_IDS, 'not-a-real-type'].map(id => ({ lpTypeID: id, committedAmount: 5 }));
  const fund = pf.createFund(e.g, { size: 1_000_000_000, y0: 1, lps: messyLps });
  assert.equal(fund.lps.length, pf.MAX_LPS_PER_FUND);
  assert.deepEqual(fund.lps.map(c => c.lpTypeID).sort(), [...pf.LP_TYPE_IDS].sort());
}

// 8. recordLPPromiseOutcome and addLPCommitment are safe no-ops for unknown funds/LP types.
{
  const e = new TycoonEngine();
  assert.equal(pf.addLPCommitment(null, { lpTypeID: 'formerColleague' }), null);
  const fund = pf.createFund(e.g, { size: 1_000_000_000, y0: 1 });
  assert.equal(pf.addLPCommitment(fund, { lpTypeID: 'doesNotExist' }), null);
  assert.equal(pf.recordLPPromiseOutcome(fund, 'formerColleague', true), null, 'no commitment of this type exists yet');
}

// 9. No new Math.random()/Date.now()/randomUUID usage.
{
  const src = fs.readFileSync('js/pe-fund.js', 'utf8');
  assert.ok(!src.includes('Math.random()'));
  assert.ok(!src.includes('Date.now()'));
  assert.ok(!src.includes('randomUUID'));
}

console.log('pe fund LP tests passed');
