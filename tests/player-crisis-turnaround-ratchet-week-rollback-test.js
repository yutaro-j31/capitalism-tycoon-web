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
let ratchetWeeks = 0, ratchetBoundary;
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
  ratchetBoundary = JSON.parse(state);
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

// Exercise the same installed week at the pre-ratchet boundary against the
// shared fake-IDB faults. The historical finalize/compaction checks above stay.
const { indexedDBFor } = require('./fixtures/pe-fund-acquisition-faults');
const { snapshot, economic } = require('./fixtures/stock-split-atomicity');
const { makeTransactionFaultCase, FAULT_KINDS } = require('./helpers/transaction-fault-case');

async function persistedFixture() {
  const durable = new Map(), control = { attempts: [] }, host = { draws: 0 };
  const random = lcg(7);
  const loaded = loadGame({ headless: true, indexedDB: indexedDBFor(durable, control),
    random: () => { host.draws++; return random(); } });
  const backend = loaded.modules.saveStorageIDB;
  await backend.hydrate();
  const game = new loaded.engineModule.TycoonEngine(JSON.parse(JSON.stringify(ratchetBoundary)));
  assert.equal(game.turnaroundFundSnapshot().status, 'active');
  assert.equal(game.save(), true);
  await backend.flush();
  const s = { ...loaded, game, backend, key: KEY, durable, control, host, ratchetHits: 0, unfaultedEmit: game.emit };
  const ratios = game.updateOwnershipRatios;
  game.updateOwnershipRatios = function (...args) {
    if (this.g.playerTurnaroundFund.status === 'ratcheted') s.ratchetHits++;
    return ratios.apply(this, args);
  };
  return s;
}

function week(s) {
  const hits = s.ratchetHits, emit = s.game.emit;
  // Shared notify injection must reach the ratchet's notification, not an
  // unrelated earlier weekly notification. Other actual events are delegated.
  s.game.emit = function (type, ...args) {
    if (type === 'notify' && this.g.playerTurnaroundFund.status !== 'ratcheted')
      return s.unfaultedEmit.call(this, type, ...args);
    return emit.call(this, type, ...args);
  };
  try { return s.game.advanceWeek(false); }
  finally {
    s.game.emit = emit;
    assert.ok(s.ratchetHits > hits, 'installed week reaches ratchet issuance before fault');
  }
}

function assertRatchet(before, after, s) {
  // Independent quantity oracle: the existing contract gives 15% of enlarged
  // shares, not 15% of the old count. No writer output determines this value.
  const shares = Math.max(1, Math.round(before.sharesOut * .15 / .85));
  assert.equal(after.week, before.week + 1);
  assert.equal(after.sharesOut, before.sharesOut + shares);
  assert.equal(after.playerTurnaroundFund.status, 'ratcheted');
  assert.equal(after.playerTurnaroundFund.shares, before.playerTurnaroundFund.shares + shares);
  assert.equal(after.playerTurnaroundFund.ratchetShares, before.playerTurnaroundFund.ratchetShares + shares);
  for (const key of ['founderShares', 'treasuryBuybackShares', 'personalStocks', 'companyStocks'])
    assert.deepEqual(after[key], before[key], key + ': ratchet transfers no existing holding');
  const receipts = state => state.finance.transactions.filter(t => t.sourceType === 'playerCrisisTurnaroundFund');
  assert.deepEqual(receipts(after), receipts(before), 'no second equity cash receipt');
  const reconciliation = s.modules.economicReadModel.ownershipReconciliation(after);
  assert.equal(reconciliation.ok, true, JSON.stringify(reconciliation.issues));
  assert.equal(s.modules.finance.validate(JSON.parse(JSON.stringify(after))).ok, true);
}

(async () => {
  const harness = makeTransactionFaultCase({ name: 'ratchet week', fixture: persistedFixture,
    command: week, snapshot, economic, expectSuccess: assertRatchet });
  // Canonical weeks complete with `week`, not the scoped command's `change`.
  for (const kind of FAULT_KINDS.filter(kind => kind !== 'change'))
    await harness.rejected('canonical', kind);
  for (const kind of ['save-false', 'save-throw'])
    for (const options of [{ pending: true }, { nested: true }])
      await harness.rejected('canonical', kind, options);

  const s = await persistedFixture(), before = snapshot(s.game), bytes = s.backend.readSync(KEY);
  const emit = s.game.emit;
  let hits = 0;
  s.game.emit = function (type, ...args) {
    if (type === 'week') { assert.equal(this.g.playerTurnaroundFund.status, 'ratcheted'); hits++; throw Error('ratchet week completion threw'); }
    return emit.call(this, type, ...args);
  };
  assert.throws(() => week(s), /ratchet week completion threw/);
  s.game.emit = emit;
  assert.equal(hits, 1);
  assert.deepEqual(snapshot(s.game), before);
  assert.equal(s.backend.readSync(KEY), bytes);
  assert.equal(s.ctx.__localStorageData.get(KEY), bytes);
  await s.backend.flush();
  assert.equal(s.durable.get(KEY), bytes);
  await harness.loaded(s, before);
  assert.equal(week(s), true);
  assertRatchet(before, snapshot(s.game), s);
  await s.backend.flush();
  await harness.loaded(s, s.game.g);
  const uninterrupted = await persistedFixture();
  assert.equal(week(uninterrupted), true);
  assert.deepEqual(economic(s.game.g), economic(uninterrupted.game.g), 'failure/retry equals uninterrupted same-seed week');
  const stable = snapshot(s.game);
  assert.equal(s.modules.playerCrisisTurnaroundFund.settle(s.game), null);
  assert.deepEqual(snapshot(s.game), stable, 'terminal settlement cannot issue again');

  const broken = makeTransactionFaultCase({ name: 'broken ratchet rollback',
    fixture: async () => { const s = await persistedFixture(); s.game.restoreTransactionSnapshot = () => {}; return s; },
    command: week, snapshot, economic, expectSuccess: assertRatchet });
  await assert.rejects(broken.rejected('canonical', 'save-false'), /full live rollback/);
  console.log('Ratchet canonical week shared save-fault evidence PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
