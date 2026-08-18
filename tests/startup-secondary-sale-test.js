'use strict';

// feature-requests.md R1 remaining item "セカンダリー市場". Audited first: a live VC
// position in js/engine.js's `startups` (ownedCompany/ownedPersonal) could previously only
// leave the balance sheet by the startup dying (writeOffStartup), being IPO'd (listStartup,
// converts to public stock), or being made a subsidiary (makeSubsidiary) -- there was no way
// to voluntarily cash out of a still-private, still-alive position early. This adds
// sellStartupSecondary() (js/expansion.js), a relative (secondary) sale of the whole stake
// at the current valuation less an illiquidity discount (private secondaries never trade at
// par). The discount is derived with deterministicUnit/deterministicRange -- the same
// RNG-free FNV-1a hash pattern already used for supplier delay, personal real estate
// renewal, and PE value creation -- keyed on startup id + account + week, so it draws zero
// Math.random() and leaves randomCallsAtWeek52 untouched. Selling is blocked while an
// activeFundingRound is open: closeStartupFundingRound() recomputes ownership from a
// preRoundOwnedCompany/preRoundOwnedPersonal snapshot taken when the round opened, so
// zeroing ownership mid-round would silently resurrect it at close, undoing the sale.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 730501001) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 730501001) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  engine.g.personalCash = 50_000_000;
  return { modules, ctx, engine };
}

// Local re-implementation of js/expansion.js's deterministicUnit/deterministicRange, used
// only to independently compute the expected discount and cross-check production output.
function deterministicUnit(...parts) {
  let h = 2166136261;
  const text = parts.map(v => String(v ?? '')).join('|');
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}
function deterministicRange(min, max, ...parts) { return min + deterministicUnit(...parts) * (max - min); }
function expectedDiscount(startupID, account, week) { return deterministicRange(.12, .28, 'startup-secondary', startupID, account, week); }

function enableCompanyInvesting(engine) {
  const office = engine.g.rentalOffices.reduce((a, b) => (a.deposit < b.deposit ? a : b));
  assert.equal(engine.contractOffice(office.id), true);
  assert.equal(engine.establishDepartment('investment'), true);
}

// 1. Personal sale: invest personally, then sell -- personalCash increases by the
// discounted proceeds, position is fully cleared.
{
  const { engine } = newGame();
  const s = engine.g.startups[0];
  assert.equal(engine.investStartup(s.id, s.minTicket, 'personal'), true);
  const owned = s.ownedPersonal, valuation = s.valuation, before = engine.g.personalCash;
  const discount = expectedDiscount(s.id, 'personal', engine.g.week);
  const expectedProceeds = Math.round(owned * valuation * (1 - discount));
  assert.equal(engine.sellStartupSecondary(s.id, 'personal'), true);
  assert.equal(engine.g.personalCash, before + expectedProceeds, '割引後の売却代金だけpersonalCashが増える');
  assert.equal(s.ownedPersonal, 0);
  assert.equal(s.totalInvestedPersonal, 0);
  assert.ok(discount >= .12 && discount < .28, '流動性ディスカウントは12%〜28%の範囲');
}

// 2. Company sale: invest via company account, then sell -- companyCash increases, finance
// ledger stays valid.
{
  const { modules, engine } = newGame();
  enableCompanyInvesting(engine);
  engine.g.companyCash = 50_000_000;
  engine.g.finance = modules.finance.defaultFinanceState(engine.g);
  const s = engine.g.startups[1];
  assert.equal(engine.investStartup(s.id, s.minTicket, 'company'), true);
  const owned = s.ownedCompany, valuation = s.valuation, before = engine.g.companyCash;
  const discount = expectedDiscount(s.id, 'company', engine.g.week);
  const expectedProceeds = Math.round(owned * valuation * (1 - discount));
  assert.equal(engine.sellStartupSecondary(s.id, 'company'), true);
  assert.equal(engine.g.companyCash, before + expectedProceeds, '割引後の売却代金だけcompanyCashが増える');
  assert.equal(s.ownedCompany, 0);
  assert.equal(s.totalInvestedCompany, 0);
  const v = modules.finance.validate(engine.g);
  assert.equal(v.ok, true, (v.errors || []).join('\n'));
}

// 3. Guard: no owned stake -> false, no state change.
{
  const { engine } = newGame();
  const s = engine.g.startups[0];
  assert.equal(s.ownedCompany, 0);
  const before = JSON.stringify(engine.g.startups);
  assert.equal(engine.sellStartupSecondary(s.id, 'company'), false, '持分ゼロでは売却できない');
  assert.equal(JSON.stringify(engine.g.startups), before);
}

// 4. Guard: nonexistent startup id -> false.
{
  const { engine } = newGame();
  assert.equal(engine.sellStartupSecondary('no-such-startup', 'personal'), false);
}

// 5. Guard: dead startup -> false.
{
  const { engine } = newGame();
  const s = engine.g.startups[0];
  assert.equal(engine.investStartup(s.id, s.minTicket, 'personal'), true);
  s.alive = false;
  assert.equal(engine.sellStartupSecondary(s.id, 'personal'), false, '事業停止した投資先は売却できない');
}

