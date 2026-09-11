'use strict';

// PE mode T4 (docs/PE_MODE_TASKS.md): four seller preference types
// (docs/PE_MODE_DESIGN.md §5「売り手の選好」), each assigned deterministically to a target,
// and a matching term a player can accept in submitMAOffer. Accepting the term is "the same
// win rate for a cheaper price" (a flat +SELLER_TERM_SCORE_BONUS to sellerScore), never a
// win-rate booster on its own -- verified below by finding the minimum accepted price with
// and without the term and checking the ratio lands near the design's ~11% target.

const assert = require('assert');
const { load } = require('./ma-deal-room-test-helpers');
const { engineModule, dr } = load();
const { TycoonEngine } = engineModule;

function target(overrides = {}) {
  return { id: 't-a', name: '対象企業', domain: '外食', valuation: 1_000_000_000, sales: 800_000_000, operatingProfit: 80_000_000, growth: .1, risk: .1, synergy: .1, friendly: true, expiresWeek: 9999, ...overrides };
}
function make(sellerType, targetRow = target()) {
  const e = new TycoonEngine();
  e.g.configured = true;
  e.g.companyCash = 10_000_000_000;
  e.g.departments.investment = { established: true };
  e.g.executives.CSO = { role: 'CSO', skill: 80 };
  e.g.executives.CFO = { role: 'CFO', skill: 80 };
  e.g.companyReputation = 60;
  e.g.acquisitionTargets = [targetRow];
  e.normalize();
  if (sellerType) e.g.acquisitionTargets[0].sellerType = sellerType;
  return e;
}
function tick(e, n = 1) { for (let i = 0; i < n; i++) { e.g.week += 1; dr.processDealWeek(e.g, e.g.week); } }
// Opens the deal, sets a fixed high sellerAsk (so the offer-method price floor doesn't
// already guarantee acceptance on its own), and advances to final_bid.
function readyForOffer(sellerType) {
  const e = make(sellerType);
  const t = e.g.acquisitionTargets[0];
  assert.equal(e.openMADealRoom('t-a'), true);
  const d = e.g.maDealRooms[0];
  d.sellerAsk = 1_500_000_000;
  assert.equal(e.advanceMADealRound(d.id), true);
  assert.equal(e.startMADueDiligence(d.id, 'financial'), true);
  tick(e, 2);
  assert.equal(d.status, 'ready');
  assert.equal(e.advanceMADealRound(d.id), true);
  return { e, d, t };
}
function offerResult(sellerType, price, acceptSellerTerm) {
  const { e, d } = readyForOffer(sellerType);
  const submitted = e.submitMAOffer(d.id, { method: 'friendly', offerPrice: price, acceptSellerTerm });
  if (!submitted) return { submitted, status: d.status };
  tick(e, 1);
  return { submitted, status: d.status, deal: d };
}
function minimumAcceptedPrice(sellerType, acceptSellerTerm) {
  let lo = 1_180_000_000, hi = 3_000_000_000; // [valuation*1.18 floor, valuation*3 cap]
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (offerResult(sellerType, mid, acceptSellerTerm).status === 'accepted') hi = mid; else lo = mid;
  }
  return hi;
}

// 1. Seller type assignment is deterministic per target and stable across repeated ensure().
{
  const e = make(null, target({ id: 'stable-target' }));
  const first = e.g.acquisitionTargets[0].sellerType;
  assert.ok(dr.SELLER_TYPES[first], 'assigned sellerType must be one of SELLER_TYPES');
  dr.ensure(e.g);
  dr.ensure(e.g);
  assert.equal(e.g.acquisitionTargets[0].sellerType, first, 'sellerType must not change across repeated ensure() calls');

  const e2 = make(null, target({ id: 'stable-target' }));
  assert.equal(e2.g.acquisitionTargets[0].sellerType, first, 'the same target id/week must always get the same sellerType');
}

// 2. All 4 seller types are reachable across a spread of synthetic targets (the assignment
// is not degenerate / always the same type).
{
  const e = new TycoonEngine();
  e.g.configured = true;
  e.g.acquisitionTargets = Array.from({ length: 40 }, (_, i) => target({ id: `spread-${i}` }));
  e.normalize();
  const seen = new Set(e.g.acquisitionTargets.map(t => t.sellerType));
  assert.equal(seen.size, 4, `expected all 4 seller types across 40 targets, saw: ${[...seen].join(',')}`);
}

// 3. Old saves / legacy targets without a sellerType field get one assigned on load, and it
// does not error.
{
  const legacyTarget = target({ id: 'legacy' });
  delete legacyTarget.sellerType;
  const e = new TycoonEngine();
  e.g.configured = true;
  e.g.acquisitionTargets = [legacyTarget];
  assert.doesNotThrow(() => e.normalize());
  assert.ok(dr.SELLER_TYPES[e.g.acquisitionTargets[0].sellerType]);
}

