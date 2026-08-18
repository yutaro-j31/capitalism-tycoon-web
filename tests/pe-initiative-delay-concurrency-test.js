'use strict';

// feature-requests.md R2 remaining items "施策の効果が数週かけて現れる遅延" and
// "複数案件を同時に抱えたときの経営資源の取り合い". Before this, applyPEInitiative was
// instant (pay -> know the result -> score/valuation already moved, all in one call) and
// every peDeal was fully independent of every other. Now a deal can have at most one
// initiative "in flight" (pendingInitiative), the pay/succeed/match decision is still made
// and locked in at commit time (same deterministic outcomeRoll as before), but the
// score/valuation effect and the outcome reveal are deferred INITIATIVE_DELAY_WEEKS weeks,
// and only a limited number of deals *of the same owner account* may have one in flight at
// the same time (company and personal bandwidth tracked independently).

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 250114001) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 250114001) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  engine.g.personalCash = 500_000_000;
  return { modules, ctx, engine };
}

function enableCompanyPE(engine, modules) {
  const office = engine.g.rentalOffices.reduce((a, b) => (a.deposit < b.deposit ? a : b));
  assert.equal(engine.contractOffice(office.id), true);
  assert.equal(engine.establishDepartment('investment'), true);
  engine.g.companyCash = 500_000_000;
  engine.g.finance = modules.finance.defaultFinanceState(engine.g);
}

// Pick an initiative id on `deal` for which succeeds() currently resolves to `wanted`,
// searching over initiative choices rather than mutating week/score (keeps the deal's
// committed state exactly as the caller set it up).
function pickOutcome(modules, engine, deal, wanted) {
  const found = modules.peValueCreation.INITIATIVES.map(row => row.id)
    .find(id => modules.peValueCreation.succeeds(engine.g, deal, id) === wanted);
  assert.ok(found, `no initiative resolves to succeeded=${wanted} for this deal/week`);
  return found;
}

// 1. Applying an initiative does not move score/valuation immediately -- only pendingInitiative
// is set, and the deal is charged right away.
{
  const { modules, engine } = newGame();
  assert.equal(engine.createPEDeal('テック', 20_000_000, 'personal'), true);
  const d = engine.g.peDeals[0];
  const scoreBefore = d.improvementScore, valuationBefore = d.currentValuation, cashBefore = engine.g.personalCash;
  const cost = modules.peValueCreation.initiativeCost(d);
  const id = pickOutcome(modules, engine, d, true);
  assert.equal(engine.applyPEInitiative(d.id, id), true);
  assert.equal(d.improvementScore, scoreBefore, '着手直後はimprovementScoreが動かない');
  assert.equal(d.currentValuation, valuationBefore, '着手直後はcurrentValuationが動かない');
  assert.equal(engine.g.personalCash, cashBefore - cost, '施策費用は着手時点で即時に引かれる');
  assert.ok(d.pendingInitiative, 'pendingInitiativeが設定される');
  assert.equal(d.pendingInitiative.initiativeID, id);
  assert.equal(d.pendingInitiative.resolveWeek, engine.g.week + modules.peValueCreation.INITIATIVE_DELAY_WEEKS);
}

// 2. A deal with a pendingInitiative cannot take a second initiative until the first resolves.
{
  const { modules, engine } = newGame();
  assert.equal(engine.createPEDeal('テック', 20_000_000, 'personal'), true);
  const d = engine.g.peDeals[0];
  const id = pickOutcome(modules, engine, d, true);
  assert.equal(engine.applyPEInitiative(d.id, id), true);
  const cashBefore = engine.g.personalCash;
  assert.equal(engine.applyPEInitiative(d.id, 'cost-cut'), false, '施策が進行中の間は次の施策を着手できない');
  assert.equal(engine.g.personalCash, cashBefore, '拒否された着手は課金しない');
  const p = engine.peValueCreationPlan(d.id);
  assert.equal(p.blockedReason, '既に施策が進行中です。結果判明までお待ちください。');
}

// 3. Resolution after the delay applies the locked-in effect and clears pendingInitiative.
{
  const { modules, engine } = newGame();
  assert.equal(engine.createPEDeal('テック', 20_000_000, 'personal'), true);
  const d = engine.g.peDeals[0];
  const id = pickOutcome(modules, engine, d, true);
  assert.equal(engine.applyPEInitiative(d.id, id), true);
  const pending = { ...d.pendingInitiative };
  const scoreBefore = d.improvementScore, valuationBefore = d.currentValuation;
  engine.g.week = pending.resolveWeek - 1;
  assert.equal(modules.peValueCreation.resolvePendingInitiatives(engine), false, 'resolveWeek前は何も解決しない');
  assert.ok(d.pendingInitiative, 'resolveWeek前はpendingInitiativeが残る');
  engine.g.week = pending.resolveWeek;
  assert.equal(modules.peValueCreation.resolvePendingInitiatives(engine), true);
  assert.equal(d.pendingInitiative, null, '解決後はpendingInitiativeがクリアされる');
  assert.equal(d.improvementScore, Math.max(0, Math.min(100, scoreBefore + pending.scoreDelta)));
  assert.equal(d.currentValuation, valuationBefore * (1 + pending.valuationDelta));
}

