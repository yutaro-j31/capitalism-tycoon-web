'use strict';

// #802: the brokerage pipeline's rolls must behave like independent draws. Its FNV-1a hash left
// the top bits almost unchanged when only the week or inquiry index at the end of the key changed,
// so a deal got nearly the same close roll every week and a store's inquiries in one week all
// became mandates or none did. Every game also used seed 1, so all games saw the same deals.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const pipeline = loadGame({ headless: true }).modules.realEstateAgencyPipeline;
const BUSINESS = { id: 'realEstateAgency', quality: 50, brand: 30, dx: 0, efficiency: 0 };
const STORES = 80;

function game(seed) {
  return { week: 1, realEstateCycle: 1, simulationRng: { seed, state: seed, draws: 0, nextID: 1, version: 1 } };
}
function stores(prefix, withDeals) {
  return Array.from({ length: STORES }, (_, s) => ({
    id: `${prefix}-store-${s}`, businessID: 'realEstateAgency', status: 'open',
    brokeragePipeline: {
      activeDeals: withDeals ? Array.from({ length: 8 }, (_, d) => ({ id: `deal-${s}-${d}`, createdWeek: 1, askingValue: 30_000_000, side: 'single', segment: 'residential' })) : []
    }
  }));
}
const NO_TRAFFIC = { traffic: 0 };

// 1. A deal that does not close in its first week can still close later.
{
  const g = game(0x8020001), shops = stores('close', true), open = new Set(shops.flatMap(s => s.brokeragePipeline.activeDeals.map(d => d.id)));
  const total = open.size, closedByWeek = [];
  for (let week = 2; week <= 8; week++) {
    g.week = week;
    let closed = 0;
    for (const store of shops) {
      pipeline.processStore(g, store, BUSINESS, NO_TRAFFIC, 1);
      const still = new Set(store.brokeragePipeline.activeDeals.map(d => d.id));
      for (const id of [...open]) if (id.startsWith(`deal-${store.id.split('-').at(-1)}-`) && !still.has(id)) { open.delete(id); closed++; }
    }
    closedByWeek.push(closed);
  }
  const first = closedByWeek[0], later = closedByWeek.slice(1).reduce((a, b) => a + b, 0);
  const p = first / total, expectedLater = (total - first) * (1 - Math.pow(1 - p, 6));
  assert.ok(first > 0, 'precondition: some deals close in their first week');
  assert.ok(later >= expectedLater * .6, `deals left after week 2 keep closing: ${later} closed in weeks 3-8, independent weekly rolls give about ${Math.round(expectedLater)} (by week ${closedByWeek.join(',')})`);
}

// 2. A store's inquiries in one week become mandates independently of each other.
{
  const g = game(0x8020002), shops = stores('mandate', false), pref = { traffic: 1.4 };
  let weeksWithSeveral = 0, allOrNone = 0;
  for (let week = 2; week <= 6; week++) {
    g.week = week;
    for (const store of shops) {
      store.brokeragePipeline.activeDeals = [];
      pipeline.processStore(g, store, BUSINESS, pref, 1);
      const row = store.brokeragePipeline.lastWeek;
      const considered = row.inquiries - row.capacityLostInquiries;
      if (considered < 4) continue;
      weeksWithSeveral++;
      if (row.newMandates === 0 || row.newMandates === considered) allOrNone++;
    }
  }
  assert.ok(weeksWithSeveral >= 100, `precondition: enough store-weeks with 4+ inquiries (${weeksWithSeveral})`);
  assert.ok(allOrNone / weeksWithSeveral < .2, `all-or-none mandate weeks: ${allOrNone} of ${weeksWithSeveral}`);
}

// 3. Different games see different deals; the same game seed gives the same deals.
{
  const run = seed => {
    const g = game(seed), shops = stores('seed', true);
    g.week = 2;
    for (const store of shops) pipeline.processStore(g, store, BUSINESS, NO_TRAFFIC, 1);
    return shops.map(s => s.brokeragePipeline.activeDeals.map(d => d.id).join(',')).join('|');
  };
  assert.equal(run(11), run(11), 'the same game seed gives the same outcome');
  assert.notEqual(run(11), run(22), 'two games with different seeds see different deals');
}

console.log('real estate agency pipeline draws tests passed');
