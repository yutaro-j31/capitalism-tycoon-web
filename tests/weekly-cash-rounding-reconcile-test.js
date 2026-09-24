'use strict';

// Issue #751 (P0-09): reconcileWeeklyCashRounding() compared the week's stored finance snapshot
// with itself and assigned its endingCash to companyCash. That snapshot can be recorded before
// later layers move cash (e.g. property tax posted by the parity layer), so whenever the stale
// snapshot showed a sub-five-cent gap, every later, properly ledgered cash movement of the week
// was silently undone -- while the rounding audit recorded only the stale cent.
// Runs against the full production script set.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}

function newGame(seed) {
  const loaded = loadGame({ headless: true, random: lcg(seed) });
  const engine = new loaded.engineModule.TycoonEngine();
  engine.configure({ playerName: 'Rounding', companyName: 'Rounding Co', difficulty: 'normal' });
  const finance = loaded.modules.finance;
  engine.g.companyCash = 2_000_000_000;
  engine.g.finance = finance.defaultFinanceState(engine.g);
  return { engine, finance, balance: loaded.modules.difficultyScenarioBalance };
}

function assertValid(finance, g, label) {
  const v = finance.validate(g);
  assert.equal(v.ok, true, `${label}: ${v.errors.join(' / ')}`);
}

const LIMIT = 0.05;

// 1. A ledgered payment made after the week's snapshot must survive the reconciliation.
{
  const { engine, finance, balance } = newGame(751);
  assert.notEqual(engine.advanceWeek(false), false);
  const g = engine.g, week = g.week;
  const snap = g.finance.weeklySnapshots.find(s => s.week === week);
  assert.ok(snap, 'fixture needs this week\'s snapshot');
  // The stored snapshot shows a one-cent gap, then a later layer pays 1,234.56 with a ledger row.
  snap.actualCompanyCash = Math.round((snap.endingCash + 0.01) * 100) / 100;
  g.companyCash -= 1234.56;
  finance.event(g, 'otherOperating', 1234.56, { cashEffect: -1234.56, profitEffect: -1234.56, sourceType: 'test', sourceID: 'late-payment', idempotencyKey: 'late-payment' });
  const cash = g.companyCash, count = g.finance.roundingAdjustmentCount;
  balance.reconcileWeeklyCashRounding(g);
  assert.ok(Math.abs(g.companyCash - cash) <= LIMIT, `later payment must not be reverted: cash moved by ${g.companyCash - cash}`);
  const adjustments = g.finance.roundingAdjustmentHistory.slice(count);
  const recorded = adjustments.reduce((a, row) => a + row.adjustment, 0);
  assert.ok(Math.abs((g.companyCash - cash) - recorded) < 0.005, 'the audit records exactly the cash it moved');
  assertValid(finance, g, 'after late payment');
}

// 2. A genuine sub-limit rounding gap between companyCash and the ledger is still absorbed.
{
  const { engine, finance, balance } = newGame(752);
  assert.notEqual(engine.advanceWeek(false), false);
  const g = engine.g;
  g.companyCash = Math.round((g.companyCash + 0.02) * 100) / 100;
  const cash = g.companyCash;
  assert.equal(balance.reconcileWeeklyCashRounding(g), true);
  assert.equal(Math.round((g.companyCash - cash) * 100) / 100, -0.02);
  assert.equal(g.finance.roundingAdjustmentHistory.at(-1).adjustment, -0.02);
  assertValid(finance, g, 'genuine rounding gap');
}

// 3. Production loop: a company holding a building for 104 weeks. Property tax is paid after the
//    week's snapshot, so this path used to revert it whenever the snapshot had a rounding cent.
{
  const { engine, finance } = newGame(1);
  const g = engine.g;
  const land = g.properties.find(p => !p.owner && p.kind === '土地' && p.price < 300_000_000);
  assert.ok(land, 'fixture needs an unowned plot of land');
  assert.equal(engine.buyProperty(land.id, 'company'), true);
  assert.equal(engine.buildOnLand(land.id, '本社ビル'), true);
  assertValid(finance, g, 'after build');
  // Ledger rows are rounded to the cent while companyCash is not, so the reconciliation may
  // legitimately absorb accumulated drift in a later week: compare the running totals.
  let offLedger = 0;
  const recordedTotal = () => g.finance.roundingAdjustmentTotal;
  const recordedStart = recordedTotal();
  for (let i = 0; i < 104; i++) {
    const cash = g.companyCash, rows = g.finance.transactions.length;
    assert.notEqual(engine.advanceWeek(false), false);
    const ledger = g.finance.transactions.slice(rows).reduce((a, t) => a + t.cashEffect, 0);
    const unexplained = (g.companyCash - cash) - ledger;
    offLedger += unexplained;
    assert.ok(Math.abs(unexplained) <= LIMIT, `week ${g.week}: cash moved ${unexplained} beyond the ledger`);
    assert.ok(Math.abs(offLedger - (recordedTotal() - recordedStart)) <= LIMIT, `week ${g.week}: off-ledger cash ${offLedger} is not what the rounding audit recorded (${recordedTotal() - recordedStart})`);
    assertValid(finance, g, `week ${g.week}`);
  }
  assert.ok(g.finance.roundingAdjustmentCount > 0, 'fixture must exercise the rounding reconciliation');
  for (const row of g.finance.roundingAdjustmentHistory) assert.ok(Math.abs(row.adjustment) <= LIMIT, `week ${row.week}: adjustment ${row.adjustment}`);
}

console.log('weekly cash rounding reconcile tests passed');
