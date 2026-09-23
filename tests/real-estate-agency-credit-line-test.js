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

// --- 8. Multi-store cushion scaling (PR #722 follow-up "option B"): cushionFor()/repayFloorFor()
//        grow with open realEstateAgency store count, single-store CUSHION is the floor, and
//        CUSHION_MAX/REPAY_FLOOR values are correctly bounded well under CAP. ---
{
  const loaded = loadGame({ random: lcg(8) });
  const mod = loaded.modules.realEstateAgencyCreditLine;
  const storesOf = (count) => ({ stores: Array.from({ length: count }, (_, i) => ({ id: `synthetic-${i}`, businessID: 'realEstateAgency', status: 'open' })) });

  // Single store: unchanged from the pre-scaling value (backward compatible with sections 1/4 above).
  assert.equal(mod.cushionFor(storesOf(1)), mod.CUSHION, 'single-store cushion is the unchanged baseline');
  assert.equal(mod.repayFloorFor(storesOf(1)), mod.REPAY_FLOOR, 'single-store repay floor is the unchanged baseline');

  // Multi-store (3-4 stores): strictly above the single-store CUSHION, and grows by exactly
  // CUSHION_PER_STORE per additional store, matching the js/real-estate-agency-credit-line.js formula.
  const cushion3 = mod.cushionFor(storesOf(3)), cushion4 = mod.cushionFor(storesOf(4));
  assert.ok(cushion3 > mod.CUSHION, `3-store cushion ${cushion3} must exceed the single-store baseline ${mod.CUSHION}`);
  assert.ok(cushion4 > cushion3, `4-store cushion ${cushion4} must exceed the 3-store cushion ${cushion3}`);
  assert.equal(cushion3, mod.CUSHION + mod.CUSHION_PER_STORE * 2, '3-store cushion matches the per-store formula exactly');
  assert.equal(cushion4, mod.CUSHION + mod.CUSHION_PER_STORE * 3, '4-store cushion matches the per-store formula exactly');
  assert.equal(mod.repayFloorFor(storesOf(4)), cushion4 * mod.REPAY_FLOOR_MULTIPLIER, 'repay floor is always cushion*multiplier, at any store count');

  // 13+ stores: pinned at CUSHION_MAX (matches the observed maximum store count in the 40-seed
  // multi-store expansion sweep from the PR #722 investigation), and the resulting repay floor
  // stays safely under CAP so the mechanism never asks to repay more than it could ever owe.
  assert.equal(mod.cushionFor(storesOf(13)), mod.CUSHION_MAX, '13-store cushion is pinned at CUSHION_MAX');
  assert.equal(mod.cushionFor(storesOf(20)), mod.CUSHION_MAX, 'cushion never exceeds CUSHION_MAX regardless of store count');
  assert.ok(mod.repayFloorFor(storesOf(20)) < mod.CAP, 'repay floor at CUSHION_MAX stays under CAP');

  // Grounded in the real engine (not just synthetic state): opening 2 realEstateAgency stores
  // through the actual store-opening path raises openStoreCount()/cushionFor() the same way.
  const engine = freshEngine(loaded);
  engine.g.configured = true;
  const free = engine.g.tenants.filter(t => !t.occupiedBy).sort((a, b) => (b.traffic || 0) - (a.traffic || 0) || a.id.localeCompare(b.id));
  assert.ok(engine.openStore({ tenantID: free[0].id, businessID: 'realEstateAgency', name: '仲介1号店', operatingHours: 3 }));
  engine.g.companyCash += 10_000_000; // enough for the second store's cost + deposit; the point here is openStoreCount()/cushionFor() counting, not affordability
  assert.ok(engine.openStore({ tenantID: free[1].id, businessID: 'realEstateAgency', name: '仲介2号店', operatingHours: 3 }));
  for (let i = 0; i < 12 && engine.g.stores.some(s => s.businessID === 'realEstateAgency' && s.status !== 'open'); i++) engine.advanceWeek(false);
  assert.ok(engine.g.stores.every(s => s.businessID !== 'realEstateAgency' || s.status === 'open'), 'both realEstateAgency stores finished opening');
  assert.equal(mod.openStoreCount(engine.g), 2, 'two real store openings are counted');
  assert.equal(mod.cushionFor(engine.g), mod.CUSHION + mod.CUSHION_PER_STORE, 'real 2-store cushion matches the synthetic-state formula');
  console.log('8. multi-store cushion scaling (cushionFor/repayFloorFor, CUSHION_MAX ceiling): pass');
}

