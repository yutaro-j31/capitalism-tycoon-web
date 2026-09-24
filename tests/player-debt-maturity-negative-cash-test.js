'use strict';

// Issue #728 (P0-03): processDebtMaturity() used Math.max(0, companyCash - principal - fee).
// When a maturity week lands while the company is already overdrawn (a player-crisis grace
// period allows negative cash), that clamp lifted cash to zero with no ledger entry -- money
// creation plus a permanent finance.validate() mismatch. Cash must only move by the principal
// and fee actually recorded.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}

function newEngine(seed) {
  const loaded = loadGame({ headless: true, random: lcg(seed) });
  const engine = new loaded.engineModule.TycoonEngine();
  engine.configure({ playerName: 'Maturity', companyName: 'Maturity Co', difficulty: 'normal' });
  const finance = loaded.modules.finance;
  // Well-capitalised fixture, rebased so the opening balance itself is not a validate() diff.
  engine.g.companyCash = 500_000_000;
  engine.g.finance = finance.defaultFinanceState(engine.g);
  assert.equal(engine.borrowFromBank(100_000_000, 156), true, 'bank loan must be drawn');
  return { engine, finance, debtService: loaded.modules.playerDebtService };
}

// Drain cash below zero through a ledgered expense so the books stay consistent beforehand.
function overdraw(engine, finance, overdraft) {
  const drain = engine.g.companyCash + overdraft;
  engine.g.companyCash -= drain;
  finance.event(engine.g, 'otherOperating', drain, { cashEffect: -drain, profitEffect: -drain, sourceType: 'test', sourceID: 'overdraw' });
  const v = finance.validate(engine.g);
  assert.equal(v.ok, true, `fixture must start balanced: ${v.errors.join(' / ')}`);
}

// 1. Direct call: an overdrawn company at maturity pays nothing and cash is left untouched.
{
  const { engine, finance, debtService } = newEngine(728);
  overdraw(engine, finance, 2_000_000);
  debtService.refinancingState(engine).nextMaturityWeek = engine.g.week;
  const before = engine.g.companyCash;
  const r = debtService.processDebtMaturity(engine);
  const row = r.history.at(-1);
  assert.equal(row.principalPaid, 0);
  assert.equal(row.fee, 0);
  assert.equal(engine.g.companyCash, before, 'negative cash must not be lifted to zero');
  const v = finance.validate(engine.g);
  assert.equal(v.ok, true, v.errors.join(' / '));
}

// 2. Through the production weekly loop: the maturity week must not create cash.
{
  const { engine, finance, debtService } = newEngine(729);
  overdraw(engine, finance, 1_000_000);
  debtService.refinancingState(engine).nextMaturityWeek = engine.g.week + 1;
  assert.notEqual(engine.advanceWeek(false), false);
  const row = debtService.refinancingState(engine).history.at(-1);
  assert.equal(row?.week, engine.g.week, 'maturity must have been processed this week');
  assert.ok(engine.g.companyCash < 0, `overdrawn company stays overdrawn, got ${engine.g.companyCash}`);
  const v = finance.validate(engine.g);
  assert.equal(v.ok, true, v.errors.join(' / '));
}

// 3. Healthy company: behaviour is unchanged -- cash drops by exactly principal + fee.
{
  const { engine, finance, debtService } = newEngine(730);
  debtService.refinancingState(engine).nextMaturityWeek = engine.g.week;
  const before = engine.g.companyCash;
  const r = debtService.processDebtMaturity(engine);
  const row = r.history.at(-1);
  assert.ok(row.principalPaid > 0);
  assert.equal(engine.g.companyCash, before - row.principalPaid - row.fee);
  const v = finance.validate(engine.g);
  assert.equal(v.ok, true, v.errors.join(' / '));
}

console.log('player debt maturity negative-cash tests passed');
