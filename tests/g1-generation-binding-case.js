'use strict';
// G1 D0/D2 (Owner 2026-11-05, docs/economic-engine/P3_4_G1_GENERATION_BINDING_DECISION.md): a refounded company is
// reconciled afresh as the current generation. Required by phase3-control-eligibility-test.js.
// - D0: a listed second generation reconciles, its control is evaluated, and an installed writer's P3-4 leg plans.
// - D2: a residual own-ticker lot that fits the new company counts as the founder's holding of it.
// - D2a: a refounded save that still carries the old listing row while the new company is unlisted stays unchecked.
// - Unproven generation evidence (no past record, a record at or above the serial, a sparse record list) keeps the leg
//   unchecked, and the read model and the planner agree on every shape (review G1-R1-01).
// Authority stays disabled throughout: a planned leg only verifies, it never applies.
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function boot() {
  let x = 11;
  return loadGame({ headless: true, random: () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 2 ** 32; } });
}
function generation({ serial = 2, past = [{ companySerial: 1 }], lot = { qty: 2000, avg: 500 }, listed = true, oldRow = false } = {}) {
  const s = boot(), state = s.engineModule.createInitialState({ configured: true });
  Object.assign(state, { week: 30, companyCash: 100000000, personalCash: 100000000, publicCompany: listed, sharesOut: 100000, founderShares: 60000,
    treasuryBuybackShares: 0, competitorOwnedRatio: 0, stockPrice: 100, ticker: 'CPTY', isCompanySold: false, currentCompanySerial: serial,
    serialCompanyCount: serial, pastCompanyRecords: past });
  if (past === 'missing') delete state.pastCompanyRecords;
  state.market = state.market.filter(row => row.id !== 'CPTY');
  if (listed || oldRow) state.market.push({ id: 'CPTY', name: state.companyName, sector: 'コングロマリット', price: 100, previous: 100,
    issuedShares: oldRow ? 1000000 : 100000, marketCap: 10000000, dividendYield: 0, volatility: 0, trend: 0, dividendPerShare: 0, priceHistory: [{ week: 30, price: 100 }] });
  state.personalStocks = lot ? { CPTY: lot } : {};
  state.finance = s.modules.finance.defaultFinanceState(state);
  const e = new s.engineModule.TycoonEngine(state);
  e.updateOwnershipRatios();
  return { s, e, g: e.g };
}
const scope = read => ({ issuerEntityId: read.PLAYER_COMPANY_ENTITY_ID, actingEntityId: read.FOUNDER_ENTITY_ID });
function leg(ctx) {
  const apply = ctx.s.modules.phase3OwnershipApply;
  let handle;
  ctx.e.runTransaction(() => { handle = apply.beginOwnershipLeg(ctx.e, { writerId: 'W-BUY', kind: 'personal-buy', operationId: 'g1-probe', change: { quantity: 100 } }); return false; });
  return handle;
}

