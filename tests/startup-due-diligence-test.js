'use strict';

// feature-requests.md R1 remaining item "創業者・チームの詳細DD" (founder/team due
// diligence). Before this, growth/risk were the only visible signals and there was no way
// to learn more before investing. conductStartupDueDiligence() (js/expansion.js) is a pure
// information-and-negotiation feature: it derives a verdict/discount/flags once via the
// existing deterministicUnit helper (no RNG draw, same startup id always yields the same
// result) and only changes the terms of a *future* investStartup() call for a startup that
// was actually vetted -- it never touches updateStartups()'s weekly formula, so it cannot
// drift the calibration/transaction-baseline fixtures every existing scenario depends on.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 900423001) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 900423001) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  return { modules, ctx, engine };
}

// Mirrors js/expansion.js's deterministicUnit exactly, so the test can search for startup
// ids that deterministically land in a specific verdict band without depending on which
// band the 3 default startups happen to fall into.
function deterministicUnit(...parts) {
  let h = 2166136261;
  const text = parts.map(v => String(v ?? '')).join('|');
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}
function findID(prefix, predicate) {
  for (let i = 0; i < 5000; i++) {
    const id = `${prefix}-${i}`;
    if (predicate(deterministicUnit(id, 'founder-dd'))) return id;
  }
  throw new Error(`no id found for ${prefix}`);
}
const UNFAVORABLE_ID = findID('dd-unfavorable', u => u < .25); // guarantees discount>0 and >=1 flag
const FAVORABLE_ID = findID('dd-favorable', u => u >= .75); // guarantees discount===0 and 0 flags

function pushStartup(engine, id, overrides = {}) {
  const s = {
    id, name: `検証案件-${id}`, domain: 'テスト', stage: 'Seed', valuation: 100_000_000, minTicket: 5_000_000,
    growth: .07, risk: .15, ownedCompany: 0, ownedPersonal: 0, alive: true, subsidiary: false,
    totalInvestedCompany: 0, totalInvestedPersonal: 0, productProgress: .1, runwayWeeks: 52, reports: [],
    fundingRound: 'Seed', fundingOpen: true, ...overrides
  };
  engine.g.startups.push(s);
  return s;
}

// 1. Basic success: cost deducted from personalCash (5% of minTicket), dueDiligence
// recorded with a deterministic verdict/discount/flags matching the same hash formula.
{
  const { engine } = newGame();
  const s = pushStartup(engine, UNFAVORABLE_ID);
  const before = engine.g.personalCash;
  assert.equal(engine.conductStartupDueDiligence(s.id), true);
  assert.equal(engine.g.personalCash, before - Math.round(s.minTicket * .05), 'DD費用は個人資金から差し引かれる（minTicketの5%）');
  assert.equal(s.dueDiligence.done, true);
  assert.equal(s.dueDiligence.verdict, '危険', '.25未満のunitは「危険」判定になる');
  assert.ok(s.dueDiligence.discount > 0, '不利な判定には評価額割引が付く');
  assert.ok(s.dueDiligence.flags.length >= 1, '不利な判定には懸念点が最低1件付く');
}

// 2. Favorable verdict: no discount, no flags.
{
  const { engine } = newGame();
  const s = pushStartup(engine, FAVORABLE_ID);
  assert.equal(engine.conductStartupDueDiligence(s.id), true);
  assert.equal(s.dueDiligence.verdict, '優良', '.75以上のunitは「優良」判定になる');
  assert.equal(s.dueDiligence.discount, 0, '優良判定に割引は付かない');
  assert.equal(s.dueDiligence.flags.length, 0, '優良判定に懸念点は付かない');
}

// 3. Idempotency: a second DD on the same startup fails, with no additional cash spent.
{
  const { engine } = newGame();
  const s = pushStartup(engine, UNFAVORABLE_ID);
  assert.equal(engine.conductStartupDueDiligence(s.id), true);
  const after = engine.g.personalCash;
  assert.equal(engine.conductStartupDueDiligence(s.id), false, '既にDD済みの案件は再実施できない');
  assert.equal(engine.g.personalCash, after, '失敗時は追加の資金消費が発生しない');
}

// 4. Insufficient personalCash / nonexistent / dead startup all fail cleanly.
{
  const { engine } = newGame();
  const s = pushStartup(engine, UNFAVORABLE_ID);
  engine.g.personalCash = 0;
  assert.equal(engine.conductStartupDueDiligence(s.id), false, '個人資金不足では実施できない');
  assert.equal(s.dueDiligence, undefined);
}
{
  const { engine } = newGame();
  assert.equal(engine.conductStartupDueDiligence('no-such-id'), false);
}
{
  const { engine } = newGame();
  const s = pushStartup(engine, UNFAVORABLE_ID, { alive: false });
  assert.equal(engine.conductStartupDueDiligence(s.id), false, '倒産済みの案件はDDできない');
}

// 4b. A startup entity with a missing/invalid minTicket (e.g. a malformed legacy save) must
// fail atomically -- it must never corrupt personalCash into NaN. cost=Math.round(s.minTicket*.05)
// with an undefined/non-finite minTicket previously produced NaN, and personalCash-=NaN
// poisoned personalCash for the rest of the session (all comparisons against NaN are false,
// so it was silently accepted).
for (const badMinTicket of [undefined, NaN, 0, -1]) {
  const { engine } = newGame();
  const s = pushStartup(engine, UNFAVORABLE_ID, { minTicket: badMinTicket });
  const before = engine.g.personalCash;
  assert.equal(engine.conductStartupDueDiligence(s.id), false, `minTicket=${badMinTicket}は無効なentityとして拒否される`);
  assert.equal(engine.g.personalCash, before, 'personalCashは変化しない');
  assert.ok(Number.isFinite(engine.g.personalCash), 'personalCashはNaNに汚染されない');
  assert.equal(s.dueDiligence, undefined, '無効なentityにdueDiligenceは記録されない');
}

