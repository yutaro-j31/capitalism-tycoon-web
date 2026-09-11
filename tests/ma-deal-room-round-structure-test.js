'use strict';

// PE mode T3 (docs/PE_MODE_TASKS.md): 'indication' (初期意向表明) and 'final_bid' (最終入札)
// round-structure statuses, and the advanceMADealRound "進む" action that moves a deal
// through them. Withdrawing ("降りる") stays js/ma-deal-room.js's existing withdrawMADeal,
// now also allowed from these two statuses.

const assert = require('assert');
const { load } = require('./ma-deal-room-test-helpers');
const { engineModule, dr } = load();
const { TycoonEngine } = engineModule;

function target(overrides = {}) {
  return { id: 't-a', name: '対象企業', domain: '物流', valuation: 100_000_000, sales: 80_000_000, operatingProfit: 8_000_000, growth: .1, risk: .1, synergy: .1, friendly: true, expiresWeek: 9999, ...overrides };
}
function make(targetRow = target(), modifier = () => {}) {
  const e = new TycoonEngine();
  e.g.configured = true;
  e.g.companyCash = 5_000_000_000;
  e.g.departments.investment = { established: true };
  e.g.departmentStaff.investment = 6;
  e.g.executives.CEO = { role: 'CEO', skill: 90 };
  e.g.executives.CSO = { role: 'CSO', skill: 90 };
  e.g.executives.CFO = { role: 'CFO', skill: 90 };
  e.g.acquisitionTargets = [targetRow];
  modifier(e.g);
  e.normalize();
  return e;
}
function tick(e, n = 1) { for (let i = 0; i < n; i++) { e.g.week += 1; dr.processDealWeek(e.g, e.g.week); } }

// 1. Full round-structure chain: screening -> indication -> diligence -> ready ->
// final_bid -> offer_pending -> accepted, exactly matching docs/PE_MODE_TASKS.md T3.
{
  const e = make();
  assert.equal(e.openMADealRoom('t-a'), true);
  const d = e.g.maDealRooms[0];
  assert.equal(d.status, 'screening');

  assert.equal(e.advanceMADealRound(d.id), true);
  assert.equal(d.status, 'indication', 'round 1: screening -> indication');

  assert.equal(e.startMADueDiligence(d.id, 'screening'), true);
  assert.equal(d.status, 'diligence', 'round 2: indication -> diligence');

  tick(e, 1);
  assert.equal(d.status, 'ready', 'DD completes into ready');

  assert.equal(e.advanceMADealRound(d.id), true);
  assert.equal(d.status, 'final_bid', 'round 3: ready -> final_bid');

  assert.equal(e.submitMAOffer(d.id, { method: 'friendly', offerPrice: Math.max(d.sellerAsk * 1.5, d.valuationBridge.recommendedMaximumPrice * 1.3) }), true);
  assert.equal(d.status, 'offer_pending', 'submitting an offer moves the deal to offer_pending');

  tick(e, 1);
  let guard = 0;
  while (d.status === 'countered' && guard++ < 3) { assert.equal(e.acceptMACounterOffer(d.id), true); tick(e, 1); }
  assert.equal(d.status, 'accepted', 'the full round-structure chain still reaches accepted');
}

// 2. advanceMADealRound only recognizes screening and ready as round-advance sources; it
// fails from every other in-progress status.
{
  const e = make();
  assert.equal(e.openMADealRoom('t-a'), true);
  const d = e.g.maDealRooms[0];
  assert.equal(e.advanceMADealRound(d.id), true); // screening -> indication
  assert.equal(e.advanceMADealRound(d.id), false, 'indication has no further round-advance target');
  assert.equal(e.startMADueDiligence(d.id, 'screening'), true);
  assert.equal(e.advanceMADealRound(d.id), false, 'diligence cannot round-advance');
  tick(e, 1);
  assert.equal(d.status, 'ready');
  assert.equal(e.advanceMADealRound(d.id), true); // ready -> final_bid
  assert.equal(e.advanceMADealRound(d.id), false, 'final_bid has no further round-advance target');
  assert.equal(e.submitMAOffer(d.id, { method: 'friendly', offerPrice: Math.max(d.sellerAsk * 1.5, d.valuationBridge.recommendedMaximumPrice * 1.3) }), true);
  assert.equal(e.advanceMADealRound(d.id), false, 'offer_pending cannot round-advance');
  assert.equal(e.advanceMADealRound('does-not-exist'), false, 'unknown deal id fails');
}

