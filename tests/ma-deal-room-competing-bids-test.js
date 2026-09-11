'use strict';

// PE mode T2 (docs/PE_MODE_TASKS.md): deal.competingBids (plural) built from js/pe-rivals.js's
// T1 roster judgement, layered onto js/ma-deal-room.js's existing single deal.competingBid
// flow without rewriting sellerScore/competitorResultScore.

const assert = require('assert');
const { load } = require('./ma-deal-room-test-helpers');
const { engineModule, dr, pe } = load();
const { TycoonEngine } = engineModule;

function target(overrides = {}) {
  return { id: 't-a', name: '対象企業', domain: '外食', valuation: 100_000_000, sales: 70_000_000, operatingProfit: 8_000_000, growth: .1, risk: .1, synergy: .05, friendly: true, expiresWeek: 9999, ...overrides };
}

// This target is deliberately eligible for several js/pe-rivals.js §5 conditions at once
// (large + damaged + synergy, plus most weeks fall inside the emerging-fund early-game
// window) so a competitor-arrival week reliably draws more than one firm.
function multiRivalTarget(overrides = {}) {
  return target({ valuation: 1_600_000_000, growth: .2, risk: .3, synergy: .19, operatingProfit: -2_000_000, ...overrides });
}

function make(targetRow, modifier = () => {}) {
  const e = new TycoonEngine();
  e.g.configured = true;
  e.g.companyCash = 10_000_000_000;
  e.g.departments.investment = { established: true };
  e.g.departmentStaff.investment = 9;
  e.g.executives.CSO = { role: 'CSO', skill: 80 };
  e.g.executives.CFO = { role: 'CFO', skill: 80 };
  e.g.companyReputation = 80;
  e.g.acquisitionTargets = [targetRow];
  modifier(e.g);
  e.normalize();
  return e;
}
function tick(e, n = 1) { for (let i = 0; i < n; i++) { e.g.week += 1; dr.processDealWeek(e.g, e.g.week); } }

// Runs the deal forward until a competitor shows up (or gives up after a large week budget),
// returning the week it appeared on.
function advanceUntilCompetitor(e, deal, maxWeeks = 200) {
  for (let i = 0; i < maxWeeks; i++) {
    tick(e);
    if (deal.competingBid) return e.g.week;
  }
  return null;
}

// 1. New deals can draw multiple bidders, all sourced from js/pe-rivals.js's roster, and
// deal.competingBid (singular, read by sellerScore/competitorResultScore) is the highest
// priced one among them.
{
  const e = make(multiRivalTarget());
  assert.equal(e.openMADealRoom('t-a'), true);
  const deal = e.g.maDealRooms[0];
  const week = advanceUntilCompetitor(e, deal);
  assert.ok(week, 'a competitor must eventually show up for a multi-rival-eligible target');
  assert.ok(deal.competingBids.length >= 1, 'competingBids must record at least the winning bidder');
  for (const bid of deal.competingBids) {
    assert.ok(pe.ROSTER.some(f => f.name === bid.bidderName), `bidder name ${bid.bidderName} must come from the pe-rivals roster`);
  }
  const maxBid = deal.competingBids.reduce((max, b) => b.price > max.price ? b : max, deal.competingBids[0]);
  assert.equal(deal.competingBid.bidderID, maxBid.bidderID, 'deal.competingBid must be the highest-priced participating firm');
  assert.equal(deal.competingBid.price, maxBid.price);
}

// 2. Determinism: rebuilding the identical scenario reproduces the identical set of bids at
// the identical week (no Math.random(), same hash-driven roster judgement as T1).
{
  const e1 = make(multiRivalTarget());
  assert.equal(e1.openMADealRoom('t-a'), true);
  const week1 = advanceUntilCompetitor(e1, e1.g.maDealRooms[0]);
  const bids1 = e1.g.maDealRooms[0].competingBids.map(b => [b.bidderID, b.price]);

  const e2 = make(multiRivalTarget());
  assert.equal(e2.openMADealRoom('t-a'), true);
  const week2 = advanceUntilCompetitor(e2, e2.g.maDealRooms[0]);
  const bids2 = e2.g.maDealRooms[0].competingBids.map(b => [b.bidderID, b.price]);

  assert.equal(week2, week1, 'the competitor-arrival week must be reproducible');
  assert.deepEqual(bids2, bids1, 'the same bidders at the same prices must be reproducible');
}

// 3. Old-save compatibility: a deal that already carries only the legacy singular
// competingBid (no competingBids key at all, as any save written before this task) must
// resolve to the exact same deal.status outcome as before -- mirrors the deadline/competitor
// scenario in tests/ma-deal-room-test.js.
{
  const e = make(target());
  assert.equal(e.openMADealRoom('t-a'), true);
  const deal = e.g.maDealRooms[0];
  assert.equal(e.advanceMADealRound(deal.id), true); // PE mode T3: screening -> indication
  assert.equal(e.startMADueDiligence(deal.id, 'financial'), true);
  tick(e, 2);
  assert.equal(deal.status, 'ready');
  deal.competingBid = { bidderID: 'bid-high', bidderName: '業界最大手', method: 'friendly', price: 250_000_000, submittedWeek: e.g.week, expiresWeek: deal.deadlineWeek + 1, status: 'active' };
  delete deal.competingBids;

  // Round-trip through JSON the way a real save/load would, so this exercises the actual
  // migration path (mergeDefaults + ma-deal-room.js's ensure()) rather than the live object.
  const raw = JSON.parse(JSON.stringify(e.g));
  assert.equal(Object.prototype.hasOwnProperty.call(raw.maDealRooms[0], 'competingBids'), false, 'sanity: fixture really has no competingBids key, like a pre-T2 save');
  raw.saveVersion = 9;
  const loaded = new TycoonEngine(raw);
  const loadedDeal = loaded.g.maDealRooms[0];
  assert.deepEqual(loadedDeal.competingBids, [loadedDeal.competingBid], 'the lone legacy competingBid must be folded into competingBids on load, unduplicated');

  loaded.g.week = loadedDeal.deadlineWeek;
  dr.processDealWeek(loaded.g, loaded.g.week);
  assert.equal(loadedDeal.status, 'lost', 'active competitor at deal deadline must still mark the deal lost, exactly as before this task');
  assert.equal(loaded.g.acquisitionTargets[0].activeDealID, null);
}

// 4. Status transitions on deal.competingBid (defeated/expired) stay reflected in the
// matching competingBids entry, so a save/reload cannot leave the array showing a stale
// status for the bidder actually being raced.
{
  const e = make(target());
  assert.equal(e.openMADealRoom('t-a'), true);
  const deal = e.g.maDealRooms[0];
  assert.equal(e.advanceMADealRound(deal.id), true); // PE mode T3: screening -> indication
  assert.equal(e.startMADueDiligence(deal.id, 'financial'), true);
  tick(e, 2);
  deal.competingBid = { bidderID: 'bid-expire', bidderName: 'テスト用競合', method: 'friendly', price: 10_000_000, submittedWeek: e.g.week, expiresWeek: e.g.week + 1, status: 'active' };
  deal.competingBids = [deal.competingBid];
  tick(e, 3);
  assert.equal(deal.competingBid.status, 'expired', 'sanity: the singular pointer must expire as before');
  const synced = deal.competingBids.find(b => b.bidderID === 'bid-expire');
  assert.ok(synced, 'the expired bidder must still be present in competingBids');
  assert.equal(synced.status, 'expired', 'competingBids entry must reflect the same status as deal.competingBid after it changes');
}

console.log('ma deal room competing bids tests passed');
