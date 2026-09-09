'use strict';

// PE mode T6 (docs/PE_MODE_TASKS.md): track record scoring + GP commitment. Uses the full
// production script list (tests/harness.js's loadGame), not the minimal per-file loader
// tests/pe-fund-test.js uses, because recordCurrentCompany/configure/foundNewCompanyAfterBuyout
// only exist on TycoonEngine.prototype once js/completion.js's installCompletion(TycoonEngine)
// has actually run (called by js/app.js), and js/pe-fund.js defers wrapping them to
// DOMContentLoaded for exactly that reason (see js/pe-fund.js's installCompletionDependentHooks).
// The harness simulates that same DOMContentLoaded firing after every script has loaded.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadGame } = require('./harness');

let seed = 0x9e3779b9;
const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; };
const { engineModule, modules } = loadGame({ random, isolatedLegacyIndex: true });
const { TycoonEngine } = engineModule;
const pf = modules.peFund;

function freshEngine() {
  const e = new TycoonEngine();
  e.configure({ playerName: 'テスター', companyName: 'テスト商事', difficulty: 'normal' });
  return e;
}

// 1. The completion-dependent hooks are actually installed (sanity: the DOMContentLoaded
// deferral in js/pe-fund.js worked, matching js/pe-value-creation.js's identical pattern).
{
  assert.ok(TycoonEngine.prototype.recordCurrentCompany.toString().includes('recordExitForCurrentCompany'), 'recordCurrentCompany must be wrapped once installCompletion has run');
}

// 2. requiredGPRatio strictly decreases as score rises, from 20% at score 0 towards 2% at
// score 100 (the task doc's formula, clamped at a sane floor).
{
  const r0 = pf.requiredGPRatio(0), r50 = pf.requiredGPRatio(50), r100 = pf.requiredGPRatio(100);
  assert.ok(Math.abs(r0 - .20) < 1e-9, `score 0 must require the full 20% ratio, got ${r0}`);
  assert.ok(r50 < r0 && r100 < r50, 'required GP ratio must strictly decrease as score rises');
  assert.ok(r100 <= .03, `score 100 must approach the design's low-single-digit floor, got ${r100}`);
}

// 3. Management fee / carry / hurdle exactly match the task doc's literal formulas.
{
  for (const score of [0, 5, 35, 60, 85, 100]) {
    const terms = pf.fundTermsForScore(score);
    assert.ok(Math.abs(terms.fee - (.015 + .01 * (score / 100))) < 1e-9, `fee mismatch at score ${score}`);
    assert.ok(Math.abs(terms.carry - (.15 + .10 * (score / 100))) < 1e-9, `carry mismatch at score ${score}`);
    assert.ok(Math.abs(terms.hurdle - (.10 - .02 * (score / 100))) < 1e-9, `hurdle mismatch at score ${score}`);
  }
}

// 4. Completion criterion: at score 5 with 10億 (1B) personal cash, the formable fund size
// must land at roughly 28億 (2.8B) -- (personalCash * 0.5) / requiredGPRatio(5).
{
  const e = freshEngine();
  e.g.personalCash = 1_000_000_000;
  e.g.peFirm.trackRecord.score = 5;
  const formable = pf.formableFundSize(e.g);
  assert.ok(Math.abs(formable - 2_800_000_000) / 2_800_000_000 < .05, `expected ~28億, got ${formable}`);
}

// 5. PE mode is locked before any exit, and formableFundSize scales down with personalCash
// (sanity: it is proportional, not a flat constant).
{
  const e = freshEngine();
  assert.equal(e.g.peFirm.unlocked, false);
  assert.equal(e.g.peFirm.trackRecord.score, 0);
  e.g.personalCash = 2_000_000_000;
  e.g.peFirm.trackRecord.score = 5;
  const doubledFormable = pf.formableFundSize(e.g);
  e.g.personalCash = 1_000_000_000;
  const baseFormable = pf.formableFundSize(e.g);
  assert.ok(Math.abs(doubledFormable - baseFormable * 2) / (baseFormable * 2) < 1e-9, 'formable size must scale linearly with personal cash');
}

