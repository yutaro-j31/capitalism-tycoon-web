'use strict';
// DIAGNOSTIC ONLY. Do not add to canonical CI or merge this RED probe.
// Tests the fully installed PE target close path, not the ordinary company M&A path.
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function makeRandom(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
const loaded = loadGame({ random: makeRandom(7), isolatedLegacyIndex: true, headless: true });
const { engineModule, modules, ctx } = loaded;
const pf = modules.peFund, ds = modules.peDealSupply;
const e = new engineModule.TycoonEngine();
e.configure({ playerName: 'PE Fault Audit', companyName: 'PE Audit Holdings', difficulty: 'normal' });
e.g.departments.investment = { established: true };
e.g.departmentStaff.investment = 9;
e.g.executives.CSO = { role: 'CSO', skill: 80 };
e.g.executives.CFO = { role: 'CFO', skill: 80 };
e.g.companyCash = 50_000_000_000;
pf.recordExit(e.g, {
  exitType: 'buyout', realizedAmount: 200_000_000, investedAmount: 8_000_000,
  foundedWeek: 1, exitedWeek: 52, profitableWeekStreak: 260, employeeCount: 30
});
e.g.personalCash = 30_000_000_000;
const size = pf.formableFundSize(e.g);
const fund = pf.createFund(e.g, {
  size, gpCommit: size * pf.requiredGPRatio(e.g.peFirm.trackRecord.score),
  terms: pf.fundTermsForScore(e.g.peFirm.trackRecord.score), y0: e.g.week
});
assert.ok(fund, 'precondition: fund created');

let target = null;
for (let i = 0; i < 80 && !target; i++) {
  e.advanceWeek(false);
  target = e.g.acquisitionTargets.filter(ds.isPETarget).find(t => {
    const quote = e.calculateMAAcquisitionPrice(t, 'friendly');
    const price = Math.ceil(quote.minimumPrice * 1.02);
    return pf.planDealFinancing(fund, price, false).rejectedAmount === 0;
  }) || null;
}
assert.ok(target, 'precondition: a suitable PE target was supplied');
assert.equal(e.openMADealRoom(target.id), true);
const deal = e.g.maDealRooms.find(x => x.targetID === target.id);
assert.equal(e.startMADueDiligence(deal.id, 'screening', fund.id), true);
for (let i = 0; i < 6 && deal.status === 'diligence'; i++) e.advanceWeek(false);
assert.equal(deal.status, 'ready');
const price = Math.ceil(e.calculateMAAcquisitionPrice(target, 'friendly').minimumPrice * 1.02);
assert.equal(e.submitMAOffer(deal.id, { method: 'friendly', offerPrice: price }), true);
for (let i = 0; i < 4 && deal.status === 'offer_pending'; i++) e.advanceWeek(false);
assert.equal(deal.status, 'accepted', 'precondition: closeable PE deal');
assert.equal(e.save(), true, 'precondition: persistence baseline');
const before = JSON.stringify(e.g), key = engineModule.SAVE_KEY;
const mirrorBefore = ctx.__localStorageData.get(key);
assert.ok(mirrorBefore, 'precondition: committed mirror');
const previous = JSON.parse(before);
const originalSave = e.save;
let hits = 0, result, error;
e.save = () => { hits++; return false; };
try { result = e.closeMADeal(deal.id); }
catch (caught) { error = caught; }
finally { e.save = originalSave; }
const after = JSON.stringify(e.g);
const current = JSON.parse(after);
const existingFund = previous.peFirm.funds.find(x => x.id === fund.id);
const currentFund = current.peFirm.funds.find(x => x.id === fund.id);
const mirrorAfter = ctx.__localStorageData.get(key);
const evidence = {
  saveHits: hits, returned: result, error: error?.stack || null,
  fundCashDelta: currentFund.cash - existingFund.cash,
  fundDealCount: [existingFund.deals.length, currentFund.deals.length],
  coinvestCommitted: [existingFund.coinvestCommitted, currentFund.coinvestCommitted],
  companyCashDelta: current.companyCash - previous.companyCash,
  personalCashDelta: current.personalCash - previous.personalCash,
  targetCount: [previous.acquisitionTargets.length, current.acquisitionTargets.length],
  dealStatus: [
    previous.maDealRooms.find(d => d.id === deal.id)?.status,
    current.maDealRooms.find(d => d.id === deal.id)?.status
  ],
  liveUnchanged: after === before,
  mirrorUnchanged: mirrorAfter === mirrorBefore
};
console.log('PE fund acquisition save-rejection diagnostic:', JSON.stringify(evidence));
assert.ok(hits > 0, 'fault injection must reach installed PE close save');
assert.equal(error, undefined, 'save-false must not surface as successful transaction');
assert.equal(result, false, 'save rejection must not report a completed PE acquisition');
assert.equal(after, before, 'PE acquisition rejected save must restore all economic state');
assert.equal(mirrorAfter, mirrorBefore, 'rejected save must preserve prior mirror');
console.log('PE fund acquisition save-rejection atomicity PASS');
