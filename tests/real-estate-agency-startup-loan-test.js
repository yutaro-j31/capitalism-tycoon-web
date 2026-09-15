'use strict';

// Founding Route Rebalance Final -- PR C: realEstateAgency founding working-capital loan.
//
// Diagnosis this addresses (re-measured against current production code via tests/harness.js,
// NOT the premise the earlier design doc assumed): realEstateAgency is not structurally
// loss-making. Average weekly profit is positive (+64,278 measured over 8 seeds x 160 weeks),
// but 81.3% of weeks are loss weeks of about -550,000 and only 18.7% of weeks carry a closed
// deal worth about +2,500,000. That lumpiness is the intended design (#654 explicitly wanted
// the "mountains and valleys" preserved). What kills the business is that the cash buffer
// needed to survive the valleys -- median 4,869,523 over the first 26 weeks -- is roughly 5x
// what the founding leaves on hand.
//
// So this PR does NOT touch js/real-estate-agency-pipeline.js: closing rates, commission rates
// and asking-value distributions are all left exactly as they are. Instead it adds a bounded,
// visible, interest-bearing working-capital loan (js/bank-loans-covenants.js), sized from that
// measurement, following the gym startup loan product already shipped in #659.
//
// Note the deliberate difference from the gym product: the gym loan bridges a shortfall
// (storeCost exceeds cash), whereas realEstateAgency can already afford to open -- its loan
// tops the *post-opening* cash up to AGENCY_STARTUP_TARGET_BUFFER. Eligibility therefore keys
// off cash-after-opening, not off a shortfall.
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 190826041) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; }; }
function newEngine(loaded) {
  const engine = new loaded.modules.engine.TycoonEngine(loaded.modules.engine.createInitialState({ configured: true }));
  engine.g.configured = true;
  return engine;
}
function bestTenant(engine) {
  return engine.g.tenants.filter(t => !t.occupiedBy)
    .sort((a, b) => (b.traffic || 0) - (a.traffic || 0) || a.id.localeCompare(b.id))[0];
}

// ---- 1. quote shape: bounded, and sized to the post-opening buffer, not to a shortfall -----
{
  const loaded = loadGame({ random: lcg() });
  const bank = loaded.modules.bankLoansCovenants;
  const engine = newEngine(loaded);
  const tenant = bestTenant(engine);
  const upfront = engine.business('realEstateAgency').storeCost + tenant.deposit;

  const q = bank.agencyStartupQuote(engine.g, upfront);
  assert.equal(q.eligible, true, 'a first realEstateAgency store in the founding window is eligible');
  assert.equal(q.required, 0, 'the opening itself is affordable -- there is no shortfall to bridge');
  assert.ok(q.principal > 0, 'yet a working-capital principal is still offered (this is the whole point)');
  assert.equal(q.principal, bank.AGENCY_STARTUP_TARGET_BUFFER - (engine.g.companyCash - upfront),
    'principal tops post-opening cash up to AGENCY_STARTUP_TARGET_BUFFER');
  assert.ok(q.principal <= bank.AGENCY_STARTUP_MAX, 'principal never exceeds AGENCY_STARTUP_MAX');
  assert.equal(q.term, bank.AGENCY_STARTUP_TERM);
  assert.ok(q.annualRate > 0 && q.annualRate <= .18, 'interest-bearing and rate-clamped');
  assert.ok(q.weeklyPayment > 0, 'the loan is repaid -- it is not a grant');
}

// ---- 2. bounded by AGENCY_STARTUP_MAX even when the gap is huge ----------------------------
{
  const loaded = loadGame({ random: lcg() });
  const bank = loaded.modules.bankLoansCovenants;
  const engine = newEngine(loaded);
  engine.g.companyCash = 0;
  const q = bank.agencyStartupQuote(engine.g, 900_000_000);
  assert.equal(q.principal, bank.AGENCY_STARTUP_MAX, 'an arbitrarily large gap is capped at AGENCY_STARTUP_MAX');
}

// ---- 3. gates: first store only, founding window only, and no top-up once already funded ---
{
  const loaded = loadGame({ random: lcg() });
  const bank = loaded.modules.bankLoansCovenants;
  const engine = newEngine(loaded);
  const tenant = bestTenant(engine);
  const upfront = engine.business('realEstateAgency').storeCost + tenant.deposit;

  const late = newEngine(loaded);
  late.g.week = 14;
  assert.equal(bank.agencyStartupQuote(late.g, upfront).eligible, false, 'past the founding window (week > 13) it is no longer available');

  const funded = newEngine(loaded);
  funded.g.companyCash = bank.AGENCY_STARTUP_TARGET_BUFFER + upfront;
  assert.equal(bank.agencyStartupQuote(funded.g, upfront).eligible, false,
    'a company that already has the target buffer after opening gets nothing -- no free cash');

  assert.equal(engine.openStore({ tenantID: tenant.id, businessID: 'realEstateAgency', name: '1号店', operatingHours: 3 }), true);
  const t2 = bestTenant(engine);
  assert.equal(bank.agencyStartupQuote(engine.g, engine.business('realEstateAgency').storeCost + t2.deposit).eligible, false,
    'the second store gets no loan -- this is a founding mechanic, not an expansion subsidy');
}