function run() {
  // D0 + D2: the second generation reconciles with the fitting residual lot as the founder's holding.
  {
    const ctx = generation(), read = ctx.s.modules.economicReadModel;
    const before = JSON.stringify(ctx.g);
    const r = read.ownershipReconciliation(ctx.g);
    assert.equal(r.ok, true, 'second generation reconciles');
    assert.equal(r.generationEvidence.currentCompanySerial, 2);
    assert.equal(r.beneficialHoldings[0].quantity, 62000, 'D2: founder 60,000 + residual lot 2,000');
    const control = ctx.s.modules.phase3ControlEligibility.projectControlEligibility(r, scope(read));
    assert.equal(control.status, 'EVALUATED');
    assert.ok(control.capabilities.every(row => row.executionStatus === 'NOT_AUTHORIZED'), 'authority stays disabled');
    assert.ok(leg(ctx), 'an installed writer leg plans in the second generation');
    assert.equal(JSON.stringify(ctx.g), before, 'reading and a rolled-back probe change nothing');
    // The installed purchase verifies its leg and commits in the second generation.
    assert.equal(ctx.e.buyStock('CPTY', 1000, 'personal'), true);
    assert.equal(ctx.g.personalStocks.CPTY.qty, 3000);
    assert.equal(read.ownershipReconciliation(ctx.g).beneficialHoldings[0].quantity, 63000);
  }
  // A third generation with two recorded predecessors is proven the same way.
  assert.ok(leg(generation({ serial: 3, past: [{ companySerial: 2 }, { companySerial: 1 }] })), 'third generation plans');

  // Unproven generation evidence leaves the leg unchecked (null), exactly as the first-generation-only rule did.
  for (const past of [[], [{ companySerial: 2 }], [{ companySerial: '1' }], [null], 'missing']) {
    const ctx = generation({ past });
    assert.equal(leg(ctx), null, `unproven past ${JSON.stringify(past)}`);
    assert.equal(ctx.s.modules.economicReadModel.ownershipReconciliation(ctx.g).generationEvidence.currentCompanySerial, null);
  }
  {
    const ctx = generation();
    ctx.g.isCompanySold = true;
    assert.equal(leg(ctx), null, 'a sold second generation stays unchecked');
  }

  // D2a: an unlisted refounded company whose save still carries the sold company's listing row stays unchecked, and
  // nothing rewrites the row.
  {
    const ctx = generation({ listed: false, oldRow: true, lot: null }), read = ctx.s.modules.economicReadModel;
    const evidence = ctx.s.modules.phase3OwnershipPlanner.inspectOwnershipAuthority(ctx.g, { family: 'player-common',
      issuerEntityId: read.PLAYER_COMPANY_ENTITY_ID, securityClassId: read.PLAYER_COMPANY_COMMON_SECURITY_CLASS_ID, currentCompanySerial: 2 });
    assert.equal(evidence.status, 'REJECTED');
    assert.equal(evidence.reasons[0].code, 'ALIAS_BINDING_UNPROVEN', 'the old row is not bound to the unlisted new company');
    assert.equal(leg(ctx), null);
    assert.equal(ctx.g.market.find(row => row.id === 'CPTY').issuedShares, 1000000, 'the old listing row is left as saved');
    // Review G1-R1-02: the readers do not adopt the unbound old row either. They reconcile the unlisted company from its
    // own buckets (100,000 issued, not the row's 1,000,000), the same rule as an unlisted first generation, while the
    // writer leg above stays unchecked because it cannot bind the row.
    for (const serial of [2, 1]) {
      const c = generation({ serial, past: serial === 1 ? [] : [{ companySerial: 1 }], listed: false, oldRow: true, lot: null });
      const view = read.projectOwnershipSnapshot(c.g);
      assert.equal(view.classes.length, 1); assert.equal(view.classes[0].issuedQuantity, 100000, `serial ${serial}: issued from the buckets, not the old row`);
      assert.equal(read.ownershipReconciliation(c.g).securityClasses[0].outstandingQuantity, 100000);
    }
  }

  // Review G1-R1-01: a sparse pastCompanyRecords has empty slots that every() would skip; they are unproven evidence.
  // The read model and the planner give the same answer for every shape.
  {
    const ctx = generation(), read = ctx.s.modules.economicReadModel, planner = ctx.s.modules.phase3OwnershipPlanner;
    const holes = [new Array(1), [, { companySerial: 1 }], [{ companySerial: 1 }, ,], [{ companySerial: 1 }, , { companySerial: 1 }]];
    const shapes = [[[{ companySerial: 1 }], true], [[{ companySerial: 1 }, { companySerial: 1 }], true], ...holes.map(past => [past, false]),
      [[], false], [[{ companySerial: 2 }], false], [[{ companySerial: 0 }], false], [[{ companySerial: 1.5 }], false], [[null], false]];
    for (const [past, proven] of shapes) {
      const state = { ...ctx.g, currentCompanySerial: 2, pastCompanyRecords: past };
      assert.equal(read.currentCompanyGenerationProven(state), proven, `read model: ${past.length} slots`);
      const evidence = planner.inspectOwnershipAuthority(state, { family: 'player-common', issuerEntityId: read.PLAYER_COMPANY_ENTITY_ID,
        securityClassId: read.PLAYER_COMPANY_COMMON_SECURITY_CLASS_ID, currentCompanySerial: 2 });
      assert.equal(evidence.status === 'OBSERVED', proven, `planner agrees: ${past.length} slots`);
      if (!proven) assert.equal(evidence.reasons[0].code, 'GENERATION_UNPROVEN');
      assert.equal(read.ownershipReconciliation(state).generationEvidence.currentCompanySerial, proven ? 2 : null);
    }
    for (const past of holes) assert.equal(leg(generation({ past })), null, 'a sparse record list leaves the leg unchecked');
  }

  // pastCompanyRecords is part of the identity-index evidence, so changing it makes an earlier index stale.
  {
    const ctx = generation(), read = ctx.s.modules.economicReadModel;
    const index = read.buildOwnershipIdentityIndex(ctx.g);
    assert.ok(!read.projectOwnershipSnapshot(ctx.g, index).issues.some(row => row.code === 'STALE_EVIDENCE'));
    ctx.g.pastCompanyRecords = [{ companySerial: 1 }, { companySerial: 1 }];
    assert.ok(read.projectOwnershipSnapshot(ctx.g, index).issues.some(row => row.code === 'STALE_EVIDENCE'), 'changed records make the index stale');
  }
}
module.exports = { run };
