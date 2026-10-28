'use strict';
// P3-4 W-PE-FORM: a PE firm with one recorded buyout exit (the track-record witness the PE fund tests use), an investment
// department and executives, as in tests/pe-fund-formation-test.js. Forming Fund I with the installed formPEFund, at the
// maximum plan or at half the GP commitment, is the command under test. The only hand-set inputs are cash buffers,
// the department and executives, and the recorded exit.
const assert = require('node:assert/strict');
const { boot, snapshot, economic } = require('./subsidiary-quarter-close');

const VARIANTS = Object.freeze({ maximum: { half: false }, custom: { half: true } });
let staged = null;
function firmState() {
  if (staged) return staged;
  const ctx = boot(), game = new ctx.engineModule.TycoonEngine();
  game.configure({ playerName: 'GP', companyName: 'PE Partners', difficulty: 'normal', scenario: 'free', simulationSeed: 971 });
  game.g.departments.investment = { established: true }; game.g.departmentStaff.investment = 9;
  game.g.executives.CSO = { role: 'CSO', skill: 80 }; game.g.executives.CFO = { role: 'CFO', skill: 80 };
  game.g.companyCash = 50_000_000_000;
  ctx.modules.peFund.recordExit(game.g, { exitType: 'buyout', realizedAmount: 200_000_000, investedAmount: 8_000_000, foundedWeek: 1, exitedWeek: 52,
    profitableWeekStreak: 260, employeeCount: 30 });
  game.g.personalCash = 30_000_000_000;
  game.g.finance = ctx.modules.finance.defaultFinanceState(game.g);
  assert.equal(game.formablePEFund().ok, true, 'Fund I formable');
  return (staged = JSON.stringify(game.g));
}
async function fixture(variant = 'maximum') {
  assert.ok(Object.hasOwn(VARIANTS, variant), 'known PE fund formation variant');
  const ctx = boot(); await ctx.backend.hydrate();
  const game = new ctx.engineModule.TycoonEngine(JSON.parse(firmState()));
  assert.equal(ctx.modules.finance.validate(snapshot(game)).ok, true, 'reloaded accounting valid');
  assert.equal(game.save(), true); await ctx.backend.flush();
  const plan = game.formablePEFund();
  const options = VARIANTS[variant].half ? { gpCommit: Math.floor(plan.gpCommit / 2) } : {};
  return { ...ctx, game, variant, options };
}
const command = ctx => ctx.game.formPEFund(ctx.options);
module.exports = { fixture, command, snapshot, economic, VARIANTS };