// ---- 4. the quote consumes no RNG (estimates must not move the deterministic fingerprint) --
{
  // A constant stub (e.g. () => .5) collapses UUID-derived IDs into duplicates and the engine
  // refuses to construct, so count draws on top of a real deterministic sequence instead.
  let draws = 0;
  const sequence = lcg();
  const counting = () => { draws++; return sequence(); };
  const loaded = loadGame({ random: counting });
  const bank = loaded.modules.bankLoansCovenants;
  const engine = newEngine(loaded);
  const tenant = bestTenant(engine);
  const upfront = engine.business('realEstateAgency').storeCost + tenant.deposit;
  const before = draws;
  for (let i = 0; i < 25; i++) bank.agencyStartupQuote(engine.g, upfront);
  assert.equal(draws, before, 'agencyStartupQuote() draws no RNG however many times it is called');
}

// ---- 5. ledger integrity: exactly one borrowing event, debt recorded, accounting balances ---
{
  const loaded = loadGame({ random: lcg() });
  const { finance } = loaded.modules;
  const engine = newEngine(loaded);
  const tenant = bestTenant(engine);
  const personalBefore = engine.g.personalCash;
  const debtBefore = engine.g.companyDebt;

  assert.equal(engine.openStore({ tenantID: tenant.id, businessID: 'realEstateAgency', name: '1号店', operatingHours: 3 }), true);

  const loans = finance.ensureFinance(engine.g).loans.filter(l => l.sourceType === 'agencyStartupLoan');
  assert.equal(loans.length, 1, 'exactly one canonical loan record');
  const borrowings = (finance.ensureFinance(engine.g).transactions || []).filter(t => t.sourceType === 'agencyStartupLoan');
  assert.equal(borrowings.length, 1, 'exactly one ledger entry -- the principal is not double-counted');
  assert.equal(engine.g.companyDebt - debtBefore, loans[0].principal, 'company debt rises by exactly the principal');
  assert.equal(engine.g.personalCash, personalBefore, 'the loan never touches personal cash (company/personal separation)');
  assert.equal(finance.validate(engine.g).ok, true, 'assets = liabilities + equity still holds after the loan');
}

// ---- 6. the brokerage pipeline itself is untouched (the #654 design intent) -----------------
// Same seed, same store, with and without the loan: the pipeline's own outputs -- inquiries,
// mandates, closed deals, commission revenue -- must be identical. Only cash/debt may differ.
//
// The week counter cannot be used to switch the loan off, because the pipeline salts its own
// hashes with the week (`close:${week}`, `mandate:${week}:${i}`, ...). Starting cash is the
// clean lever instead: processStore() never reads cash, but a company that already holds the
// target buffer is not eligible for the loan.
{
  const pipelineTrace = (expectLoan) => {
    const loaded = loadGame({ random: lcg() });
    const engine = newEngine(loaded);
    if (!expectLoan) engine.g.companyCash = 60_000_000;
    const tenant = bestTenant(engine);
    const debtBefore = engine.g.companyDebt;
    assert.equal(engine.openStore({ tenantID: tenant.id, businessID: 'realEstateAgency', name: '1号店', operatingHours: 3 }), true);
    assert.equal(engine.g.companyDebt > debtBefore, expectLoan,
      expectLoan ? 'the loan must actually fire in this variant' : 'this variant must take no loan at all');
    const store = engine.g.stores.at(-1);
    const trace = [];
    for (let i = 0; i < 26; i++) {
      assert.notEqual(engine.advanceWeek(false), false);
      const kpi = store.brokeragePipeline?.lastWeek;
      if (kpi) trace.push([kpi.inquiries, kpi.newMandates, kpi.closedDeals, kpi.commissionRevenue, kpi.lostDeals]);
    }
    return trace;
  };
  assert.equal(JSON.stringify(pipelineTrace(true)), JSON.stringify(pipelineTrace(false)),
    'closing rates, commission revenue and deal flow are byte-identical with and without the loan');
}