// 5. Effect on investStartup(): a startup with a completed unfavorable DD grants strictly
// more equity for the same investment amount than an identical startup with no DD, and a
// favorable-verdict startup grants exactly the same equity as no DD (discount 0).
{
  const { modules, engine } = newGame();
  engine.g.companyCash = 50_000_000;
  engine.g.finance = modules.finance.defaultFinanceState(engine.g);
  const office = engine.g.rentalOffices.reduce((a, b) => (a.deposit < b.deposit ? a : b));
  assert.equal(engine.contractOffice(office.id), true);
  assert.equal(engine.establishDepartment('investment'), true);

  const plain = pushStartup(engine, 'dd-plain-control');
  const vetted = pushStartup(engine, UNFAVORABLE_ID);
  assert.equal(engine.conductStartupDueDiligence(vetted.id), true);
  assert.ok(vetted.dueDiligence.discount > 0);

  const amount = 5_000_000;
  assert.equal(engine.investStartup(plain.id, amount, 'company'), true);
  assert.equal(engine.investStartup(vetted.id, amount, 'company'), true);
  assert.ok(vetted.ownedCompany > plain.ownedCompany, 'DDで割引を引き出した案件は同額投資でより多い持分を得る');

  const v = modules.finance.validate(engine.g);
  assert.equal(v.ok, true, (v.errors || []).join('\n'));
}
{
  const { modules, engine } = newGame();
  engine.g.companyCash = 50_000_000;
  engine.g.finance = modules.finance.defaultFinanceState(engine.g);
  const office = engine.g.rentalOffices.reduce((a, b) => (a.deposit < b.deposit ? a : b));
  assert.equal(engine.contractOffice(office.id), true);
  assert.equal(engine.establishDepartment('investment'), true);

  const plain = pushStartup(engine, 'dd-plain-control-2');
  const vetted = pushStartup(engine, FAVORABLE_ID);
  assert.equal(engine.conductStartupDueDiligence(vetted.id), true);

  const amount = 5_000_000;
  assert.equal(engine.investStartup(plain.id, amount, 'company'), true);
  assert.equal(engine.investStartup(vetted.id, amount, 'company'), true);
  assert.ok(Math.abs(vetted.ownedCompany - plain.ownedCompany) < 1e-9, '優良判定（割引0）はDD無しと同じ持分になる');
}

// 6. Determinism: same id -> same verdict/discount/flags every time, across fresh games.
{
  function run() {
    const { engine } = newGame(314159);
    const s = pushStartup(engine, UNFAVORABLE_ID);
    engine.conductStartupDueDiligence(s.id);
    return JSON.stringify(s.dueDiligence);
  }
  assert.equal(run(), run(), '同じIDのDD結果は毎回同じになる');
}

// 7. Save/reload round trip.
{
  const { modules, engine } = newGame();
  const s = pushStartup(engine, UNFAVORABLE_ID);
  assert.equal(engine.conductStartupDueDiligence(s.id), true);
  const before = JSON.stringify(s.dueDiligence);
  engine.save();
  const EngineClass = modules.engine.TycoonEngine;
  const reloaded = EngineClass.load();
  const reloadedStartup = reloaded.g.startups.find(x => x.id === s.id);
  assert.equal(JSON.stringify(reloadedStartup.dueDiligence), before, 'reload後もDD結果が一致する');
}

// 8. No RNG consumption: conductStartupDueDiligence must never call rand()/pick()/uid()
// (verified indirectly: two identical fresh games, one that calls DD and one that doesn't,
// must produce identical subsequent random-dependent outcomes once both are pushed the same
// startup and advanced one week -- proving DD itself draws no randomness).
{
  function advanceOnce(callDD) {
    const { engine } = newGame(2024001);
    const s = pushStartup(engine, UNFAVORABLE_ID);
    if (callDD) engine.conductStartupDueDiligence(s.id);
    assert.notEqual(engine.advanceWeek(false), false);
    return JSON.stringify({ companyCash: engine.g.companyCash, week: engine.g.week, valuation: engine.g.startups.find(x => x.id === s.id).valuation });
  }
  assert.equal(advanceOnce(false), advanceOnce(true), 'DD自体はRNGを消費しないため、以降の週次結果に一切影響しない');
}

// 9. Static source scan: no new MutationObserver.
{
  const fs = require('node:fs');
  const path = require('node:path');
  const engineSrc = fs.readFileSync(path.join(__dirname, '../js/engine.js'), 'utf8');
  const expansionSrc = fs.readFileSync(path.join(__dirname, '../js/expansion.js'), 'utf8');
  assert.ok(!/new MutationObserver|new env\.MutationObserver/.test(engineSrc), 'engine.jsに新しいMutationObserverを追加していない');
  assert.ok(!/new MutationObserver|new env\.MutationObserver/.test(expansionSrc), 'expansion.jsに新しいMutationObserverを追加していない');
}

console.log('Startup due diligence tests passed');
