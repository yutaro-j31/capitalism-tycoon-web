'use strict';
// G1 D0/D2 (Owner 2026-11-05, docs/economic-engine/P3_4_G1_GENERATION_BINDING_DECISION.md): a refounded company is
// reconciled afresh as the current generation. Required by phase3-control-eligibility-test.js.
// - D0: a listed second generation reconciles, its control is evaluated, and an installed writer's P3-4 leg plans.
// - D2: a residual own-ticker lot that fits the new company counts as the founder's holding of it.
// - D2a: a refounded save that still carries the old listing row while the new company is unlisted stays unchecked.
// - Unproven generation evidence (no past record, a record at or above the serial) keeps the leg unchecked.
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
  }
}
module.exports = { run };
