'use strict';
// G3/G4 bypass closure (docs/economic-engine/PHASE_3_P3_4_ACTIVATION_READINESS.md, step 2). Raw entries that write
// player-common facts can no longer do so outside a boundary:
// - the captured base executeIPO and the ratchet settle(), called directly, open their own transaction, so their leg
//   plans: a skewed bucket write is refused and the whole call rolled back;
// - the legacy acquireTarget share swap (W-ACQUIRE-COMPAT) does the same and plans its own external-issue leg;
// - the raw issuance helper refuses outside a transaction or shadow boundary and writes nothing.
// The margin exports are covered in tests/player-own-share-conservation-test.js and the base buyback refusal in
// tests/shareholder-buyback-save-atomicity-test.js.
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');
const { prepareIPO } = require('./fixtures/parent-ipo-atomicity');
function lcg(seed = 7) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
const MISMATCH = /株式数の整合を確認できませんでした/;

// 1. Captured base executeIPO, called directly outside any transaction.
{
  const eve = () => { const loaded = loadGame({ headless: true }), game = prepareIPO(loaded.modules); return { loaded, game }; };
  const baseOf = loaded => Object.getPrototypeOf(loaded.engineModule.TycoonEngine.prototype).executeIPO;
  {
    const { loaded, game } = eve(), base = baseOf(loaded);
    assert.notEqual(base, game.executeIPO, 'the captured base, not the installed chain');
    // Count only commits: a save requested inside the transaction is deferred to its end.
    let saves = 0; const save = game.save; game.save = function (...args) { if (!this.inTransaction()) saves++; return save.apply(this, args); };
    assert.equal(game.inTransaction(), false);
    assert.equal(base.call(game, '東証グロース', 0), true, 'a healthy direct base IPO succeeds');
    assert.equal(game.g.publicCompany, true); assert.equal(game.stock(game.g.ticker).issuedShares, game.g.sharesOut);
    assert.equal(saves, 1, 'the boundary the direct call opened commits once');
  }
  {
    const { loaded, game } = eve(), base = baseOf(loaded), prior = JSON.stringify(game.g), ratios = game.updateOwnershipRatios;
    game.updateOwnershipRatios = function (...args) { this.g.sharesOut += 1; return ratios.apply(this, args); };
    assert.equal(base.call(game, '東証グロース', 0), false, 'a skewed direct base IPO is refused');
    assert.equal(JSON.stringify(game.g), prior, 'and the whole IPO is rolled back');
  }
  console.log('captured base executeIPO: direct call opens its own boundary, skew refused and rolled back PASS');
}

// 2. The raw issuance helper refuses outside a boundary.
{
  const loaded = loadGame({ headless: true }), game = prepareIPO(loaded.modules);
  assert.equal(game.executeIPO('東証グロース'), true);
  const prior = JSON.stringify(game.g);
  assert.throws(() => game.issueSharesToExternalHolders(1000), /requires an ownership boundary/, 'refused outside a boundary');
  assert.equal(JSON.stringify(game.g), prior, 'and nothing is written');
  const shares = game.g.sharesOut;
  game.runTransaction(() => game.issueSharesToExternalHolders(1000));
  assert.equal(game.g.sharesOut, shares + 1000, 'inside a transaction the helper issues as before');
  console.log('raw issuance helper: refused outside a boundary, unchanged inside PASS');
}

