'use strict';

// The turnaround-fund ratchet (settle()) issues free shares after the base advanceWeek chain.
// It must be rolled back with the week when the final weekly boundary fails (#922 Writer matrix:
// "Turnaround ratchet ... week boundary unproven"). Test-only: no production change.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const KEY = 'capitalism_tycoon_web_v1';
function lcg(seed = 7) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function fixture() {
  const loaded = loadGame({ random: lcg(7), headless: true });
  const { engine, finance, playerCrisis } = loaded.modules;
  const state = engine.createInitialState({ configured: true });
  state.week = 2;
  state.companyCash = -3_000_000;
  state.companyCredit = 80;
  const property = state.properties[0];
  property.owner = 'company';
  property.purchasePrice = property.price = property.value = 100_000_000;
  state.finance = finance.defaultFinanceState(state);
  playerCrisis.evaluate(state);
  const game = new engine.TycoonEngine(state);
  assert.equal(game.acceptTurnaroundFund().ok !== false, true, 'fund accepted');
  game.save();
  return { loaded, game };
}

// Reference run: find how many weeks until the ratchet fires.
let ratchetWeeks = 0;
{
  const { game } = fixture();
  while (game.turnaroundFundSnapshot().status !== 'ratcheted' && ratchetWeeks < 30) {
    game.advanceWeek(false);
    ratchetWeeks++;
  }
  assert.equal(game.turnaroundFundSnapshot().status, 'ratcheted', 'precondition: the fund ratchets without intervention');
}

// Failure run: fail the final boundary in the very week the ratchet would fire.
{
  const { loaded, game } = fixture();
  for (let i = 0; i < ratchetWeeks - 1; i++) game.advanceWeek(false);
  assert.notEqual(game.turnaroundFundSnapshot().status, 'ratcheted');
  // P3-4 pre-cutover Writer characterization: this final installed week will
  // add zero-cash ratchet shares after the turnaround plan resolves. Read-only
  // P3-2 reconciliation must observe the actual issued quantity once, without
  // manufacturing a new registered/beneficial fund holder.
  const reconcile=loaded.modules.economicReadModel.ownershipReconciliation;
  const plain=value=>JSON.parse(JSON.stringify(value));
  const preOwnership=plain(reconcile(game.g));
  assert.equal(preOwnership.ok,true,JSON.stringify(preOwnership.issues));
  const preSecurity=preOwnership.securityClasses[0];
  const preBeneficial=preOwnership.beneficialHoldings[0];
  const preFund=game.turnaroundFundSnapshot();
  const beforeFundReceipts=plain(game.g.finance.transactions.filter(
    txn=>txn.sourceType==='playerCrisisTurnaroundFund'));
  const state = JSON.stringify(game.g);
  const saved = loaded.ctx.__localStorageData.get(KEY);
  const finance = loaded.modules.finance;
  const original = finance.rebuildSnapshotForWeek;
  let thrown = 0;
  finance.rebuildSnapshotForWeek = function (...args) {
    if (!thrown && /finalizeWeekBoundary/.test(new Error().stack)) { thrown++; throw new Error('synthetic boundary failure'); }
    return original.apply(this, args);
  };
  assert.throws(() => game.advanceWeek(false), /synthetic boundary failure/);
  assert.equal(thrown, 1, 'precondition: the final boundary ran (after settle) and failed');
  assert.equal(JSON.stringify(game.g), state, 'ratchet shares and fund status are rolled back with the week');
  assert.equal(loaded.ctx.__localStorageData.get(KEY), saved, 'the save is not overwritten');
  assert.deepEqual(plain(reconcile(game.g)),preOwnership,
    'failed installed week leaves shadow ownership quantities unchanged');
  finance.rebuildSnapshotForWeek = original;
  game.advanceWeek(false);
  const postFund=game.turnaroundFundSnapshot();
  assert.equal(postFund.status, 'ratcheted', 'retry commits the ratchet exactly once');
  assert(postFund.ratchetShares>0,'a real positive no-cash issuance occurred');
  assert.equal(postFund.ratchetShares,postFund.shares-preFund.shares,
    'fund metadata describes one additional issuance, not another position');
  const postOwnership=plain(reconcile(game.g));
  assert.equal(postOwnership.ok,true,JSON.stringify(postOwnership.issues));
  const postSecurity=postOwnership.securityClasses[0];
  assert.equal(postSecurity.issuedQuantity,preSecurity.issuedQuantity+postFund.ratchetShares);
  assert.equal(postSecurity.treasuryQuantity,preSecurity.treasuryQuantity,
    'ratchet cannot buy back shares');
  assert.equal(postSecurity.outstandingQuantity,preSecurity.outstandingQuantity+postFund.ratchetShares);
  assert.equal(postOwnership.beneficialHoldings[0].quantity,preBeneficial.quantity,
    'free shares go to an unmodeled external fund, not the founder');
  assert.equal(postSecurity.unallocatedOutstandingQuantity,
    preSecurity.unallocatedOutstandingQuantity+postFund.ratchetShares,
    'P3-2 does not fabricate registered/beneficial ownership for the fund');
  assert.deepEqual(plain(game.g.finance.transactions.filter(
    txn=>txn.sourceType==='playerCrisisTurnaroundFund')),beforeFundReceipts,
    'zero-cash ratchet must not book a second equity financing receipt');

  // Re-invoking the installed module's settlement after terminal status is
  // inert; the v9 critical snapshot preserves the ratcheted issuance exactly.
  const settledState=JSON.stringify(game.g);
  const settledRng=JSON.stringify(game.g.simulationRng);
  assert.equal(loaded.modules.playerCrisisTurnaroundFund.settle(game),null);
  assert.equal(JSON.stringify(game.g),settledState,'no repeated free share issuance');
  assert.equal(JSON.stringify(game.g.simulationRng),settledRng);
  const critical=loaded.modules.saveStorage.compactStateForStorage(game.g,'critical').state;
  const restored=new loaded.engineModule.TycoonEngine();
  restored.importSave(JSON.stringify(critical));
  assert.equal(restored.g.saveVersion,9);
  assert.deepEqual(plain(reconcile(restored.g)),postOwnership,
    'v9 critical compaction/reload retains exact ratchet ownership evidence');
  assert.equal(restored.turnaroundFundSnapshot().ratchetShares,postFund.ratchetShares);
}

console.log('player crisis turnaround ratchet week rollback tests passed');