// 6. Guard: subsidiary startup -> false.
{
  const { engine } = newGame();
  enableCompanyInvesting(engine);
  engine.g.companyCash = 200_000_000;
  const s = engine.g.startups[0];
  assert.equal(engine.investStartup(s.id, s.minTicket, 'company'), true);
  s.ownedCompany = .6;
  assert.equal(engine.makeSubsidiary(s.id), true);
  assert.equal(engine.sellStartupSecondary(s.id, 'company'), false, '子会社化済みは相対売却できない');
}

// 7. Guard: active follow-on funding round -> false (accounting safety: closeStartupFundingRound
// recomputes ownership from a pre-round snapshot, so selling mid-round would be silently undone).
{
  const { engine } = newGame();
  const s = engine.g.startups[0];
  assert.equal(engine.investStartup(s.id, s.minTicket, 'personal'), true);
  s.fundingOpen = true;
  assert.equal(engine.openStartupFundingRound(s), true);
  assert.ok(s.activeFundingRound, 'precondition: 追加資金調達ラウンドが開いている');
  assert.equal(engine.sellStartupSecondary(s.id, 'personal'), false, '追加資金調達ラウンド中は売却できない');
}

// 8. Guard: already IPO'd (ipoStockID set) -> false.
{
  const { engine } = newGame();
  const s = engine.g.startups[0];
  assert.equal(engine.investStartup(s.id, s.minTicket, 'personal'), true);
  s.ipoStockID = 'V1234';
  assert.equal(engine.sellStartupSecondary(s.id, 'personal'), false, 'IPO転換済みは相対売却の対象外');
}

// 9. Company/personal separation: a company-account sale never touches personalCash /
// personalStocks; a personal-account sale never touches companyCash / companyStocks.
{
  const { modules, engine } = newGame();
  enableCompanyInvesting(engine);
  engine.g.companyCash = 50_000_000;
  engine.g.finance = modules.finance.defaultFinanceState(engine.g);
  const sc = engine.g.startups[0];
  assert.equal(engine.investStartup(sc.id, sc.minTicket, 'company'), true);
  const personalCashBefore = engine.g.personalCash, personalStocksBefore = JSON.stringify(engine.g.personalStocks);
  assert.equal(engine.sellStartupSecondary(sc.id, 'company'), true);
  assert.equal(engine.g.personalCash, personalCashBefore, '会社口座の売却はpersonalCashに影響しない');
  assert.equal(JSON.stringify(engine.g.personalStocks), personalStocksBefore);

  const sp = engine.g.startups[1];
  assert.equal(engine.investStartup(sp.id, sp.minTicket, 'personal'), true);
  const companyCashBefore = engine.g.companyCash, companyStocksBefore = JSON.stringify(engine.g.companyStocks);
  assert.equal(engine.sellStartupSecondary(sp.id, 'personal'), true);
  assert.equal(engine.g.companyCash, companyCashBefore, '個人口座の売却はcompanyCashに影響しない');
  assert.equal(JSON.stringify(engine.g.companyStocks), companyStocksBefore);
}

// 10. Determinism: same seed, same actions -> identical resulting state.
{
  function run() {
    const { engine } = newGame(918273);
    const s = engine.g.startups[0];
    engine.investStartup(s.id, s.minTicket, 'personal');
    engine.sellStartupSecondary(s.id, 'personal');
    return JSON.stringify({ personalCash: engine.g.personalCash, startups: engine.g.startups });
  }
  assert.equal(run(), run(), '同じseed・同じ操作で同じ結果になる');
}

// 11. Save/reload round trip.
{
  const { modules, engine } = newGame();
  const s = engine.g.startups[0];
  assert.equal(engine.investStartup(s.id, s.minTicket, 'personal'), true);
  assert.equal(engine.sellStartupSecondary(s.id, 'personal'), true);
  const before = JSON.stringify(engine.g.startups);
  engine.save();
  const EngineClass = modules.engine.TycoonEngine;
  const reloaded = EngineClass.load();
  assert.equal(JSON.stringify(reloaded.g.startups), before, 'reload後もstartupsが一致する');
}

// 12. Zero RNG consumption: the illiquidity discount is derived deterministically, not
// drawn from Math.random -- verified directly against the injected random function's call
// count rather than inferring it from randomCallsAtWeek52.
{
  let calls = 0;
  const inner = lcg();
  const counting = () => { calls++; return inner(); };
  const { ctx } = loadGame({ random: counting });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  engine.g.personalCash = 50_000_000;
  const s = engine.g.startups[0];
  assert.equal(engine.investStartup(s.id, s.minTicket, 'personal'), true);
  const before = calls;
  assert.equal(engine.sellStartupSecondary(s.id, 'personal'), true);
  assert.equal(calls, before, 'sellStartupSecondaryはMath.randomを一切消費しない');
}

// 13. Static source scan: no new MutationObserver introduced by this feature.
{
  const fs = require('node:fs');
  const path = require('node:path');
  const expansionSrc = fs.readFileSync(path.join(__dirname, '../js/expansion.js'), 'utf8');
  const appSrc = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
  assert.ok(!/new MutationObserver|new env\.MutationObserver/.test(expansionSrc), 'expansion.jsに新しいMutationObserverを追加していない');
  assert.ok(!/new MutationObserver|new env\.MutationObserver/.test(appSrc), 'app.jsに新しいMutationObserverを追加していない');
}

console.log('Startup secondary sale tests passed');
