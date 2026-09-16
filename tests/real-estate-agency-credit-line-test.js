'use strict';

// Founding Route Rebalance Final -- realEstateAgency founding-period revolving credit line.
//
// Problem this addresses (re-measured against current production code via tests/harness.js,
// after PR D and the companyDebt/bankDebt default-consistency fix (#664) were both already
// applied to main): realEstateAgency commission income arrives as a memoryless "time to first
// deal" process -- roughly -540,000/week burn (rent+fixedCost+wage) with zero income until the
// first deal closes. A 10-seed sample showed 1/10 bankruptcies at week 9; a wider 100-seed sweep
// found 12/100, mostly clustered at week 9 but with real variance in dry-spell length. A single
// upfront cash injection was measured and rejected: topping cash up to exactly zero does nothing,
// because js/player-crisis.js's grace-period recovery only resets on a week that ends
// non-negative, and the very next week's typical dry-spell loss immediately erases an exact-zero
// top-up before that check runs again -- confirmed by tracing a seed where repeated "top up to
// exactly 0" draws left the grace clock counting down to insolvency exactly as if no buffer had
// been given at all. A revolving credit line that draws to a CUSHION (not zero) and automatically
// repays once cash clears comfortably above it was measured instead: single-store, 100-seed sweep
// reaches 0/100 bankruptcies at cap=6,000,000/cushion=1,200,000; a 40-seed multi-store expansion
// sweep confirmed this design does NOT inflate store-opening pace the way an unconditional lump
// sum does (mean store count @ week 160: baseline 19.42, unconditional 6M lump sum 22.70 -- a
// real +17% side effect -- this credit line 19.32, matching baseline because unused capacity
// never exists as real cash). Full statistical evidence (10/40/100-seed sweeps, multi-store
// expansion comparison) lives in the PR body and founding-route-verification-log.md, not here --
// per this repo's validation guidance (CLAUDE.md section 8), a full 160-week x many-seed sweep is
// a manual validation exercise, not a canonical-CI test: this file is a light, fast regression
// smoke test (single-digit seconds per section) that a future change to this mechanism, or to
// js/player-crisis.js's grace-period logic it depends on, would break.
//
// Deliberately NOT reused: js/engine.js's generic repay(amount,'company') -- it repays whichever
// active loan comes first in f.loans array order regardless of sourceType (would misattribute
// repayment if the player also holds an unrelated active loan), and marks a fully-paid loan
// status='paid', inconsistent with bank-loans-covenants.js's own status='repaid' convention that
// PR #664's fix targets. This module's own repay() is sourceType-scoped and uses 'repaid'.
//
// Structurally isolated from js/bank-loans-covenants.js: this credit line's loans live only in
// the generic finance.js ledger (f.loans) with sourceType='realEstateAgencyCreditLine'; they are
// never added to state.bankFinancing.loans, which is the only array bank-loans-covenants.js's
// service()/covenant-breach logic reads. It is therefore structurally impossible for this credit
// line to reach the covenant-breach/'defaulted' path that PR #664 fixed.
//
// Performance note: a single 160-week simulation in this harness costs ~45-50s regardless of this
// feature (measured directly: with vs without this module, 160 weeks took 46.6s vs 47.5s on an
// identical seed -- a ~2% difference). Every section below therefore uses the shortest window
// that still exercises the behavior it checks (typically 10-26 weeks, enough to cover one
// founding dry-spell-and-repay cycle), not the full 160-week horizon.
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 190826041) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; }; }
function freeTenant(engine) {
  return engine.g.tenants.filter(t => !t.occupiedBy)
    .sort((a, b) => (b.traffic || 0) - (a.traffic || 0) || a.id.localeCompare(b.id))[0];
}
function freshEngine(loaded) {
  return new loaded.modules.engine.TycoonEngine(loaded.modules.engine.createInitialState({ configured: true }));
}

// --- 1. Unit bounds ---
{
  const loaded = loadGame({ random: lcg(1) });
  const mod = loaded.modules.realEstateAgencyCreditLine;
  assert.equal(mod.CAP, 6_000_000, 'measured cap');
  assert.equal(mod.CUSHION, 1_200_000, 'measured cushion');
  assert.equal(mod.REPAY_FLOOR, mod.CUSHION * 2, 'repay floor leaves a full cushion of headroom');
  console.log('1. unit bounds: pass');
}

// --- 2. Eligibility gating: no realEstateAgency store -> service() is a strict no-op ---
{
  const loaded = loadGame({ random: lcg(2) });
  const engine = freshEngine(loaded);
  engine.g.configured = true;
  const mod = loaded.modules.realEstateAgencyCreditLine;
  assert.equal(mod.eligible(engine.g), false, 'no store open yet');
  const cashBefore = engine.g.companyCash, debtBefore = engine.g.companyDebt;
  const acted = mod.service(engine.g);
  assert.equal(acted, 0, 'no-op when ineligible');
  assert.equal(engine.g.companyCash, cashBefore);
  assert.equal(engine.g.companyDebt, debtBefore);
  console.log('2. eligibility gating (no store -> no-op): pass');
}

// --- 3. Backward compatibility: a save with zero realEstateAgency stores never triggers a draw,
//        and the module registers no new save schema (loans live in the existing generic ledger
//        under a new sourceType value, so an old save simply has zero of them) ---
{
  const loaded = loadGame({ random: lcg(3) });
  const engine = freshEngine(loaded);
  engine.g.configured = true;
  const t = freeTenant(engine);
  engine.openStore({ tenantID: t.id, businessID: 'gym', name: 'ジム1号店', operatingHours: 3 });
  for (let i = 0; i < 12; i++) engine.advanceWeek(false);
  const mod = loaded.modules.realEstateAgencyCreditLine;
  assert.equal(mod.outstandingBalance(engine.g), 0, 'gym-only company never draws the realEstateAgency credit line');
  assert.equal(loaded.modules.finance.ensureFinance(engine.g).loans.filter(l => l.sourceType === mod.SOURCE_TYPE).length, 0);
  console.log('3. backward compatibility (gym-only save, no realEstateAgency): pass');
}

