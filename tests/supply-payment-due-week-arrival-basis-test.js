'use strict';
// Unit test for the isImmediatePaymentOrder()/paymentDueWeek fix (Founding Route Rebalance
// Final, PR E). Root cause (documented in founding-route-verification-log.md Entry 20-25):
// createOrder() used to set paymentDueWeek relative to the *order* week
// (paymentDueWeek = g.week + terms), so any supplier whose leadTimeWeeks >= paymentTermsWeeks
// had its nominal payment terms silently defeated -- the bill fell due at or before delivery,
// making isImmediatePaymentOrder() treat the order as cash-on-delivery regardless of the
// advertised terms. The fix anchors paymentDueWeek on the *arrival* week instead
// (paymentDueWeek = g.week + leadTimeWeeks + terms), so the real payment float after delivery
// always equals the supplier's advertised paymentTermsWeeks.
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function state() {
  const { modules } = loadGame();
  const g = modules.engine.createInitialState({ configured: true });
  g.stores.push({ id: 's1', businessID: 'ramen', prefID: 'tokyo', name: 'S', status: 'open', operatingHours: 3, condition: 100 });
  modules.supply.ensureStore(g, g.stores[0]);
  modules.finance.ensureFinance(g);
  return { g, modules };
}

// 1. For every supplier, a freshly created order's real payment float after arrival
//    (paymentDueWeek - expectedArrivalWeek) must equal its advertised paymentTermsWeeks exactly.
{
  const { g, modules } = state();
  g.week = 100;
  for (const s of modules.supply.SUPPLIERS) {
    const materialID = s.supportedMaterialIDs[0];
    const po = modules.supply.createOrder(g, 's1', materialID, 60, { supplierID: s.id });
    assert(po, `createOrder should succeed for supplier ${s.id}`);
    assert.equal(po.expectedArrivalWeek, g.week + s.leadTimeWeeks, `${s.id}: expectedArrivalWeek must be orderWeek+leadTimeWeeks`);
    assert.equal(po.paymentDueWeek, po.expectedArrivalWeek + s.paymentTermsWeeks, `${s.id}: paymentDueWeek must be arrival week + paymentTermsWeeks, not order week + paymentTermsWeeks`);
    assert.equal(po.paymentDueWeek - po.expectedArrivalWeek, s.paymentTermsWeeks, `${s.id}: real payment float after arrival must equal the advertised paymentTermsWeeks`);
  }
  console.log('1. paymentDueWeek is anchored on the arrival week for every supplier: pass');
}

// 2. isImmediatePaymentOrder() is private, so its effect is observed through
//    immediatePaymentCommitments()/availableProcurementCash(): an order only ties up
//    "immediate payment" cash headroom when it is genuinely due at or before delivery
//    (paymentTermsWeeks===0), never merely because leadTimeWeeks happens to be >= paymentTermsWeeks.
{
  const { g, modules } = state();
  g.week = 100;
  const commitmentsFor = (supplierID, materialID) => {
    const before = modules.supply.immediatePaymentCommitments(g);
    const po = modules.supply.createOrder(g, 's1', materialID, 60, { supplierID });
    assert(po, `createOrder should succeed for supplier ${supplierID}`);
    const after = modules.supply.immediatePaymentCommitments(g);
    return after - before;
  };

  // balanced_wholesale: leadTimeWeeks=2, paymentTermsWeeks=3 -> real float 3 weeks -> NOT immediate,
  // so it must not consume any "immediate payment" cash headroom.
  assert.equal(commitmentsFor('balanced_wholesale', 'ramen_noodles'), 0, 'balanced_wholesale (lead2/terms3) must not be treated as immediate-payment after the fix');

  // low_cost: leadTimeWeeks=2, paymentTermsWeeks=2 -> real float 2 weeks -> NOT immediate
  // (pre-fix this used to collapse to 0 real float and be treated as immediate).
  assert.equal(commitmentsFor('low_cost', 'ramen_noodles'), 0, 'low_cost (lead2/terms2) must not be treated as immediate-payment after the fix');

  // quick_local: paymentTermsWeeks=0 by design (cash on order) -> still correctly immediate,
  // so it must consume immediate-payment cash headroom equal to its order total.
  const quickLocalDelta = commitmentsFor('quick_local', 'ramen_noodles');
  assert(quickLocalDelta > 0, 'quick_local (terms=0 by design) must remain immediate-payment');

  console.log('2. immediate-payment cash headroom reflects real payment float, not an accidental lead/terms collision: pass');
}

// 3. Regression guard on the fixed default: balanced_wholesale's paymentTermsWeeks must be 3.
{
  const { modules } = loadGame();
  const s = modules.supply.SUPPLIERS.find(x => x.id === 'balanced_wholesale');
  assert.equal(s.paymentTermsWeeks, 3, 'balanced_wholesale.paymentTermsWeeks must be 3 (raised from 2 alongside the paymentDueWeek fix)');
  console.log('3. balanced_wholesale paymentTermsWeeks=3: pass');
}

console.log('supply payment due week arrival basis ok');
