'use strict';
// P3-4 W-WEEK-PE: Fund I formed with the installed formPEFund (tests/fixtures/pe-fund-formation-atomicity.js), then placed
// on the eve of one fund-lifecycle transition that the installed canonical week runs through processFundsWeek:
//   fee     - week 52 -> 53: the first annual management-fee period is collected and the team payroll paid;
//   harvest - week 260 -> 261: the investment period ends and undeployed cash returns to LPs and the GP at par;
//   close   - week 520 -> 521: the fund term ends, remaining cash is returned and the fund closes.
// The hand-set inputs are the week, the fund's processing cursors (lastProcessedWeek, lastManagementFeePeriod, so the
// pinned week runs only the pinned transition) and, for close, the harvesting status with ¥1bn of remaining cash.
const assert = require('node:assert/strict');
const { fixture: formed, command: form } = require('./pe-fund-formation-atomicity');
const { snapshot, economic } = require('./subsidiary-quarter-close');

const PINS = Object.freeze({
  fee: Object.freeze({ week: 52, feePeriod: 0 }),
  harvest: Object.freeze({ week: 260, feePeriod: 5 }),
  close: Object.freeze({ week: 520, feePeriod: 10, status: 'harvesting', cash: 1_000_000_000 })
});
let staged = null;
async function fundState() {
  if (staged) return staged;
  const s = await formed('maximum'); assert.equal(form(s), true, 'Fund I formed');
  return (staged = JSON.stringify(s.game.g));
}
// options.defer pushes the pinned transition one week later: the same week without it, for cash comparisons.
async function fixture(variant = 'fee', options = {}) {
  assert.ok(Object.hasOwn(PINS, variant), 'known PE fund week variant');
  const pin = PINS[variant], state = JSON.parse(await fundState()), s = await formed('maximum');
  const fund = state.peFirm.funds[0];
  state.week = pin.week; fund.lastProcessedWeek = pin.week; fund.lastManagementFeePeriod = pin.feePeriod;
  if (pin.status) fund.status = pin.status;
  if (pin.cash !== undefined) fund.cash = pin.cash;
  if (options.defer) {
    if (variant === 'fee') fund.lastManagementFeePeriod = 1;
    // Both deadlines are derived from the vintage week on load, so the control moves the vintage.
    if (variant !== 'fee') fund.y0 += 1;
  }
  // Normalize the pinned state through the production load (the moved week renews derived periods such as ddUsage).
  assert.equal(new s.engineModule.TycoonEngine(state).save(), true); await s.backend.flush();
  const game = s.engineModule.TycoonEngine.load();
  assert.equal(s.modules.finance.validate(snapshot(game)).ok, true, 'pinned accounting valid');
  assert.equal(game.save(), true); await s.backend.flush();
  return { ...s, game, variant, pin, fundID: fund.id };
}
const fundOf = (state, s) => state.peFirm.funds.find(f => f.id === s.fundID);
// The installed week must run the pinned transition (a full rollback alone cannot show that the transition was reached).
function week(s) {
  const before = JSON.parse(JSON.stringify(fundOf(s.game.g, s)));
  try { return s.game.advanceWeek(false); }
  finally {
    const after = fundOf(s.game.g, s), moved = { fee: after.lastManagementFeePeriod > before.lastManagementFeePeriod,
      harvest: before.status === 'investing' && after.status === 'harvesting', close: after.status === 'closed' && before.status !== 'closed' }[s.variant];
    if (s.game.g.week === s.pin.week + 1) assert.ok(moved, `actual installed week runs the ${s.variant} transition`);
  }
}
module.exports = { fixture, snapshot, economic, PINS, week, fundOf };
