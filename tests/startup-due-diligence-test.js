'use strict';

// feature-requests.md R1 remaining item "創業者・チームの詳細DD" (founder/team due
// diligence). conductStartupDueDiligence() (js/expansion.js) never touches
// updateStartups()'s weekly formula, so it cannot drift the calibration/transaction-baseline
// fixtures every existing scenario depends on -- it only changes the terms of a *future*
// investStartup() call for a startup that was actually vetted.
//
// The verdict/discount unit is 70% the startup's real growth/risk fundamentals and 30% a
// deterministicUnit hash (no RNG draw; same startup+state always yields the same result).
// This replaced a pure ID-hash design that was uncorrelated with real risk: a player could
// cherry-pick "危険" verdicts among startups whose actual risk was no higher than an
// "優良"-verdict startup's, buy the discounted equity, and realize the same expected return
// with no matching downside -- free alpha, not risk-based pricing. Test 5c below is a
// regression guard against that exploit reappearing.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 900423001) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 900423001) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  return { modules, ctx, engine };
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// Mirrors js/expansion.js's deterministicUnit exactly.
function deterministicUnit(...parts) {
  let h = 2166136261;
  const text = parts.map(v => String(v ?? '')).join('|');
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}
// Mirrors conductStartupDueDiligence's unit formula exactly, so tests can predict the exact
// verdict/discount for a given (id, risk, growth) without depending on production internals.
function expectedUnit(id, risk, growth) {
  const riskScore = clamp((risk - .10) / (.22 - .10), 0, 1);
  const growthScore = clamp((growth - .045) / (.10 - .045), 0, 1);
  const fundamentalsUnit = clamp((1 - riskScore) * .5 + growthScore * .5, 0, 1);
  const noiseUnit = deterministicUnit(id, 'founder-dd');
  return clamp(fundamentalsUnit * .7 + noiseUnit * .3, 0, 1);
}
function verdictOf(unit) { return unit < .25 ? '危険' : unit < .5 ? '要注意' : unit < .75 ? '普通' : '優良'; }
function discountOf(unit) { return unit < .5 ? clamp((.5 - unit) * .3, 0, .15) : 0; }

function findID(prefix, predicate) {
  for (let i = 0; i < 5000; i++) {
    const id = `${prefix}-${i}`;
    if (predicate(deterministicUnit(id, 'founder-dd'))) return id;
  }
  throw new Error(`no id found for ${prefix}`);
}
// Worst-case fundamentals (risk=.22, growth=.045) give fundamentalsUnit=0, so
// unit=noiseUnit*.3 -- guaranteed <.25 (and therefore "危険") as long as noiseUnit<.8.
const WORST_RISK = .22, WORST_GROWTH = .045;
const UNFAVORABLE_ID = findID('dd-unfavorable', u => u < .8);
// Best-case fundamentals (risk=.10, growth=.10) give fundamentalsUnit=1, so
// unit=.7+noiseUnit*.3 -- guaranteed >=.75 (and therefore "優良") as long as noiseUnit>=.1667.
const BEST_RISK = .10, BEST_GROWTH = .10;
const FAVORABLE_ID = findID('dd-favorable', u => u >= .2);
// A pair with near-identical noise (~neutral midpoint, narrow band) but opposite
// fundamentals, used to prove discount tracks real risk/growth rather than being independent
// of it (test 5c). Two distinct ids are needed (startups must have distinct ids), but a
// narrow shared noise band keeps the noise term's contribution (30% weight) far smaller than
// the fundamentals gap (70% weight) between the worst- and best-case risk/growth used below.
const NEUTRAL_ID_A = findID('dd-neutral-a', u => u >= .48 && u <= .52);
const NEUTRAL_ID_B = findID('dd-neutral-b', u => u >= .48 && u <= .52);

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

// 1. Basic success: cost deducted from personalCash (5% of minTicket), dueDiligence recorded
// with the exact verdict/discount/flags the fundamentals+noise formula predicts.
{
  const { engine } = newGame();
  const s = pushStartup(engine, UNFAVORABLE_ID, { risk: WORST_RISK, growth: WORST_GROWTH });
  const before = engine.g.personalCash;
  const unit = expectedUnit(s.id, WORST_RISK, WORST_GROWTH);
  assert.equal(engine.conductStartupDueDiligence(s.id), true);
  assert.equal(engine.g.personalCash, before - Math.round(s.minTicket * .05), 'DD費用は個人資金から差し引かれる（minTicketの5%）');
  assert.equal(s.dueDiligence.done, true);
  assert.ok(Math.abs(s.dueDiligence.unit - unit) < 1e-9, 'unitはfundamentals70%+noise30%の式と一致する');
  assert.equal(s.dueDiligence.verdict, verdictOf(unit));
  assert.equal(s.dueDiligence.verdict, '危険', '最悪のfundamentals（高risk・低growth）は「危険」判定になる');
  assert.ok(s.dueDiligence.discount > 0, '不利な判定には評価額割引が付く');
  assert.equal(s.dueDiligence.discount, discountOf(unit));
  assert.ok(s.dueDiligence.flags.length >= 1, '不利な判定には懸念点が最低1件付く');
}

