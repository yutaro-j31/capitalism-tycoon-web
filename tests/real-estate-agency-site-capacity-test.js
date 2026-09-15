'use strict';

// Founding Route Rebalance Final -- PR D: realEstateAgency site/traffic <-> capacity coupling.
//
// Diagnosis this addresses (re-measured against current production code via tests/harness.js):
// a high-traffic tenant's inquiryBase already scales with the UNCAPPED pref.traffic term (not
// just the +-10% siteMultiplier band), generating ~2.2x the inquiries of a cheap tenant -- but
// newMandates only grew ~1.2x, because pipeline capacityFor(business) was a pure function of
// business.efficiency, identical for every store regardless of the tenant/prefecture it opened
// in. 36% of the high-traffic site's weekly inquiries were thrown away as capacityLostInquiries
// (vs 15% for a cheap site), which is why paying 6.1x more rent for traffic only bought +14%
// commission revenue: the pipeline couldn't hold enough concurrent deals to convert the extra
// demand. An initial hypothesis of widening inquiryBase further would have made this WORSE (more
// generated inquiries hitting the same fixed ceiling), which is why this PR touches capacity
// instead.
//
// Fix: capacityFor(business, siteMultiplier) adds a bounded, non-negative bonus (0 to +4 slots)
// from the tenant's existing site-suitability multiplier (already computed for inquiryBase, now
// also threaded into ensureStore/processStore). A below-average site (siteMultiplier <= 1) gets
// zero bonus -- it never loses capacity relative to today -- so the already-viable low-rent
// strategy is not penalized; only above-average sites are rewarded.
//
// What this PR does NOT touch: js/tenant-site-suitability.js (shared by ramen/conveni/gym -- its
// clamp to [.85,1.15]/[.9,1.1] is untouched, so those businesses are byte-unaffected), the
// inquiryBase formula's own clamp(siteMultiplier,.9,1.1), and the pipeline's closing-rate /
// commission-rate / asking-value distributions (SEGMENT_CONFIG, commission rates -- #654's
// design intent).
//
// Measured effect (8-10 seeds x 120-160 weeks, standard play, highest-traffic tenant): weekly
// commission revenue for the high-traffic tenant rose from ~790,565 to ~994,163, average weekly
// profit rose from ~155,224 to ~336,269 -- surpassing the cheap tenant's ~300,792, i.e. site
// choice becomes a real decision instead of a trap. 10-seed/160-week bankruptcy count fell from
// 4/10 (unmodified main) to 1/10 (this PR alone); the one remaining failure is the classic early
// week-9 cash crunch this PR was never meant to address (see the founding-route-startup-loan
// investigation for that lever).
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 190826041) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; }; }

// ---- 1. unit: siteCapacityBonus / capacityFor bounds and backward compatibility -------------
{
  const loaded = loadGame({ random: lcg() });
  const mod = loaded.modules.realEstateAgencyPipeline;

  // pre-PR call shape (single arg) must still return exactly what it always did.
  assert.equal(mod.capacityFor({ efficiency: 0 }), 8, 'capacityFor(business) alone is unchanged: efficiency=0 -> capacity 8');
  assert.equal(mod.capacityFor({ efficiency: 100 }), 28, 'capacityFor(business) alone is unchanged at max efficiency');

  // a below-average site never loses capacity relative to today.
  assert.equal(mod.capacityFor({ efficiency: 0 }, 1), 8, 'siteMultiplier=1 (neutral) adds nothing');
  assert.equal(mod.capacityFor({ efficiency: 0 }, .9), 8, 'siteMultiplier=.9 (worst possible) adds nothing -- never a penalty');
  assert.equal(mod.capacityFor({ efficiency: 0 }, .5), 8, 'an out-of-band low value is clamped, still adds nothing');

  // an above-average site is rewarded, bounded, and monotonic.
  const at95 = mod.capacityFor({ efficiency: 0 }, .95) - 8;
  const at100 = mod.capacityFor({ efficiency: 0 }, 1.0) - 8;
  const at105 = mod.capacityFor({ efficiency: 0 }, 1.05) - 8;
  const at110 = mod.capacityFor({ efficiency: 0 }, 1.1) - 8;
  assert.equal(at95, 0, 'below-neutral still adds nothing');
  assert.ok(at100 <= at105 && at105 <= at110, 'bonus is monotonically non-decreasing in siteMultiplier');
  assert.ok(at110 <= 4, 'bonus never exceeds +4 slots, even at the maximum possible siteMultiplier');
  assert.equal(mod.capacityFor({ efficiency: 0 }, 5), mod.capacityFor({ efficiency: 0 }, 1.1),
    'an out-of-band high value clamps to the same result as the real maximum -- the lever cannot be exploited');
}