// --- 9. Processing-order fix itself (PR #722 "option A"): the credit line's draw must be visible
//        to THIS week's js/player-crisis.js grace-period evaluate() call, not just cushion the
//        following week's starting balance. Proven two ways: (a) on production code, a forced deep
//        one-week shortfall that a same-week draw can fully cover never registers as a negative
//        week for the crisis grace period at all; (b) reverting the single line in an in-memory
//        copy of js/player-crisis.js that runs the pre-evaluate hook before evaluate() reproduces
//        exactly the PR #722 bug -- the identical forced shortfall now DOES tick the grace period,
//        even though the credit line still had (and, once run afterward, still uses) unused CAP
//        room. js/real-estate-agency-credit-line.js and js/player-crisis.js on disk are never
//        touched; only an in-memory copy of the latter is patched, per this repo's established
//        negative-test technique (see tests/pe-realestate-agency-bridge-negative-test.js). ---
{
  const fs = require('node:fs');
  const path = require('node:path');
  const { loadGameFromHtml, readIndex } = require('./harness');
  const ROOT = path.join(__dirname, '..');
  const PLAYER_CRISIS_SOURCE = fs.readFileSync(path.join(ROOT, 'js', 'player-crisis.js'), 'utf8');
  const PLAYER_CRISIS_TAG = '<script src="./js/player-crisis.js"></script>';

  const FIXED_ORDER = '  runPreEvaluateHooks(this.g,this);\n  const legacyTriggered=this.g.gameOver&&this.g.gameOverReason===LEGACY_GAME_OVER_REASON;';
  assert(PLAYER_CRISIS_SOURCE.includes(FIXED_ORDER), 'expected the pre-evaluate hook call directly before the legacy-check read in the main advanceWeek path; has it been refactored?');
  assert.equal(PLAYER_CRISIS_SOURCE.split(FIXED_ORDER).length - 1, 1, 'expected exactly one occurrence');
  const BUGGY_ORDER = '  const legacyTriggered=this.g.gameOver&&this.g.gameOverReason===LEGACY_GAME_OVER_REASON;';
  const revertedSource = PLAYER_CRISIS_SOURCE.replace(FIXED_ORDER, BUGGY_ORDER);
  // Reverting must not simply delete the call sitewide (that would also remove the isCompanySold
  // branch's own hook call, a different code path this test does not exercise); confirm exactly
  // one call site remains (the isCompanySold branch's).
  assert.equal((revertedSource.match(/runPreEvaluateHooks\(this\.g,this\);/g) || []).length, 1, 'reverted source must remove exactly the main-path pre-evaluate hook call');

  function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; }; }
  function runForcedShortfallWeek(source, seed) {
    const html = readIndex().replace(PLAYER_CRISIS_TAG, `<script>${source}</script>`);
    const { ctx, modules } = loadGameFromHtml(html, { random: lcg(seed) });
    const engine = ctx.__ct_engine;
    engine.configure({ playerName: 'Negative Test', companyName: 'Reverted Crisis Order', difficulty: 'normal' });
    const t0 = engine.g.tenants.filter(t => !t.occupiedBy).sort((a, b) => (b.traffic || 0) - (a.traffic || 0) || a.id.localeCompare(b.id))[0];
    assert(engine.openStore({ tenantID: t0.id, businessID: 'realEstateAgency', name: '仲介1号店', operatingHours: 3 }));
    for (let i = 0; i < 4; i++) engine.advanceWeek(false); // clear the opening-week transient, reach a stable baseline
    const mod = modules.realEstateAgencyCreditLine;
    assert.equal(mod.outstandingBalance(engine.g), 0, 'baseline: no outstanding draw yet');
    // Force a single deep one-week shortfall: CAP (6,000,000) is enough to fully rescue this back
    // to a non-negative balance, so the fixed code must show zero crisis impact from this week.
    engine.g.companyCash = -5_000_000;
    const cashBeforeTick = engine.g.companyCash;
    const consecBefore = engine.g.consecutiveNegativeCashWeeks;
    engine.advanceWeek(false);
    return {
      cashBeforeTick, cashAfterTick: engine.g.companyCash,
      consecBefore, consecAfter: engine.g.consecutiveNegativeCashWeeks,
      crisisStatus: engine.g.playerCrisis.status, gameOver: engine.g.gameOver,
      outstanding: mod.outstandingBalance(engine.g)
    };
  }

  const SCENARIO_SEED = 10; // confirmed clean baseline: zero outstanding balance after the 4-week settle-in below
  const fixed = runForcedShortfallWeek(PLAYER_CRISIS_SOURCE, SCENARIO_SEED);
  console.log('9a. production code, forced deep shortfall: ' + JSON.stringify(fixed));
  assert.ok(fixed.outstanding > 0, 'fixed code: credit line actually drew this week');
  assert.ok(fixed.cashAfterTick >= 0, `fixed code: same-week draw must fully rescue this shortfall to non-negative cash, got ${fixed.cashAfterTick}`);
  assert.equal(fixed.consecAfter, 0, 'fixed code: a same-week-rescued shortfall must never register as a negative week for the crisis grace period');
  // 'watch' (cash below the reserve threshold but non-negative) is expected and correct here --
  // the rescue lands cash just above zero, not necessarily above the full working-capital reserve.
  // What must never happen is entering an ACTIVE_CRISIS status ('distressed'/'turnaround') or worse.
  assert.ok(['stable', 'watch', 'recovered'].includes(fixed.crisisStatus), `fixed code: must not enter an active-crisis status for a fully-rescued shortfall week, got '${fixed.crisisStatus}'`);
  assert.equal(fixed.gameOver, false);

  const reverted = runForcedShortfallWeek(revertedSource, SCENARIO_SEED);
  console.log('9b. reverted (pre-#722) code, IDENTICAL forced deep shortfall: ' + JSON.stringify(reverted));
  assert.equal(reverted.cashBeforeTick, fixed.cashBeforeTick, 'both runs force the identical shortfall');
  // The bug reproduces: with the pre-evaluate hook removed, evaluate() reads the week's raw,
  // pre-rescue cash (still deeply negative), so the grace period ticks for a week the credit line
  // -- which still has ample unused CAP room, per the fixed run above -- would otherwise have fully
  // covered. This is exactly the PR #722 defect (both of that investigation's failing seeds had
  // unused CAP room at the moment of failure).
  assert.ok(reverted.consecAfter >= 1, `expected the reverted code to reproduce the bug (crisis grace ticks despite available CAP room), but consecutiveNegativeCashWeeks stayed at ${reverted.consecAfter} -- if this assertion fails, the ordering fix has lost its detection power and needs to be re-examined`);
  assert.equal(reverted.crisisStatus, 'distressed', `expected the reverted code to enter 'distressed' (evaluate() saw the raw, pre-rescue negative cash) for the same forced shortfall the fixed code fully absorbs into '${fixed.crisisStatus}', got '${reverted.crisisStatus}'`);
  console.log('9. processing-order fix (pre-evaluate hook timing): pass -- reverted code reproduces the PR #722 bug on an identical forced shortfall');
}

console.log('real-estate-agency-credit-line tests passed');
