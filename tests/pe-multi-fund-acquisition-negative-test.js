'use strict';

// PE multi-fund acquisition separation (PR #713 follow-up). With two investing funds the player
// picks the vehicle at DD and deal.fundID carries it to closing. Existing multi-fund tests stop at
// DD, and every test that reaches closeMADeal() has a single fund, where "the selected fund" and
// "the newest fund" are the same object. A closing path that debited the newest investing fund
// instead of deal.fundID therefore passed the whole suite. This test selects the OLDER fund and
// proves the purchase price leaves only that fund's cash, the holding lands only in that fund,
// and neither operating-company cash nor personal cash moves.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function makeRandom(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; }; }

const { engineModule, modules } = loadGame({ random: makeRandom(71), isolatedLegacyIndex: true });
const pf = modules.peFund, ds = modules.peDealSupply;

const e = new engineModule.TycoonEngine();
e.configure({ playerName: 'GP', companyName: 'PEパートナーズ', difficulty: 'normal' });
e.g.departments.investment = { established: true };
e.g.departmentStaff.investment = 9;
e.g.executives.CSO = { role: 'CSO', skill: 80 };
e.g.executives.CFO = { role: 'CFO', skill: 80 };
e.g.companyCash = 50_000_000_000;
pf.recordExit(e.g, { exitType: 'buyout', realizedAmount: 200_000_000, investedAmount: 8_000_000, foundedWeek: 1, exitedWeek: 52, profitableWeekStreak: 260, employeeCount: 30 });
e.g.personalCash = 30_000_000_000;

// Fund I, then satisfy the next-fund gate (deployment + DPI) and form Fund II while Fund I is
// still investing, so two investing vehicles coexist.
assert.equal(e.formPEFund(), true, 'Fund I must be formable');
const older = e.g.peFirm.funds[0];
older.deals.push({ id: 'synthetic-exited', status: 'exited', investedAmount: older.size * .9, fundPortion: older.size * .9, coinvestPortion: 0 });
pf.distributeToInvestors(e.g, older, older.size * 1.5);
assert.equal(e.formPEFund(), true, 'Fund II must be formable once the gate is met');
const newer = e.g.peFirm.funds[1];
assert.equal(ds.investingFunds(e.g).map(f => f.id).join(','), [older.id, newer.id].join(','), 'two investing funds coexist');
assert.equal(ds.activeInvestingFund(e.g).id, newer.id, 'fixture: the newest investing fund is NOT the one we select');

// Wait for a PE target the OLDER fund is allowed to buy.
let target = null;
for (let i = 0; i < 120 && !target; i++) {
  e.advanceWeek(false);
  target = e.g.acquisitionTargets.filter(ds.isPETarget).find(t => !t.activeDealID && ds.eligibleInvestingFundsForTarget(e.g, t).some(f => f.id === older.id)) || null;
}
assert.ok(target, 'deterministic supply must bring a target the older fund can pursue');
assert.equal(older.status, 'investing', 'older fund is still inside its investment period');
assert.equal(newer.status, 'investing');

assert.equal(e.openMADealRoom(target.id), true);
const deal = e.g.maDealRooms.find(d => d.targetID === target.id);
assert.equal(e.startMADueDiligence(deal.id, 'screening', older.id), true, 'DD starts on the explicitly selected older fund');
assert.equal(deal.fundID, older.id);
for (let i = 0; i < 6 && deal.status === 'diligence'; i++) e.advanceWeek(false);
assert.equal(deal.status, 'ready');
const price = Math.ceil(e.calculateMAAcquisitionPrice(target, 'friendly').minimumPrice * 1.02);
e.setPEDealCoinvest(deal.id, true);
assert.equal(e.submitMAOffer(deal.id, { method: 'friendly', offerPrice: price }), true);
for (let i = 0; i < 4 && deal.status === 'offer_pending'; i++) e.advanceWeek(false);
assert.equal(deal.status, 'accepted');

// Snapshot immediately before closing: no week passes between here and the assertions, so
// management fees / portfolio operations cannot move any of these balances.
const plan = pf.planDealFinancing(older, Math.max(0, Number(deal.acceptedTerms?.offerPrice ?? deal.offerPrice ?? price)), Boolean(deal.useCoinvest));
const olderCashBefore = older.cash, olderDealsBefore = older.deals.length;
const newerCashBefore = newer.cash, newerDealsBefore = JSON.stringify(newer.deals);
const companyCashBefore = e.g.companyCash, personalCashBefore = e.g.personalCash;

assert.equal(e.closeMADeal(deal.id), true, 'closing reaches acquisition');

const held = older.deals[older.deals.length - 1];
assert.equal(older.deals.length, olderDealsBefore + 1, 'the holding is recorded in the selected (older) fund');
assert.ok(held && held.status === 'active' && held.sourceTargetID === target.id);
assert.ok(plan.fundPortion > 0, 'fixture: the selected fund pays a positive fund portion');
assert.ok(Math.abs(held.fundPortion - plan.fundPortion) < 1e-6, 'recorded fund portion matches the financing plan');
assert.ok(Math.abs((olderCashBefore - older.cash) - held.fundPortion) < 1e-6, 'the selected (older) fund cash falls by exactly the fund portion');
assert.equal(newer.cash, newerCashBefore, 'the non-selected (newest) fund cash is untouched');
assert.equal(JSON.stringify(newer.deals), newerDealsBefore, 'the non-selected (newest) fund holdings are untouched');
assert.ok(!newer.deals.some(d => d.sourceTargetID === target.id), 'the holding never appears in the non-selected fund');
assert.equal(e.g.companyCash, companyCashBefore, 'PE purchase price never comes from operating-company cash');
assert.equal(e.g.personalCash, personalCashBefore, 'PE purchase price never comes from personal cash');

console.log('pe multi-fund acquisition negative test passed');