// ---- 7. production integration: 26-week checkpoint ----------------------------------------
// Deliberately light (the tests/executive-dismissal-reachability-test.js pattern) so this can
// live in a canonical shard. The 160-week survival benchmark stays a manual measurement.
{
  const loaded = loadGame({ random: lcg() });
  const { finance } = loaded.modules;
  const engine = newEngine(loaded);
  const tenant = bestTenant(engine);
  assert.equal(engine.openStore({ tenantID: tenant.id, businessID: 'realEstateAgency', name: '1号店', operatingHours: 3 }), true);

  const cashAfterOpening = engine.g.companyCash;
  assert.ok(cashAfterOpening >= loaded.modules.bankLoansCovenants.AGENCY_STARTUP_TARGET_BUFFER,
    'after opening, the company actually holds the target working-capital buffer');

  const debtAfterOpening = engine.g.companyDebt;
  for (let i = 0; i < 26; i++) assert.notEqual(engine.advanceWeek(false), false);

  assert.equal(engine.g.gameOver, false, 'the store survives its first 26 weeks of lumpy revenue');
  assert.ok(engine.g.companyDebt < debtAfterOpening, 'the loan is actually being serviced -- debt falls week over week');
  assert.equal(finance.validate(engine.g).ok, true, 'accounting still balances after 26 settled weeks');
}

// ---- 8. determinism -------------------------------------------------------------------------
{
  const observe = () => {
    const loaded = loadGame({ random: lcg() });
    const engine = newEngine(loaded);
    const tenant = bestTenant(engine);
    engine.openStore({ tenantID: tenant.id, businessID: 'realEstateAgency', name: '1号店', operatingHours: 3 });
    const rows = [];
    for (let i = 0; i < 26; i++) {
      engine.advanceWeek(false);
      rows.push({ cash: engine.g.companyCash, debt: engine.g.companyDebt, profit: engine.g.stores.at(-1).lastProfit });
    }
    return rows;
  };
  // JSON.stringify rather than deepEqual: Node's strict deepEqual separates -0 from 0, which is
  // a float-rounding artifact here, not nondeterminism (same convention as the other measures).
  assert.equal(JSON.stringify(observe()), JSON.stringify(observe()), 'identical seeds produce identical runs');
}

// ---- 9. the gym product is unchanged by the shared funding helper --------------------------
{
  const loaded = loadGame({ random: lcg() });
  const { finance } = loaded.modules;
  const bank = loaded.modules.bankLoansCovenants;
  const engine = newEngine(loaded);
  const tenant = engine.g.tenants.filter(t => !t.occupiedBy).sort((a, b) => a.deposit - b.deposit || a.id.localeCompare(b.id))[0];
  const upfront = engine.business('gym').storeCost + tenant.deposit;
  // The gym loan only bridges a gap it can actually cover (required <= GYM_STARTUP_MAX); in real
  // play the founder first draws ordinary company credit and the startup loan closes the rest.
  // Use engine.borrow() rather than assigning companyCash: a direct assignment bypasses
  // finance.event() and breaks the assets = liabilities + equity invariant.
  const ordinary = Math.min(Math.max(0, upfront - engine.g.companyCash), Math.floor(engine.companyCreditLimit() - engine.g.companyDebt));
  if (ordinary > 0) assert.equal(engine.borrow(ordinary, 'company'), true);
  const q = bank.gymStartupQuote(engine.g, upfront);
  assert.equal(q.eligible, true, 'gym still qualifies for its bridging loan');
  assert.equal(q.required, Math.max(0, upfront - engine.g.companyCash), 'gym required = upfront shortfall, unchanged');
  assert.equal(q.term, bank.GYM_STARTUP_TERM, 'gym term unchanged');
  assert.equal(q.principal, Math.min(bank.GYM_STARTUP_MAX, q.required + bank.GYM_STARTUP_RESERVE), 'gym principal formula unchanged');

  assert.equal(engine.openStore({ tenantID: tenant.id, businessID: 'gym', name: 'ジム1号店', operatingHours: 3 }), true);
  const gymLoans = finance.ensureFinance(engine.g).loans.filter(l => l.sourceType === 'gymStartupLoan');
  assert.equal(gymLoans.length, 1, 'gym loan still recorded under its own sourceType');
  assert.equal(gymLoans[0].loanID.startsWith('gym-startup-loan-'), true, 'gym loan id format unchanged');
  const gymLedger = (finance.ensureFinance(engine.g).transactions || []).filter(t => t.sourceType === 'gymStartupLoan');
  assert.equal(gymLedger.length, 1);
  assert.equal(gymLedger[0].operationID.startsWith('gym-startup-borrow-'), true, 'gym ledger operationID format unchanged');
  assert.equal(finance.validate(engine.g).ok, true);
}

console.log('real estate agency startup loan ok');
