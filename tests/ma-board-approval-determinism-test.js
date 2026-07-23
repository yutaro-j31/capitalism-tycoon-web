const assert = require('node:assert/strict');
const { loadGame } = require('./harness');
const { modules } = loadGame();
const { engine, finance } = modules;
const ba = modules.maBoardApproval;

function state(method = 'friendly') {
  const g = engine.createInitialState({ configured: true });
  g.week = 24;
  g.companyCash = 200000000;
  g.publicCompany = true;
  g.stockPrice = 1000;
  g.sharesOut = 1000000;
  g.reports = [{ expenses: 5000000 }];
  g.finance = finance.defaultFinanceState(g);
  g.acquisitionTargets = [{ id: 't1', name: '承認テック', valuation: 68400000, sales: 100000000, operatingProfit: 12000000, risk: 0.1, synergy: 0.1 }];
  g.maDealRooms = [{ id: 'd1', targetID: 't1', status: 'accepted', diligenceLevel: 'full', diligenceConfidence: 0.94, acceptedTerms: { method, finalPrice: 90000000, acceptedWeek: 23, closingDeadlineWeek: 28, offerRound: 1 }, history: [] }];
  return g;
}

let g = state();
let d = g.maDealRooms[0];
const before = JSON.stringify(g);
const m1 = ba.buildMemo(g, d, { companyValue: 450000000 });
const m2 = ba.buildMemo(g, d, { companyValue: 450000000 });
assert.deepEqual(m1, m2);
assert.equal(JSON.stringify(g), before);
assert.equal(m1.companyCashAfter, 110000000);
assert.equal(m1.minimumCashBuffer, 20000000);
assert.equal(m1.expectedGoodwill, 21600000);
assert.equal(m1.identifiableNetAssets, 68400000);
assert.equal(m1.decision, 'approve');
assert.equal(m1.canApprove, true);
assert.ok(Object.isFrozen(m1.blockers));

g = state('hostile');
assert.equal(ba.buildMemo(g, g.maDealRooms[0]).companyCashAfter, 110000000);

g = state('shareSwap');
d = g.maDealRooms[0];
let ms = ba.buildMemo(g, d, { companyValue: 450000000 });
assert.equal(ms.projectedNewShares, 90000);
assert.equal(ms.projectedSharesAfter, 1090000);
assert.equal(ms.companyCashAfter, 200000000);
assert.equal(ms.expectedDilution, 90000 / 1090000);
g.publicCompany = false;
assert.equal(ba.buildMemo(g, d).decision, 'blocked');

g = state();
g.companyCash = 1000;
assert.ok(ba.buildMemo(g, g.maDealRooms[0]).blockers.some(x => x.id === 'cash-shortfall'));

g = state();
g.week = 29;
assert.ok(ba.buildMemo(g, g.maDealRooms[0]).blockers.some(x => x.id === 'deadline-expired'));

g = state();
g.maDealRooms[0].diligenceConfidence = 0.39;
assert.ok(ba.buildMemo(g, g.maDealRooms[0]).blockers.some(x => x.id === 'dd-low'));

g = state();
g.maSubsidiaries = [{ id: 's1', status: 'active', pmiStatus: 'stalled', pmiHealth: 20 }, { id: 's2', status: 'active', pmiStatus: 'stalled', pmiHealth: 20 }];
assert.ok(ba.buildMemo(g, g.maDealRooms[0]).blockers.some(x => x.id === 'critical-pmi'));

g = state();
g.companyCash = 100000000;
assert.ok(ba.buildMemo(g, g.maDealRooms[0]).warnings.some(x => x.id === 'cash-buffer'));

g = state();
g.week = 27;
assert.ok(ba.buildMemo(g, g.maDealRooms[0]).warnings.some(x => x.id === 'deadline-near'));

g = state();
g.finance.loans = [{ id: 'l1', status: 'active', scheduledPrincipalPayment: 8000000 }];
assert.equal(ba.buildMemo(g, g.maDealRooms[0]).minimumCashBuffer, 32000000, 'finance.loans scheduled principal must increase cash buffer');

g = state();
g.finance.loans = [
  { id: 'l1', status: 'repaid', scheduledPrincipalPayment: 8000000 },
  { id: 'l2', status: 'inactive', weeklyPayment: 6000000 }
];
assert.equal(ba.buildMemo(g, g.maDealRooms[0]).minimumCashBuffer, 20000000, 'inactive/repaid loans must be excluded');

g = state();
delete g.loans;
g.finance.loans = [{ id: 'l1', status: 'active', weeklyPrincipalPayment: 7000000, weeklyPayment: 9000000 }];
assert.equal(ba.buildMemo(g, g.maDealRooms[0]).minimumCashBuffer, 28000000, 'one loan must use one preferred payment field without duplicate addition');

console.log('ma board approval model ok');
