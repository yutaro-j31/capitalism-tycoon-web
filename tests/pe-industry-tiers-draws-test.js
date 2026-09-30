'use strict';

// #812: the annual PE deals' draws. hash() barely moved its top bits when only the index at the end
// of the key changed, so all four deals of a year sat at almost the same point in their size bands
// (adjacent correlation 0.92), and without a game seed every game got the same deals. Owner
// decision: keep one deal per tier in every block of four indices, and draw only the order.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const tiers = loadGame({ headless: true }).modules.peIndustryTiers;
const N = tiers.TIER_IDS.length;
const game = seed => ({ economy: 1, simulationRng: { seed, state: seed, draws: 0, nextID: 1, version: 1 } });
const position = deal => { const t = tiers.TIERS[deal.tierID]; return (Math.log(deal.enterpriseValue) - Math.log(t.sizeMin)) / (Math.log(t.sizeMax) - Math.log(t.sizeMin)); };

// 1. Every year (and every block of four indices, as used by referrals) has one deal per tier.
for (const seed of [0x812401, 0x812402]) {
  for (let year = 0; year < 200; year++) {
    const deals = tiers.generateAnnualDeals(game(seed), year);
    assert.equal(deals.length, tiers.DEALS_PER_YEAR);
    assert.deepEqual([...deals].map(d => d.tierID).sort(), [...tiers.TIER_IDS].sort(), `year ${year}: one deal per tier`);
  }
  for (const base of [1000, 2004, 30008]) {
    const block = Array.from({ length: N }, (_, i) => tiers.generateDeal(3, base + i, seed).tierID);
    assert.deepEqual([...block].sort(), [...tiers.TIER_IDS].sort(), `indices ${base}..${base + N - 1}: one deal per tier`);
  }
}

// 2. A year's deals are spread across their size bands (independent draws: mean spread about .6).
{
  let spread = 0, sum = 0, n = 0;
  for (let year = 0; year < 200; year++) {
    const p = tiers.generateAnnualDeals(game(0x812401), year).map(position);
    spread += Math.max(...p) - Math.min(...p);
    for (const x of p) { assert.ok(x >= 0 && x <= 1); sum += x; n++; }
  }
  assert.ok(spread / 200 > .4, `mean within-year spread of deal size in band: ${(spread / 200).toFixed(3)}`);
  assert.ok(Math.abs(sum / n - .5) < .05, `mean position in band: ${(sum / n).toFixed(3)}`);
}

// 3. The tier order changes from year to year.
{
  const orders = new Set();
  for (let year = 0; year < 200; year++) orders.add(tiers.generateAnnualDeals(game(0x812401), year).map(d => d.tierID).join(','));
  assert.ok(orders.size >= 20, `distinct tier orders over 200 years: ${orders.size} (of ${[1, 2, 3, 4].reduce((a, b) => a * b)})`);
}

// 4. Each game has its own deals; the same game seed gives the same deals.
{
  const key = seed => JSON.stringify(Array.from({ length: 20 }, (_, y) => tiers.generateAnnualDeals(game(seed), y).map(d => [d.tierID, d.enterpriseValue, d.businessID])));
  assert.equal(key(0x812401), key(0x812401), 'the same game seed gives the same deals');
  assert.notEqual(key(0x812401), key(0x812402), 'another game seed gives other deals');
  assert.equal(tiers.gameSeed(game(0x812401)), 0x812401);
}

console.log('PE industry tiers draws tests passed');