// 4. The outcome is locked in at commit time, not at resolution time: mutating the deal's
// score between commit and resolve does not change which scoreDelta/valuationDelta fires
// (only the deterministic outcomeRoll at commit time, keyed on score-at-commit and
// week-at-commit, decides it).
{
  const { modules, engine } = newGame();
  assert.equal(engine.createPEDeal('テック', 20_000_000, 'personal'), true);
  const d = engine.g.peDeals[0];
  const id = pickOutcome(modules, engine, d, true);
  assert.equal(engine.applyPEInitiative(d.id, id), true);
  const lockedIn = { ...d.pendingInitiative };
  d.improvementScore = 55; // tamper with the score after commit
  engine.g.week = lockedIn.resolveWeek;
  modules.peValueCreation.resolvePendingInitiatives(engine);
  assert.equal(d.improvementScore, Math.max(0, Math.min(100, 55 + lockedIn.scoreDelta)), '解決時のscoreDeltaはcommit時点で決まった値のまま');
}

// 5. Once a deal has pending initiative resolved, it can take a new one again (the slot
// frees up).
{
  const { modules, engine } = newGame();
  assert.equal(engine.createPEDeal('テック', 20_000_000, 'personal'), true);
  const d = engine.g.peDeals[0];
  const id1 = pickOutcome(modules, engine, d, true);
  assert.equal(engine.applyPEInitiative(d.id, id1), true);
  engine.g.week = d.pendingInitiative.resolveWeek;
  modules.peValueCreation.resolvePendingInitiatives(engine);
  const id2 = pickOutcome(modules, engine, d, true);
  assert.equal(engine.applyPEInitiative(d.id, id2), true, '解決後は同じ案件にまた着手できる');
}

// 6. Personal concurrency cap (1): a second personal deal cannot take an initiative while
// another personal deal already has one pending, but a company deal is unaffected (separate
// bandwidth pools).
{
  const { modules, engine } = newGame();
  enableCompanyPE(engine, modules);
  assert.equal(engine.createPEDeal('個人A', 20_000_000, 'personal'), true);
  assert.equal(engine.createPEDeal('個人B', 20_000_000, 'personal'), true);
  assert.equal(engine.createPEDeal('会社A', 20_000_000, 'company'), true);
  const [dA, dB] = engine.g.peDeals.filter(x => x.ownerAccount === 'personal');
  const dC = engine.g.peDeals.find(x => x.ownerAccount === 'company');
  assert.equal(engine.applyPEInitiative(dA.id, pickOutcome(modules, engine, dA, true)), true);
  assert.equal(engine.applyPEInitiative(dB.id, 'cost-cut'), false, '個人枠(1)を使い切ったので別の個人案件は着手できない');
  assert.equal(engine.peValueCreationPlan(dB.id).blockedReason.includes('経営資源'), true);
  assert.equal(engine.applyPEInitiative(dC.id, pickOutcome(modules, engine, dC, true)), true, '会社の枠は個人とは独立している');
}

// 7. Company concurrency cap (2): two company deals may run initiatives simultaneously, a
// third is blocked until one resolves.
{
  const { modules, engine } = newGame();
  enableCompanyPE(engine, modules);
  assert.equal(engine.createPEDeal('会社A', 20_000_000, 'company'), true);
  assert.equal(engine.createPEDeal('会社B', 20_000_000, 'company'), true);
  assert.equal(engine.createPEDeal('会社C', 20_000_000, 'company'), true);
  const [dA, dB, dC] = engine.g.peDeals;
  assert.equal(engine.applyPEInitiative(dA.id, pickOutcome(modules, engine, dA, true)), true);
  assert.equal(engine.applyPEInitiative(dB.id, pickOutcome(modules, engine, dB, true)), true);
  assert.equal(engine.applyPEInitiative(dC.id, 'cost-cut'), false, '会社枠(2)を使い切ったので3件目は着手できない');
  engine.g.week = dA.pendingInitiative.resolveWeek;
  modules.peValueCreation.resolvePendingInitiatives(engine);
  assert.equal(engine.applyPEInitiative(dC.id, pickOutcome(modules, engine, dC, true)), true, '1件解決すれば枠が空く');
}