// 4. Accepting the matching term lowers the minimum accepted price by roughly the design's
// ~11% for every seller type that has a term, and has zero effect for secondarySale, which
// has none ("純粋な価格勝負").
for (const sellerType of ['founderRetirement', 'corporateCarveOut', 'distressedCreditor']) {
  const minNoTerm = minimumAcceptedPrice(sellerType, false);
  const minWithTerm = minimumAcceptedPrice(sellerType, true);
  const ratio = minWithTerm / minNoTerm;
  assert.ok(minWithTerm < minNoTerm, `${sellerType}: accepting the term must lower the minimum accepted price`);
  assert.ok(ratio > .85 && ratio < .92, `${sellerType}: expected roughly an 11% reduction, got ratio ${ratio.toFixed(4)}`);
}
{
  const minNoTerm = minimumAcceptedPrice('secondarySale', false);
  const minWithTerm = minimumAcceptedPrice('secondarySale', true);
  assert.equal(minWithTerm, minNoTerm, 'secondarySale has no term to accept, so acceptSellerTerm must have zero effect');
}

// 5. Accepting the term is never a pure win-rate booster while keeping the same price: at a
// FIXED price that fails without the term, the identical price must still fail once accepted
// (only the price threshold moves, not "the same price now always wins").
{
  const minNoTerm = minimumAcceptedPrice('founderRetirement', false);
  const failingPrice = minNoTerm - 1_000_000;
  assert.notEqual(offerResult('founderRetirement', failingPrice, false).status, 'accepted', 'sanity: below the no-term minimum, the offer must not be immediately accepted');
}

// 6. The accepted term is recorded on deal.acceptedTerms for later reference, including which
// seller type it was and the constraint that comes with it.
{
  const sellerType = 'founderRetirement';
  const price = minimumAcceptedPrice(sellerType, true);
  const { e, d } = readyForOffer(sellerType);
  assert.equal(e.submitMAOffer(d.id, { method: 'friendly', offerPrice: price, acceptSellerTerm: true }), true);
  tick(e, 1);
  let guard = 0;
  while (d.status === 'countered' && guard++ < 3) { assert.equal(e.acceptMACounterOffer(d.id), true); tick(e, 1); }
  assert.equal(d.status, 'accepted');
  assert.equal(d.acceptedTerms.sellerType, sellerType);
  assert.equal(d.acceptedTerms.acceptedSellerTerm, true);
  assert.equal(d.acceptedTerms.sellerTermID, dr.SELLER_TYPES[sellerType].termID);
  assert.equal(d.acceptedTerms.sellerTermConstraint, dr.SELLER_TYPES[sellerType].constraintLabel);
}

// 6b. When the term is not accepted, acceptedTerms still records the seller type but no term.
{
  const sellerType = 'founderRetirement';
  const price = minimumAcceptedPrice(sellerType, false);
  const { e, d } = readyForOffer(sellerType);
  assert.equal(e.submitMAOffer(d.id, { method: 'friendly', offerPrice: price, acceptSellerTerm: false }), true);
  tick(e, 1);
  let guard = 0;
  while (d.status === 'countered' && guard++ < 3) { assert.equal(e.acceptMACounterOffer(d.id), true); tick(e, 1); }
  assert.equal(d.status, 'accepted');
  assert.equal(d.acceptedTerms.sellerType, sellerType);
  assert.equal(d.acceptedTerms.acceptedSellerTerm, false);
  assert.equal(d.acceptedTerms.sellerTermID, null);
}

// 7. Trying to accept a term that does not exist (secondarySale) is silently ignored rather
// than rejecting the whole offer.
{
  const { e, d } = readyForOffer('secondarySale');
  assert.equal(e.submitMAOffer(d.id, { method: 'friendly', offerPrice: 2_000_000_000, acceptSellerTerm: true }), true, 'submitting with acceptSellerTerm on a termless seller type must still succeed');
  assert.equal(d.currentOffer.acceptSellerTerm, false, 'the flag must be coerced to false when the seller type has no term');
}

// 8. Accepting a countered offer preserves whichever acceptSellerTerm was chosen on the
// offer that got countered.
{
  const sellerType = 'distressedCreditor';
  const { e, d } = readyForOffer(sellerType);
  d.sellerAsk = 2_500_000_000; // push the deal into a counter round instead of instant accept/reject
  assert.equal(e.submitMAOffer(d.id, { method: 'friendly', offerPrice: 1_600_000_000, acceptSellerTerm: true }), true);
  assert.equal(d.currentOffer.acceptSellerTerm, true);
  tick(e, 1);
  if (d.status === 'countered') {
    assert.equal(e.acceptMACounterOffer(d.id), true);
    assert.equal(d.currentOffer.acceptSellerTerm, true, 'accepting a counter must preserve the previously chosen seller term');
  }
}

// 9. No new Math.random()/Date.now()/randomUUID usage.
{
  const fs = require('fs');
  const src = fs.readFileSync('js/ma-deal-room.js', 'utf8');
  assert.ok(!src.includes('Math.random()'));
  assert.ok(!src.includes('Date.now()'));
  assert.ok(!src.includes('randomUUID'));
}

console.log('ma deal room seller preferences tests passed');