// ---- 2. production: high-traffic tenant actually converts more of its extra demand ----------
{
  const runFor = (pickHighTraffic) => {
    const loaded = loadGame({ random: lcg() });
    const engine = new loaded.modules.engine.TycoonEngine(loaded.modules.engine.createInitialState({ configured: true }));
    engine.g.configured = true;
    const free = engine.g.tenants.filter(t => !t.occupiedBy);
    const tenant = pickHighTraffic
      ? free.slice().sort((a, b) => (b.traffic || 0) - (a.traffic || 0) || a.id.localeCompare(b.id))[0]
      : free.slice().sort((a, b) => (a.rent || 0) - (b.rent || 0) || a.id.localeCompare(b.id))[0];
    assert.equal(engine.openStore({ tenantID: tenant.id, businessID: 'realEstateAgency', name: 'x', operatingHours: 3 }), true);
    const store = engine.g.stores.at(-1);
    const rows = [];
    for (let i = 0; i < 60; i++) {
      if (engine.g.companyCash < 3_000_000) { const room = Math.floor(engine.companyCreditLimit() - engine.g.companyDebt); if (room > 0) engine.borrow(Math.min(room, 5_000_000), 'company'); }
      assert.notEqual(engine.advanceWeek(false), false);
      const kpi = store.brokeragePipeline?.lastWeek;
      if (kpi) rows.push(kpi);
    }
    const n = rows.length, s = k => rows.reduce((a, r) => a + r[k], 0);
    return {
      capacity: rows[0].capacity,
      inquiries: s('inquiries') / n,
      capacityLostInquiries: s('capacityLostInquiries') / n,
      capacityLostShare: s('capacityLostInquiries') / s('inquiries'),
      commissionRevenue: s('commissionRevenue') / n,
      tenant,
    };
  };
  const hi = runFor(true), lo = runFor(false);
  assert.ok(hi.tenant.traffic > lo.tenant.traffic, 'test setup: the two tenants actually differ in traffic');
  assert.ok(hi.capacity > lo.capacity, 'the high-traffic store gets a real capacity bonus over the cheap one');
  assert.ok(hi.capacityLostShare < .36, 'high-traffic capacity-loss share improves from the pre-PR ~36% baseline');
  assert.ok(hi.commissionRevenue > lo.commissionRevenue * 1.2,
    'the high-traffic tenant now converts meaningfully more revenue than the cheap tenant, not just marginally more');
}

// ---- 3. the pipeline's own distributions are byte-unchanged (#654 design intent) ------------
{
  const loaded = loadGame({ random: lcg() });
  const mod = loaded.modules.realEstateAgencyPipeline;
  // JSON.stringify rather than deepEqual: SEGMENT_CONFIG's entries are Object.freeze()d with a
  // different prototype chain than a plain object literal, which fails Node's reference-equality
  // check on an otherwise identical structure -- not a real mismatch.
  assert.equal(JSON.stringify(mod.SEGMENT_CONFIG), JSON.stringify({
    residential: { weight: .58, valueMultiplier: .8, closeMultiplier: 1.14, expiryOffset: 0, cycleSensitivity: 1 },
    luxury: { weight: .14, valueMultiplier: 1.45, closeMultiplier: .88, expiryOffset: 3, cycleSensitivity: 1 },
    investment: { weight: .18, valueMultiplier: 1.12, closeMultiplier: 1.08, expiryOffset: 1, cycleSensitivity: 2 },
    corporateDeal: { weight: .1, valueMultiplier: 1.5, closeMultiplier: .88, expiryOffset: 4, cycleSensitivity: 1 },
  }), 'segment weights/multipliers/close chances untouched');
  assert.equal(mod.SINGLE_COMMISSION_RATE, .055);
  assert.equal(mod.DOUBLE_COMMISSION_RATE, .065);
  assert.equal(mod.DOUBLE_SIDE_RATE, .5);
}

// ---- 4. shared modules other businesses depend on are untouched -----------------------------
{
  const loaded = loadGame({ random: lcg() });
  const tss = loaded.modules.tenantSiteSuitability;
  // ramen/conveni/gym read tenantSiteSuitability directly; their multiplier math must be exact.
  assert.equal(tss.CONFIG.ramen.trafficWeight, .70);
  assert.equal(tss.CONFIG.conveni.trafficWeight, .75);
  assert.equal(tss.CONFIG.gym.trafficWeight, .30);
  const sample = tss.evaluateTenantSuitability({ traffic: 3, size: 'M' }, 'ramen', { traffic: 1 });
  assert.equal(sample.multiplier, Math.round(Math.min(1.1, Math.max(.9, 1 + (Math.min(1.15, Math.max(.85, 3)) - 1) * .70 + (1.04 - 1) * .30)) * 10000) / 10000,
    'ramen suitability math is exactly what it was before this PR');
}