// 8. plan() exposes pending/concurrencyUsed/concurrencyCap accurately.
{
  const { modules, engine } = newGame();
  enableCompanyPE(engine, modules);
  assert.equal(engine.createPEDeal('会社A', 20_000_000, 'company'), true);
  assert.equal(engine.createPEDeal('会社B', 20_000_000, 'company'), true);
  const [dA, dB] = engine.g.peDeals;
  let p = engine.peValueCreationPlan(dA.id);
  assert.equal(p.pending, null);
  assert.equal(p.concurrencyUsed, 0);
  assert.equal(p.concurrencyCap, modules.peValueCreation.MAX_CONCURRENT_INITIATIVES.company);
  const id = pickOutcome(modules, engine, dA, true);
  engine.applyPEInitiative(dA.id, id);
  p = engine.peValueCreationPlan(dA.id);
  assert.equal(p.pending.initiativeID, id);
  assert.equal(p.pending.weeksRemaining, modules.peValueCreation.INITIATIVE_DELAY_WEEKS);
  assert.equal(p.concurrencyUsed, 1);
  const pB = engine.peValueCreationPlan(dB.id);
  assert.equal(pB.concurrencyUsed, 1, '他の案件が使っている枠も同じownerAccountのconcurrencyUsedに数える');
}

// 9. Weekly-loop integration: advanceWeek() resolves a due pending initiative (not just the
// raw resolvePendingInitiatives() function called directly).
{
  const { modules, engine } = newGame();
  assert.equal(engine.createPEDeal('テック', 20_000_000, 'personal'), true);
  const d = engine.g.peDeals[0];
  const id = pickOutcome(modules, engine, d, true);
  assert.equal(engine.applyPEInitiative(d.id, id), true);
  const delay = modules.peValueCreation.INITIATIVE_DELAY_WEEKS;
  for (let i = 0; i < delay; i++) assert.notEqual(engine.advanceWeek(false), false);
  assert.equal(d.pendingInitiative, null, 'advanceWeek()を規定週数繰り返すとpendingInitiativeが解決される');
}

// 10. Company-owned deal's initiative cost is still charged to the finance ledger immediately
// at commit time (unchanged from before), and validate() stays ok both at commit and after
// resolution.
{
  const { modules, engine } = newGame();
  enableCompanyPE(engine, modules);
  assert.equal(engine.createPEDeal('会社A', 20_000_000, 'company'), true);
  const d = engine.g.peDeals[0];
  const cost = modules.peValueCreation.initiativeCost(d);
  const tx = engine.g.finance.transactions.length;
  const id = pickOutcome(modules, engine, d, true);
  assert.equal(engine.applyPEInitiative(d.id, id), true);
  assert.equal(engine.g.finance.transactions.length, tx + 1);
  assert.equal(engine.g.finance.transactions.at(-1).cashEffect, -cost);
  assert.equal(modules.finance.validate(engine.g).ok, true);
  engine.g.week = d.pendingInitiative.resolveWeek;
  modules.peValueCreation.resolvePendingInitiatives(engine);
  assert.equal(engine.g.finance.transactions.length, tx + 1, '解決自体は台帳に新しい行を作らない');
  assert.equal(modules.finance.validate(engine.g).ok, true);
}

// 11. Company/personal separation: resolving a pending initiative on a company deal never
// touches personalCash, and resolving one on a personal deal never touches companyCash
// (resolution itself moves no cash at all -- only score/valuation).
{
  const { modules, engine } = newGame();
  enableCompanyPE(engine, modules);
  assert.equal(engine.createPEDeal('会社A', 20_000_000, 'company'), true);
  assert.equal(engine.createPEDeal('個人A', 20_000_000, 'personal'), true);
  const dCompany = engine.g.peDeals.find(x => x.ownerAccount === 'company');
  const dPersonal = engine.g.peDeals.find(x => x.ownerAccount === 'personal');
  engine.applyPEInitiative(dCompany.id, pickOutcome(modules, engine, dCompany, true));
  engine.applyPEInitiative(dPersonal.id, pickOutcome(modules, engine, dPersonal, true));
  const personalBefore = engine.g.personalCash, companyBefore = engine.g.companyCash;
  engine.g.week = Math.max(dCompany.pendingInitiative.resolveWeek, dPersonal.pendingInitiative.resolveWeek);
  modules.peValueCreation.resolvePendingInitiatives(engine);
  assert.equal(engine.g.personalCash, personalBefore, '解決処理自体はpersonalCashを動かさない');
  assert.equal(engine.g.companyCash, companyBefore, '解決処理自体はcompanyCashを動かさない');
}

