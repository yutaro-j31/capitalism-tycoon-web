'use strict';
// Negative/mutation counterpart to tests/ramen-supply-payment-terms-208week-regression-test.js
// (Founding Route Rebalance Final, PR E). Proves the regression test actually detects the bug it
// claims to guard against: this test reverts js/supply.js's paymentDueWeek calculation back to
// the pre-fix, order-week-anchored formula (paymentDueWeek = g.week + terms, instead of the fixed
// g.week + leadTimeWeeks + terms) in an in-memory copy of the module -- the real file on disk is
// never touched -- and confirms that, under that reverted logic, at least one of the previously
// measured seeds (デルタ商会) still defaults within 208 weeks. If this test ever starts passing
// (i.e. the reverted code no longer reproduces the default), the positive regression test next to
// it has silently stopped being a meaningful guard and both need to be re-examined.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGameFromHtml, readIndex } = require('./harness');

const ROOT = path.join(__dirname, '..');
const SUPPLY_SOURCE = fs.readFileSync(path.join(ROOT, 'js', 'supply.js'), 'utf8');
const SUPPLY_TAG = '<script src="./js/supply.js"></script>';
const FIXED = 'paymentDueWeek:n(g.week)+lead+terms,paymentTermsWeeks:terms,';
const PRE_FIX_BUGGY = 'paymentDueWeek:n(g.week)+terms,paymentTermsWeeks:terms,';

assert(SUPPLY_SOURCE.includes(FIXED), 'expected the fixed paymentDueWeek formula in js/supply.js; has it been reverted or refactored?');
assert.equal(SUPPLY_SOURCE.split(FIXED).length - 1, 1, 'expected exactly one occurrence of the fixed paymentDueWeek formula');

const revertedSource = SUPPLY_SOURCE.replace(FIXED, PRE_FIX_BUGGY);
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
// (founding-route-verification-log.md Entry 20-21). 208 weeks is comfortably past the point the
// original downturn/default developed, matching the positive regression test's horizon.
const r = run('デルタ商会', 190826041 + 3, 208);
console.log(JSON.stringify(r));
assert.equal(r.gameOver, true, `expected デルタ商会 to still default within 208 weeks under the reverted (pre-fix) paymentDueWeek formula, got: ${JSON.stringify(r)}`);

console.log('ramen supply payment terms negative test ok (reverted code still reproduces the default, confirming the regression test has real detection power)');