// 2b. The legacy acquireTarget share swap (W-ACQUIRE-COMPAT), called directly: its own boundary and leg.
{
  const listed = () => {
    const loaded = loadGame({ headless: true }), game = prepareIPO(loaded.modules);
    assert.equal(game.executeIPO('東証グロース'), true);
    game.g.departments.investment = game.g.departments.investment || { name: '投資部', established: true };
    game.g.acquisitionTargets = [{ id: 'swap', name: 'Target swap', domain: 'SaaS', valuation: 80_000_000, sales: 60_000_000,
      operatingProfit: 6_000_000, growth: .1, risk: .1, synergy: .1, friendly: true, expiresWeek: game.g.week + 13 }];
    return game;
  };
  {
    const game = listed(), shares = game.g.sharesOut, cash = game.g.companyCash;
    assert.equal(game.inTransaction(), false);
    assert.equal(game.acquireTarget('swap', 'shareSwap'), true, 'a healthy direct legacy share swap succeeds');
    assert.ok(game.g.sharesOut > shares); assert.equal(game.g.companyCash, cash, 'no cash');
    assert.equal(game.stock(game.g.ticker).issuedShares, game.g.sharesOut);
  }
  {
    const game = listed(), prior = JSON.stringify(game.g), ratios = game.updateOwnershipRatios;
    game.updateOwnershipRatios = function (...args) { this.g.sharesOut += 1; return ratios.apply(this, args); };
    assert.equal(game.acquireTarget('swap', 'shareSwap'), false, 'a skewed legacy share swap is refused');
    assert.equal(JSON.stringify(game.g), prior, 'and the whole acquisition is rolled back');
  }
  console.log('legacy acquireTarget share swap: own boundary and leg, skew refused and rolled back PASS');
}

// 3. The ratchet settle(), called directly outside the week. Fixture of tests/turnaround-ratchet-listed-mirror-test.js.
function ratchetFixture() {
  const loaded = loadGame({ random: lcg(7), headless: true });
  const { engine, finance, playerCrisis, playerTurnaroundPlan } = loaded.modules;
  const state = engine.createInitialState({ configured: true });
  state.week = 2; state.companyCash = -3_000_000; state.companyCredit = 80;
  const property = state.properties[0];
  property.owner = 'company'; property.purchasePrice = property.price = property.value = 100_000_000;
  state.finance = finance.defaultFinanceState(state);
  playerCrisis.evaluate(state);
  const game = new engine.TycoonEngine(state);
  assert.notEqual(game.acceptTurnaroundFund(), false, 'fund accepted');
  playerTurnaroundPlan.ensure(game.g).status = 'failed';
  return { loaded, game };
}
{
  const { loaded, game } = ratchetFixture(), settle = loaded.modules.playerCrisisTurnaroundFund.settle;
  let saves = 0; game.save = () => { saves++; return true; };
  const before = game.g.sharesOut, ratchet = loaded.modules.playerCrisisTurnaroundFund.ratchetSharesFor(JSON.parse(JSON.stringify(game.g)));
  assert.equal(game.inTransaction(), false);
  assert.notEqual(settle(game), null, 'a healthy direct ratchet settles');
  assert.equal(game.turnaroundFundSnapshot().status, 'ratcheted'); assert.equal(game.g.sharesOut, before + ratchet);
  assert.equal(saves, 1, 'the boundary the direct call opened commits once');
  const settled = JSON.stringify(game.g);
  assert.equal(settle(game), null, 'a terminal fund settles nothing'); assert.equal(saves, 1, 'and commits nothing');
  assert.equal(JSON.stringify(game.g), settled);
}
{
  const { loaded, game } = ratchetFixture(), settle = loaded.modules.playerCrisisTurnaroundFund.settle;
  game.save = () => true;
  const prior = JSON.stringify(game.g), ratios = game.updateOwnershipRatios;
  game.updateOwnershipRatios = function (...args) {
    if (this.g.playerTurnaroundFund.status === 'ratcheted') this.g.sharesOut++;
    return ratios.apply(this, args);
  };
  assert.throws(() => settle(game), MISMATCH, 'a skewed direct ratchet is refused');
  assert.equal(JSON.stringify(game.g), prior, 'and the whole ratchet is rolled back');
  console.log('ratchet settle: direct call opens its own boundary, skew refused and rolled back PASS');
}
console.log('P3-4 raw entry boundary PASS');