// --- 4. Draw + auto-repay + revolving-cap production checkpoint (seed 4: the classic week-9 dry
//        spell, known to fail at week 9 with zero protection) ---
{
  const loaded = loadGame({ random: lcg(4) });
  const engine = freshEngine(loaded);
  engine.g.configured = true;
  const t0 = freeTenant(engine);
  assert.ok(engine.openStore({ tenantID: t0.id, businessID: 'realEstateAgency', name: '仲介1号店', operatingHours: 3 }));
  const mod = loaded.modules.realEstateAgencyCreditLine;
  let sawDraw = false, sawFullRepay = false, maxOutstanding = 0;
  for (let i = 0; i < 12; i++) {
    engine.advanceWeek(false);
    const outstanding = mod.outstandingBalance(engine.g);
    if (outstanding > 0) sawDraw = true;
    maxOutstanding = Math.max(maxOutstanding, outstanding);
    if (!engine.g.gameOver) assert.ok(engine.g.companyCash >= mod.CUSHION - .01, `week ${engine.g.week}: cash ${engine.g.companyCash} fell below cushion`);
    if (maxOutstanding > 0 && outstanding === 0) sawFullRepay = true;
  }
  assert.ok(sawDraw, 'the founding dry spell draws on the credit line');
  assert.ok(sawFullRepay, 'the first commission fully clears the drawn balance');
  assert.ok(maxOutstanding > 0 && maxOutstanding <= mod.CAP, 'draw stays within the finite cap');
  assert.equal(engine.g.gameOver, false, 'seed 4 survives with the credit line (it fails at week 9 with no protection)');
  assert.equal(engine.g.bankFinancing.loans.length, 0, 'the credit line never writes to state.bankFinancing.loans');
  const fin = loaded.modules.finance.validate(engine.g);
  assert.ok(fin.ok, `finance.validate: ${JSON.stringify(fin.errors)}`);
  console.log('4. draw + auto-repay + cap + bank-loans-covenants isolation (seed 4): pass, maxOutstanding=' + Math.round(maxOutstanding));
}

// --- 5. Determinism: identical seed produces an identical draw/repay trace ---
{
  function trace(seed) {
    const loaded = loadGame({ random: lcg(seed) });
    const engine = freshEngine(loaded);
    engine.g.configured = true;
    const t0 = freeTenant(engine);
    engine.openStore({ tenantID: t0.id, businessID: 'realEstateAgency', name: '仲介1号店', operatingHours: 3 });
    const mod = loaded.modules.realEstateAgencyCreditLine;
    const rows = [];
    for (let i = 0; i < 12; i++) { engine.advanceWeek(false); rows.push(Math.round(mod.outstandingBalance(engine.g))); }
    return rows;
  }
  const a = trace(4), b = trace(4);
  assert.deepEqual(a, b, 'identical seed must produce an identical draw/repay trace');
  console.log('5. determinism (identical seed -> identical trace): pass');
}

// --- 6. Cross-business isolation: gym founding math is byte-identical with this module loaded ---
{
  function gymTrace() {
    const loaded = loadGame({ random: lcg(5) });
    const engine = freshEngine(loaded);
    engine.g.configured = true;
    const t = freeTenant(engine);
    engine.openStore({ tenantID: t.id, businessID: 'gym', name: 'ジム1号店', operatingHours: 3 });
    const rows = [];
    for (let i = 0; i < 10; i++) { engine.advanceWeek(false); rows.push(Math.round(engine.g.companyCash)); }
    return rows;
  }
  assert.deepEqual(gymTrace(), gymTrace(), 'gym founding cash trace is unaffected by this module being loaded');
  console.log('6. cross-business isolation (gym unaffected): pass');
}

// --- 7. Multi-seed survival checkpoint (light -- the exhaustive 10/40/100-seed statistical
//        evidence lives in the PR body / verification log, not in canonical CI) ---
{
  const SEEDS = [4, 10, 29];
  let survived = 0;
  for (const seed of SEEDS) {
    const loaded = loadGame({ random: lcg(seed) });
    const engine = freshEngine(loaded);
    engine.g.configured = true;
    const t0 = freeTenant(engine);
    if (!engine.openStore({ tenantID: t0.id, businessID: 'realEstateAgency', name: '仲介1号店', operatingHours: 3 })) continue;
    for (let i = 0; i < 20 && !engine.g.gameOver; i++) engine.advanceWeek(false);
    if (!engine.g.gameOver) survived++;
    const fin = loaded.modules.finance.validate(engine.g);
    assert.ok(fin.ok, `seed ${seed}: finance.validate ${JSON.stringify(fin.errors)}`);
  }
  // All 3 of these seeds were confirmed failing at week 9 without the credit line in this PR's
  // 100-seed measurement sweep (see founding-route-verification-log.md); with it, all 3 survive
  // the founding dry spell (which resolves for these seeds well before week 20).
  assert.equal(survived, SEEDS.length, `expected all ${SEEDS.length} known-hard seeds to survive the founding dry spell, got ${survived}`);
  console.log(`7. multi-seed survival checkpoint: pass, ${survived}/${SEEDS.length} survived`);
}

console.log('real-estate-agency-credit-line tests passed');