// 12. Determinism: same seed, same actions -> identical resulting state through commit,
// resolution, and everything in between.
{
  function run() {
    const { modules, engine } = newGame(20260818);
    engine.createPEDeal('テック', 20_000_000, 'personal');
    const d = engine.g.peDeals[0];
    const id = pickOutcome(modules, engine, d, true);
    engine.applyPEInitiative(d.id, id);
    engine.g.week = d.pendingInitiative.resolveWeek;
    modules.peValueCreation.resolvePendingInitiatives(engine);
    return JSON.stringify({ personalCash: engine.g.personalCash, peDeals: engine.g.peDeals });
  }
  assert.equal(run(), run(), '同じseed・同じ操作で同じ結果になる');
}

// 13. Zero additional RNG consumption: outcomeRoll/matches are pure hash functions, and the
// delay/concurrency bookkeeping itself draws no random numbers, so applying + resolving an
// initiative consumes no Math.random() calls at all.
{
  let calls = 0;
  const inner = lcg();
  const counting = () => { calls++; return inner(); };
  const { modules, ctx } = loadGame({ random: counting });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  engine.g.personalCash = 500_000_000;
  engine.createPEDeal('テック', 20_000_000, 'personal');
  const d = engine.g.peDeals[0];
  const id = pickOutcome(modules, engine, d, true);
  const before = calls;
  engine.applyPEInitiative(d.id, id);
  engine.g.week = d.pendingInitiative.resolveWeek;
  modules.peValueCreation.resolvePendingInitiatives(engine);
  assert.equal(calls - before, 0, '施策の着手・解決はMath.randomを一切消費しない');
}

// 14. Save/reload round trip: pendingInitiative persists intact across save/load.
{
  const { modules, engine } = newGame();
  assert.equal(engine.createPEDeal('テック', 20_000_000, 'personal'), true);
  const d = engine.g.peDeals[0];
  const id = pickOutcome(modules, engine, d, true);
  engine.applyPEInitiative(d.id, id);
  const before = JSON.stringify(d.pendingInitiative);
  engine.save();
  const EngineClass = modules.engine.TycoonEngine;
  const reloaded = EngineClass.load();
  const reloadedDeal = reloaded.g.peDeals.find(x => String(x.id) === String(d.id));
  assert.equal(JSON.stringify(reloadedDeal.pendingInitiative), before, 'reload後もpendingInitiativeが一致する');
}

// 15. Old saves without pendingInitiative (undefined) behave exactly like "no pending
// initiative": applicable() and plan() treat it the same as null, and a fresh initiative can
// be applied normally.
{
  const { modules, engine } = newGame();
  assert.equal(engine.createPEDeal('テック', 20_000_000, 'personal'), true);
  const d = engine.g.peDeals[0];
  assert.equal(d.pendingInitiative, undefined, '前提: createPEDealはpendingInitiativeを設定しない');
  const p = engine.peValueCreationPlan(d.id);
  assert.equal(p.pending, null);
  assert.equal(engine.applyPEInitiative(d.id, pickOutcome(modules, engine, d, true)), true);
}

// 16. Negative test: the delay/concurrency mechanism does not unlock anything beyond the PE
// deal's own initiative flow -- no company-wide gate (offices/departments/other business
// unlocks) is affected by pendingInitiative state.
{
  const { modules, engine } = newGame();
  assert.equal(engine.createPEDeal('テック', 20_000_000, 'personal'), true);
  const d = engine.g.peDeals[0];
  engine.applyPEInitiative(d.id, pickOutcome(modules, engine, d, true));
  assert.equal(engine.establishDepartment('investment'), false, '投資部門はcompanyCash等の通常条件を満たさない限り開放されない');
}

// 17. Static source scan: no new MutationObserver introduced by this feature.
{
  const fs = require('node:fs');
  const path = require('node:path');
  const expansionSrc = fs.readFileSync(path.join(__dirname, '../js/expansion.js'), 'utf8');
  const peSrc = fs.readFileSync(path.join(__dirname, '../js/pe-value-creation.js'), 'utf8');
  const appSrc = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
  assert.ok(!/new MutationObserver|new env\.MutationObserver/.test(expansionSrc), 'expansion.jsに新しいMutationObserverを追加していない');
  assert.ok(!/new MutationObserver|new env\.MutationObserver/.test(peSrc), 'pe-value-creation.jsに新しいMutationObserverを追加していない');
  assert.ok(!/new MutationObserver|new env\.MutationObserver/.test(appSrc), 'app.jsに新しいMutationObserverを追加していない');
}

console.log('PE initiative delay/concurrency tests passed');