// ---- 5. multi-store: capacity is computed independently per store, from that store's own tenant
{
  const loaded = loadGame({ random: lcg() });
  const { finance } = loaded.modules;
  const engine = new loaded.modules.engine.TycoonEngine(loaded.modules.engine.createInitialState({ configured: true }));
  engine.g.configured = true;
  const room0 = Math.floor(engine.companyCreditLimit() - engine.g.companyDebt);
  if (room0 > 0) engine.borrow(room0, 'company');
  const free = engine.g.tenants.filter(t => !t.occupiedBy);
  const hi = free.slice().sort((a, b) => (b.traffic || 0) - (a.traffic || 0) || a.id.localeCompare(b.id))[0];
  assert.equal(engine.openStore({ tenantID: hi.id, businessID: 'realEstateAgency', name: 'hi', operatingHours: 3 }), true);
  const free2 = engine.g.tenants.filter(t => !t.occupiedBy);
  const lo = free2.slice().sort((a, b) => (a.rent || 0) - (b.rent || 0) || a.id.localeCompare(b.id))[0];
  const cost2 = engine.business('realEstateAgency').storeCost + lo.deposit;
  let opened2 = false;
  for (let attempt = 0; attempt < 60 && !opened2; attempt++) {
    if (engine.g.companyCash < cost2) { const room = Math.floor(engine.companyCreditLimit() - engine.g.companyDebt); if (room > 0) engine.borrow(room, 'company'); }
    if (engine.g.companyCash >= cost2) opened2 = engine.openStore({ tenantID: lo.id, businessID: 'realEstateAgency', name: 'lo', operatingHours: 3 });
    else assert.notEqual(engine.advanceWeek(false), false);
  }
  assert.equal(opened2, true, 'second store opens');
  for (let i = 0; i < 10; i++) assert.notEqual(engine.advanceWeek(false), false);
  const [storeHi, storeLo] = engine.g.stores;
  assert.ok(storeHi.brokeragePipeline.capacity > storeLo.brokeragePipeline.capacity,
    'each store carries its own capacity from its own tenant -- the high-traffic store keeps a bigger pipeline than the cheap one');
  assert.equal(finance.validate(engine.g).ok, true, 'accounting still balances across two independently-capacitated stores');
}

// ---- 6. determinism: no RNG consumption, identical seed -> identical trace ------------------
{
  let draws = 0;
  const sequence = lcg();
  const counting = () => { draws++; return sequence(); };
  const loaded = loadGame({ random: counting });
  const mod = loaded.modules.realEstateAgencyPipeline;
  const before = draws;
  for (let i = 0; i < 30; i++) mod.capacityFor({ efficiency: i % 100 }, .9 + (i % 21) * .01);
  assert.equal(draws, before, 'capacityFor()/siteCapacityBonus() draw no RNG however many times called');

  const observe = () => {
    const loadedRun = loadGame({ random: lcg(24680) });
    const engine = new loadedRun.modules.engine.TycoonEngine(loadedRun.modules.engine.createInitialState({ configured: true }));
    engine.g.configured = true;
    const tenant = engine.g.tenants.filter(t => !t.occupiedBy).sort((a, b) => (b.traffic || 0) - (a.traffic || 0) || a.id.localeCompare(b.id))[0];
    engine.openStore({ tenantID: tenant.id, businessID: 'realEstateAgency', name: 'x', operatingHours: 3 });
    const store = engine.g.stores.at(-1);
    const rows = [];
    for (let i = 0; i < 26; i++) { engine.advanceWeek(false); rows.push(store.brokeragePipeline?.lastWeek); }
    return rows;
  };
  assert.equal(JSON.stringify(observe()), JSON.stringify(observe()), 'identical seeds produce identical traces');
}

// ---- 7. production integration: 26-week checkpoint (light, canonical-shard-friendly) --------
{
  const loaded = loadGame({ random: lcg() });
  const { finance } = loaded.modules;
  const engine = new loaded.modules.engine.TycoonEngine(loaded.modules.engine.createInitialState({ configured: true }));
  engine.g.configured = true;
  const tenant = engine.g.tenants.filter(t => !t.occupiedBy).sort((a, b) => (b.traffic || 0) - (a.traffic || 0) || a.id.localeCompare(b.id))[0];
  assert.equal(engine.openStore({ tenantID: tenant.id, businessID: 'realEstateAgency', name: 'x', operatingHours: 3 }), true);
  const store = engine.g.stores.at(-1);
  for (let i = 0; i < 26; i++) {
    if (engine.g.companyCash < 3_000_000) { const room = Math.floor(engine.companyCreditLimit() - engine.g.companyDebt); if (room > 0) engine.borrow(Math.min(room, 5_000_000), 'company'); }
    assert.notEqual(engine.advanceWeek(false), false);
  }
  assert.ok(store.brokeragePipeline.capacity > 8, 'a high-traffic first store carries a capacity bonus once it starts operating');
  assert.equal(finance.validate(engine.g).ok, true, 'accounting balances after 26 settled weeks');
}

console.log('real estate agency site capacity ok');
