'use strict';
// Negative/mutation counterpart to tests/ramen-supply-payment-terms-244week-regression-test.js
// (Founding Route Rebalance Final, PR E). Proves the regression test actually detects the bug it
// claims to guard against: this test reverts BOTH parts of the fix in an in-memory copy of
// js/supply.js -- the real file on disk is never touched -- and confirms that, under the fully
// reverted pre-PR-E code, at least one of the previously measured seeds (デルタ商会) still
// defaults within 244 weeks. If this test ever starts passing (i.e. the reverted code no longer
// reproduces the default), the positive regression test next to it has silently stopped being a
// meaningful guard and both need to be re-examined.
//
// Uses a 244-week horizon, not the repo's usual 208-week regression convention: デルタ商会's
// measured pre-fix default happens at week239 (founding-route-verification-log.md Entry 20-21),
// past week208, so a 208-week run cannot reproduce it even under the fully reverted code (see
// the 244-week regression test's header comment for the same correction).
//
// Both parts must be reverted together to reproduce the original failure: reverting only the
// paymentDueWeek formula (back to the order-week-anchored g.week+terms) while leaving
// balanced_wholesale's paymentTermsWeeks at the fixed value of 3 does NOT reproduce a default --
// order+3 already exceeds the arrival week (order+leadTimeWeeks=order+2) by 1 week even under the
// buggy formula, which is enough real post-arrival float to avoid the original death spiral (this
// was confirmed by running the test with only the formula reverted: デルタ商会 survived to
// week209 with finalCash=1653459). The genuine pre-fix condition measured in
// founding-route-verification-log.md Entry 20-21 combined the order-week-anchored formula WITH
// paymentTermsWeeks=2, which is what this test reverts to.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGameFromHtml, readIndex } = require('./harness');

const ROOT = path.join(__dirname, '..');
const SUPPLY_SOURCE = fs.readFileSync(path.join(ROOT, 'js', 'supply.js'), 'utf8');
const SUPPLY_TAG = '<script src="./js/supply.js"></script>';
const FIXED_DUE_WEEK = 'paymentDueWeek:n(g.week)+lead+terms,paymentTermsWeeks:terms,';
const PRE_FIX_BUGGY_DUE_WEEK = 'paymentDueWeek:n(g.week)+terms,paymentTermsWeeks:terms,';
const FIXED_TERMS = "leadTimeWeeks:2,reliability:.93,minimumOrderQuantity:50,maximumWeeklySupply:7000,paymentTermsWeeks:3,contractFee:9000";
const PRE_FIX_BUGGY_TERMS = "leadTimeWeeks:2,reliability:.93,minimumOrderQuantity:50,maximumWeeklySupply:7000,paymentTermsWeeks:2,contractFee:9000";

assert(SUPPLY_SOURCE.includes(FIXED_DUE_WEEK), 'expected the fixed paymentDueWeek formula in js/supply.js; has it been reverted or refactored?');
assert.equal(SUPPLY_SOURCE.split(FIXED_DUE_WEEK).length - 1, 1, 'expected exactly one occurrence of the fixed paymentDueWeek formula');
assert(SUPPLY_SOURCE.includes(FIXED_TERMS), 'expected balanced_wholesale paymentTermsWeeks=3 in js/supply.js; has it been reverted or refactored?');
assert.equal(SUPPLY_SOURCE.split(FIXED_TERMS).length - 1, 1, 'expected exactly one occurrence of the fixed balanced_wholesale terms');

const revertedSource = SUPPLY_SOURCE
  .replace(FIXED_DUE_WEEK, PRE_FIX_BUGGY_DUE_WEEK)
  .replace(FIXED_TERMS, PRE_FIX_BUGGY_TERMS);
const html = readIndex().replace(SUPPLY_TAG, `<script>${revertedSource}</script>`);

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
}

function tryOpen(engine) {
  const tenant = engine.g.tenants.filter(t => !t.occupiedBy).sort((a, b) => b.traffic - a.traffic || a.id.localeCompare(b.id))[0];
  if (!tenant) return false;
  const business = engine.business('ramen');
  const cost = business.storeCost + tenant.deposit;
  const shortfall = cost - engine.g.companyCash;
  if (shortfall > 0) {
    const room = Math.floor(engine.companyCreditLimit() - engine.g.companyDebt);
    const amount = Math.min(shortfall, Math.max(0, room));
    if (amount > 0) engine.borrow(amount, 'company');
  }
  return engine.openStore({ tenantID: tenant.id, businessID: 'ramen', operatingHours: 3 });
}

function run(companyName, lcgSeed, weeks) {
  const { ctx } = loadGameFromHtml(html, { random: lcg(lcgSeed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  engine.g.companyName = companyName;
  tryOpen(engine);
  const business = engine.business('ramen');
  for (let w = 1; w <= weeks && !engine.g.gameOver; w++) {
    engine.advanceWeek(false);
    if (engine.g.week % 4 === 0 && !engine.g.gameOver) {
      const tenant = engine.g.tenants.filter(t => !t.occupiedBy).sort((a, b) => b.traffic - a.traffic || a.id.localeCompare(b.id))[0];
      if (tenant) {
        const hist = engine.g.weeklyProfitHistory.slice(-8);
        const avgProfit = hist.length ? hist.reduce((a, b) => a + b, 0) / hist.length : 0;
        const nextCost = business.storeCost + tenant.deposit;
        if (avgProfit > 0 && engine.g.companyCash > nextCost * 3) tryOpen(engine);
      }
    }
  }
  return { companyName, gameOver: engine.g.gameOver, finalWeek: engine.g.week, finalCash: Math.round(engine.g.companyCash) };
}

// デルタ商会 (lcgSeed 190826041+3) defaulted at week239/243 under the pre-fix code
// (founding-route-verification-log.md Entry 20-21). 244 weeks matches the positive regression
// test's horizon and comfortably covers the week239 default point.
const r = run('デルタ商会', 190826041 + 3, 244);
console.log(JSON.stringify(r));
assert.equal(r.gameOver, true, `expected デルタ商会 to still default within 244 weeks under the reverted (pre-fix) paymentDueWeek formula, got: ${JSON.stringify(r)}`);

console.log('ramen supply payment terms negative test ok (reverted code still reproduces the default, confirming the regression test has real detection power)');