// 6. Selling the whole company (会社売却) unlocks PE mode and records a first exit that
// lands in [5,15], with the 4 documented items derived correctly.
{
  const e = freshEngine();
  e.g.week = 300;
  e.g.founderOwnershipRatio = 1;
  e.g.weeklyProfitHistory = [5, 4, 3, 2, 1];
  e.g.workforceTeams = [{ headcount: 8 }, { headcount: 2 }];
  e.g.inboundBuyoutOffers = [{ id: 'offer-1', bidderName: '買収社', offerAmount: 300_000_000, status: 'pending', expiresWeek: e.g.week + 10, hostile: false }];
  assert.equal(e.g.peFirm.unlocked, false);
  assert.equal(e.acceptInboundBuyoutOffer('offer-1'), true);
  assert.equal(e.g.peFirm.unlocked, true, 'PE mode must unlock on the first exit');
  assert.equal(e.g.peFirm.trackRecord.exits.length, 1);
  const exit = e.g.peFirm.trackRecord.exits[0];
  assert.equal(exit.exitType, 'buyout');
  assert.equal(exit.realizedAmount, 300_000_000, 'realized amount must be the personalCash increment (founderProceeds)');
  assert.equal(exit.investedAmount, 8_000_000, 'invested amount must be the founding investment (normal difficulty)');
  assert.ok(Math.abs(exit.personalMOIC - 300_000_000 / 8_000_000) < 1e-9);
  assert.equal(exit.employeeCount, 10);
  assert.equal(exit.profitableWeekStreak, 5);
  const score = e.g.peFirm.trackRecord.score;
  assert.ok(score >= 5 && score <= 15, `first exit score must land in [5,15], got ${score}`);
}

// 7. Going public (IPO) also unlocks PE mode and records an exit, using the founder's
// share-sale proceeds (the personalCash delta), even though the company itself keeps running.
{
  const e = freshEngine();
  e.g.hasHeadOffice = true;
  e.g.departments.accounting = true;
  e.g.boardEstablished = true;
  for (let i = 0; i < 52; i++) e.g.reports.push({ week: i + 1, profit: 300_000 });
  const seedAmount = 200_000_000;
  modules.finance.event(e.g, 'equityFinancing', seedAmount, { cashEffect: seedAmount, equityEffect: seedAmount, sourceType: 'testSeed', sourceID: 'seed', operationID: 'seed', idempotencyKey: 'seed', description: 'test seed capital' });
  modules.finance.ensureFinance(e.g).balances.capitalSurplus += seedAmount;
  e.g.companyCash += seedAmount;
  assert.equal(e.ipoMissingReasons().length, 0, `IPO must be reachable, missing: ${e.ipoMissingReasons().join(',')}`);
  const personalBefore = e.g.personalCash;
  assert.equal(e.executeIPO('東証グロース'), true);
  const founderSale = e.g.personalCash - personalBefore;
  assert.ok(founderSale > 0, 'sanity: the IPO must actually pay the founder personally');
  assert.equal(e.g.peFirm.unlocked, true);
  assert.equal(e.g.peFirm.trackRecord.exits.length, 1);
  assert.equal(e.g.peFirm.trackRecord.exits[0].exitType, 'ipo');
  assert.equal(e.g.peFirm.trackRecord.exits[0].realizedAmount, founderSale);
}

// 8. A second exit can push the score above the first-exit ceiling of 15 (the score is not
// permanently capped at 15 -- only the very first exit is).
{
  const e = freshEngine();
  e.g.week = 100;
  e.g.founderOwnershipRatio = 1;
  e.g.weeklyProfitHistory = Array(260).fill(1);
  e.g.workforceTeams = [{ headcount: 40 }];
  e.g.inboundBuyoutOffers = [{ id: 'offer-1', bidderName: '買収社1', offerAmount: 200_000_000, status: 'pending', expiresWeek: e.g.week + 10, hostile: false }];
  assert.equal(e.acceptInboundBuyoutOffer('offer-1'), true);
  const scoreAfterFirst = e.g.peFirm.trackRecord.score;
  assert.ok(scoreAfterFirst <= 15);

  e.g.week += 52;
  e.g.founderOwnershipRatio = 1;
  e.g.currentCompanyFoundedWeek = e.g.week - 52;
  e.g.weeklyProfitHistory = Array(260).fill(1);
  e.g.workforceTeams = [{ headcount: 40 }];
  e.g.inboundBuyoutOffers = [{ id: 'offer-2', bidderName: '買収社2', offerAmount: 200_000_000, status: 'pending', expiresWeek: e.g.week + 10, hostile: false }];
  assert.equal(e.acceptInboundBuyoutOffer('offer-2'), true);
  assert.equal(e.g.peFirm.trackRecord.exits.length, 2);
  assert.ok(e.g.peFirm.trackRecord.score > scoreAfterFirst, `a second good exit must raise the score above the first-exit ceiling (${scoreAfterFirst})`);
}

// 9. computeTrackScore/exitQuality are pure functions of the exits array (determinism: same
// input always gives the same score).
{
  const exits = [{ personalMOIC: 2, yearsElapsed: 3, profitableWeekStreak: 100, employeeCount: 20 }];
  assert.equal(pf.computeTrackScore(exits), pf.computeTrackScore(exits));
  assert.equal(pf.computeTrackScore([]), 0);
}

// 10. No new Math.random()/Date.now()/randomUUID usage.
{
  const src = fs.readFileSync('js/pe-fund.js', 'utf8');
  assert.ok(!src.includes('Math.random()'));
  assert.ok(!src.includes('Date.now()'));
  assert.ok(!src.includes('randomUUID'));
}

console.log('pe fund track record tests passed');