// 3. Withdrawing ("降りる") is free and terminalizes the deal from every round, including
// the two new ones -- and releases the target so it can be reopened.
for (const reachIndication of [true, false]) {
  const e = make();
  assert.equal(e.openMADealRoom('t-a'), true);
  const d = e.g.maDealRooms[0];
  const cashBefore = e.g.companyCash;
  if (reachIndication) assert.equal(e.advanceMADealRound(d.id), true);
  assert.equal(d.status, reachIndication ? 'indication' : 'screening');
  assert.equal(e.withdrawMADeal(d.id), true);
  assert.equal(d.status, 'withdrawn', `withdrawing from ${reachIndication ? 'indication' : 'screening'} must terminalize as withdrawn`);
  assert.equal(e.g.companyCash, cashBefore, 'withdrawing before an accepted offer must be free');
  assert.equal(e.g.acquisitionTargets[0].activeDealID, null, 'withdrawn target releases its active deal');
  assert.equal(e.openMADealRoom('t-a'), true, 'a withdrawn target can be reopened before expiry');
}

// 3b. Withdrawing from final_bid is also free and terminalizes correctly.
{
  const e = make();
  assert.equal(e.openMADealRoom('t-a'), true);
  const d = e.g.maDealRooms[0];
  assert.equal(e.advanceMADealRound(d.id), true);
  assert.equal(e.startMADueDiligence(d.id, 'screening'), true);
  tick(e, 1);
  assert.equal(d.status, 'ready');
  assert.equal(e.advanceMADealRound(d.id), true);
  assert.equal(d.status, 'final_bid');
  const cashBefore = e.g.companyCash;
  assert.equal(e.withdrawMADeal(d.id), true);
  assert.equal(d.status, 'withdrawn', 'withdrawing from final_bid must terminalize as withdrawn');
  assert.equal(e.g.companyCash, cashBefore, 'withdrawing from final_bid must be free (no offer accepted yet)');
}

// 4. The deal deadline still terminalizes deals sitting in either new round, just like the
// other in-progress statuses (DEAL_DEADLINE_STATUSES).
for (const advanceTo of ['indication', 'final_bid']) {
  const e = make();
  assert.equal(e.openMADealRoom('t-a'), true);
  const d = e.g.maDealRooms[0];
  assert.equal(e.advanceMADealRound(d.id), true);
  if (advanceTo === 'final_bid') {
    assert.equal(e.startMADueDiligence(d.id, 'screening'), true);
    tick(e, 1);
    assert.equal(d.status, 'ready');
    assert.equal(e.advanceMADealRound(d.id), true);
  }
  assert.equal(d.status, advanceTo);
  e.g.week = d.deadlineWeek;
  dr.processDealWeek(e.g, e.g.week);
  // 'lost' (a competitor won) or 'expired' (no active competitor) are both valid deadline
  // terminalizations -- js/pe-rivals.js's roster can draw a competitor while a deal sits in
  // indication/final_bid too (COMPETITOR_ELIGIBLE), same as any other in-progress round.
  assert.ok(['expired', 'lost'].includes(d.status), `deal deadline must terminalize a deal sitting in ${advanceTo}, got ${d.status}`);
  assert.equal(e.g.acquisitionTargets[0].activeDealID, null);
}

// 5. The pre-T3 direct path (screening -> DD, ready -> offer, skipping both new rounds
// entirely) still works unchanged -- the production UI and tests/ma-deal-room-webkit-test.js
// use exactly this path and this task does not add a UI, so it must not be forced.
{
  const e = make();
  assert.equal(e.openMADealRoom('t-a'), true);
  const d = e.g.maDealRooms[0];
  assert.equal(d.status, 'screening');
  assert.equal(e.startMADueDiligence(d.id, 'screening'), true, 'DD must still start directly from screening');
  tick(e, 1);
  assert.equal(d.status, 'ready');
  assert.equal(e.submitMAOffer(d.id, { method: 'friendly', offerPrice: Math.max(d.sellerAsk * 1.5, d.valuationBridge.recommendedMaximumPrice * 1.3) }), true, 'an offer must still submit directly from ready');
  tick(e, 1);
  let guard = 0;
  while (d.status === 'countered' && guard++ < 3) { assert.equal(e.acceptMACounterOffer(d.id), true); tick(e, 1); }
  assert.equal(d.status, 'accepted');
}

// 6. STATUS_LABELS carries Japanese labels for both new statuses (used by history messages).
{
  assert.equal(typeof dr.STATUS_LABELS.indication, 'string');
  assert.ok(dr.STATUS_LABELS.indication.length > 0);
  assert.equal(typeof dr.STATUS_LABELS.final_bid, 'string');
  assert.ok(dr.STATUS_LABELS.final_bid.length > 0);
}

// 7. Existing weekly processing (processDealWeek) keeps running for deals that pass through
// indication/final_bid: history entries are recorded and lastProcessedWeek advances.
{
  const e = make();
  assert.equal(e.openMADealRoom('t-a'), true);
  const d = e.g.maDealRooms[0];
  assert.equal(e.advanceMADealRound(d.id), true);
  tick(e, 1);
  assert.equal(d.lastProcessedWeek, e.g.week, 'processDealWeek must still advance lastProcessedWeek while in indication');
  assert.ok(d.history.some(h => h.type === 'round_advanced'), 'the round advance must be recorded in deal history');
}

console.log('ma deal room round structure tests passed');