// 2. Favorable verdict: no discount, no flags.
{
  const { engine } = newGame();
  const s = pushStartup(engine, FAVORABLE_ID, { risk: BEST_RISK, growth: BEST_GROWTH });
  const unit = expectedUnit(s.id, BEST_RISK, BEST_GROWTH);
  assert.equal(engine.conductStartupDueDiligence(s.id), true);
  assert.equal(s.dueDiligence.verdict, verdictOf(unit));
  assert.equal(s.dueDiligence.verdict, '優良', '最良のfundamentals（低risk・高growth）は「優良」判定になる');
  assert.equal(s.dueDiligence.discount, 0, '優良判定に割引は付かない');
  assert.equal(s.dueDiligence.flags.length, 0, '優良判定に懸念点は付かない');
}

// 3. Idempotency: a second DD on the same startup fails, with no additional cash spent.
{
  const { engine } = newGame();
  const s = pushStartup(engine, UNFAVORABLE_ID, { risk: WORST_RISK, growth: WORST_GROWTH });
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

  const plain = pushStartup(engine, 'dd-plain-control', { risk: WORST_RISK, growth: WORST_GROWTH });
  const vetted = pushStartup(engine, UNFAVORABLE_ID, { risk: WORST_RISK, growth: WORST_GROWTH });
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

  const plain = pushStartup(engine, 'dd-plain-control-2', { risk: BEST_RISK, growth: BEST_GROWTH });
  const vetted = pushStartup(engine, FAVORABLE_ID, { risk: BEST_RISK, growth: BEST_GROWTH });
  assert.equal(engine.conductStartupDueDiligence(vetted.id), true);

  const amount = 5_000_000;
  assert.equal(engine.investStartup(plain.id, amount, 'company'), true);
  assert.equal(engine.investStartup(vetted.id, amount, 'company'), true);
  assert.ok(Math.abs(vetted.ownedCompany - plain.ownedCompany) < 1e-9, '優良判定（割引0）はDD無しと同じ持分になる');
}

// 5c. Exploit-closure regression: holding noise (the "luck" component) in a narrow shared
// band, a startup with worse real fundamentals (higher risk, lower growth) must receive a
// strictly larger discount than an otherwise-identical startup with better fundamentals.
// This is the property that was previously false (verdict was pure noise, uncorrelated with
// real risk) and made "always buy 危険-verdict startups" a free-money strategy.
{
  const { engine } = newGame();
  const risky = pushStartup(engine, NEUTRAL_ID_A, { risk: WORST_RISK, growth: WORST_GROWTH });
  const safe = pushStartup(engine, NEUTRAL_ID_B, { risk: BEST_RISK, growth: BEST_GROWTH });
  assert.equal(engine.conductStartupDueDiligence(risky.id), true);
  assert.equal(engine.conductStartupDueDiligence(safe.id), true);
  assert.ok(risky.dueDiligence.discount > safe.dueDiligence.discount,
    '同程度の運（noise帯域）でも、実際のrisk/growthが悪い案件の方が割引が大きくなる（純ノイズ由来ではなくfundamentals由来であることの直接証明）');
}

// 5d. Broader correlation guard (mirrors the audit methodology): across 60 synthetic
// startups spanning the realistic risk/growth range with fixed, non-random ids, the average
// real risk of "危険"-verdict startups must be higher than that of "優良"-verdict startups.
// A regression back to pure-noise verdicts would fail this (verified: probe2.js in the
// original audit showed ~equal average risk of 16.1% across every verdict bucket).
{
  const { engine } = newGame();
  engine.g.personalCash = 100_000_000;
  const buckets = { 危険: [], 優良: [] };
  for (let i = 0; i < 60; i++) {
    const t = i / 59;
    const risk = .10 + t * (.22 - .10);
    const growth = .10 - t * (.10 - .045);
    const s = pushStartup(engine, `corr-${i}`, { risk, growth });
    assert.equal(engine.conductStartupDueDiligence(s.id), true);
    if (buckets[s.dueDiligence.verdict]) buckets[s.dueDiligence.verdict].push(risk);
  }
  assert.ok(buckets['危険'].length >= 5 && buckets['優良'].length >= 5, '前提: 両端の判定が十分なサンプル数で発生する');
  const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  assert.ok(avg(buckets['危険']) > avg(buckets['優良']),
    '「危険」判定の平均実riskは「優良」判定の平均実riskより高い（無相関だった旧設計からの回帰防止）');
}

// 6. Determinism: same id+state -> same verdict/discount/flags every time, across fresh games.
{
  function run() {
    const { engine } = newGame(314159);
    const s = pushStartup(engine, UNFAVORABLE_ID, { risk: WORST_RISK, growth: WORST_GROWTH });
    engine.conductStartupDueDiligence(s.id);
    return JSON.stringify(s.dueDiligence);
  }
  assert.equal(run(), run(), '同じID・同じrisk/growthのDD結果は毎回同じになる');
}

// 7. Save/reload round trip.
{
  const { modules, engine } = newGame();
  const s = pushStartup(engine, UNFAVORABLE_ID, { risk: WORST_RISK, growth: WORST_GROWTH });
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
    const s = pushStartup(engine, UNFAVORABLE_ID, { risk: WORST_RISK, growth: WORST_GROWTH });
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
